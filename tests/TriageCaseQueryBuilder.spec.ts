import { describe, expect, it } from "vitest";
import { TriageCaseQueryBuilder } from "../src/application/queries/TriageCaseQueryBuilder.js";
import type { TriageCaseState } from "../src/domain/triage/TriageCaseState.js";

const sampleCases: TriageCaseState[] = [
  {
    caseId: "case-1",
    status: "started",
    question: "Triage PO-10001",
    poId: "PO-10001",
    retrievedCitations: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    caseId: "case-2",
    status: "completed",
    question: "Triage PO-10002",
    poId: "PO-10002",
    retrievedCitations: ["po_amendment_policy.md §3"],
    createdAt: "2026-01-01T00:01:00.000Z",
    updatedAt: "2026-01-01T00:02:00.000Z"
  },
  {
    caseId: "case-3",
    status: "completed",
    question: "Triage PO-10001 again",
    poId: "PO-10001",
    retrievedCitations: ["variance_detection_sop.md §2"],
    createdAt: "2026-01-01T00:03:00.000Z",
    updatedAt: "2026-01-01T00:04:00.000Z"
  }
];

const makeProjector = (rows: TriageCaseState[]) => ({
  readAll: async () => rows
});

describe("TriageCaseQueryBuilder", () => {
  it("filters cases by po id and status", async () => {
    const results = await new TriageCaseQueryBuilder(makeProjector(sampleCases))
      .wherePoId("PO-10001")
      .whereStatus("completed")
      .execute();

    expect(results).toEqual([sampleCases[2]]);
  });

  it("filters by case id", async () => {
    const results = await new TriageCaseQueryBuilder(makeProjector(sampleCases))
      .whereCaseId("case-1")
      .execute();

    expect(results).toEqual([sampleCases[0]]);
  });

  it("returns the first matching case from executeOne", async () => {
    const result = await new TriageCaseQueryBuilder(makeProjector(sampleCases))
      .wherePoId("PO-10001")
      .executeOne();

    expect(result).toEqual(sampleCases[0]);
  });

  it("returns null from executeOne when no cases match", async () => {
    const result = await new TriageCaseQueryBuilder(makeProjector(sampleCases))
      .whereStatus("failed")
      .executeOne();

    expect(result).toBeNull();
  });
});