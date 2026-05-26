import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { TriageRecommendationSchema } from "../src/application/triage/RecommendationSchema.js";

type EvalCase = {
  name: string;
  question: string;
  expected: {
    po_id?: string;
    recommended_action?: string;
    confidence?: string;
    escalation_target_role?: string;
    must_include_citations?: string[];
    rationale_must_include_any?: string[];
    must_not_match?: string[];
  };
};

const baseUrl = process.env.TRIAGE_BASE_URL ?? `http://localhost:${process.env.PORT ?? "3000"}`;

const postTriage = async (question: string): Promise<unknown> => {
  const response = await fetch(`${baseUrl}/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question })
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status}: ${body}`);
  }
  return response.json();
};

const formatFails = (failures: string[]): string =>
  failures.map((f) => `  - ${f}`).join("\n");

const evaluateCase = async (
  testCase: EvalCase
): Promise<{ name: string; passed: boolean; failures: string[] }> => {
  const failures: string[] = [];
  let body: unknown;
  try {
    body = await postTriage(testCase.question);
  } catch (error) {
    return {
      name: testCase.name,
      passed: false,
      failures: [`request failed: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
  const parsed = TriageRecommendationSchema.safeParse(body);
  if (!parsed.success) {
    return {
      name: testCase.name,
      passed: false,
      failures: parsed.error.issues.map((i) => `schema: ${i.path.join(".")} ${i.message}`)
    };
  }
  const rec = parsed.data;
  const exp = testCase.expected;
  if (exp.po_id && rec.po_id !== exp.po_id) {
    failures.push(`po_id expected ${exp.po_id}, got ${rec.po_id}`);
  }
  if (exp.recommended_action && rec.recommended_action !== exp.recommended_action) {
    failures.push(
      `recommended_action expected ${exp.recommended_action}, got ${rec.recommended_action}`
    );
  }
  if (exp.confidence && rec.confidence !== exp.confidence) {
    failures.push(`confidence expected ${exp.confidence}, got ${rec.confidence}`);
  }
  if (exp.escalation_target_role) {
    if (rec.escalation_target_role !== exp.escalation_target_role) {
      failures.push(
        `escalation_target_role expected ${exp.escalation_target_role}, got ${rec.escalation_target_role}`
      );
    }
  }
  if (exp.must_include_citations) {
    const citations = rec.citations.join(" | ");
    for (const required of exp.must_include_citations) {
      if (!citations.includes(required)) {
        failures.push(`citations must include "${required}" — got [${citations}]`);
      }
    }
  }
  if (exp.rationale_must_include_any) {
    const lower = rec.rationale.toLowerCase();
    const matched = exp.rationale_must_include_any.some((token) =>
      lower.includes(token.toLowerCase())
    );
    if (!matched) {
      failures.push(
        `rationale must include any of [${exp.rationale_must_include_any.join(", ")}]: "${rec.rationale}"`
      );
    }
  }
  if (exp.must_not_match) {
    const serialised = JSON.stringify(rec);
    for (const forbidden of exp.must_not_match) {
      if (serialised.includes(forbidden)) {
        failures.push(`forbidden string "${forbidden}" appeared in response`);
      }
    }
  }
  return { name: testCase.name, passed: failures.length === 0, failures };
};

const main = async (): Promise<void> => {
  const casesPath = join(resolve(process.cwd()), "evals", "cases.json");
  const cases = JSON.parse(await readFile(casesPath, "utf-8")) as EvalCase[];
  let passed = 0;
  for (const testCase of cases) {
    const result = await evaluateCase(testCase);
    if (result.passed) {
      process.stdout.write(`PASS ${result.name}\n`);
      passed += 1;
    } else {
      process.stdout.write(`FAIL ${result.name}\n${formatFails(result.failures)}\n`);
    }
  }
  process.stdout.write(`\n${passed}/${cases.length} evals passed\n`);
  if (passed !== cases.length) process.exit(1);
};

main().catch((error) => {
  process.stderr.write(`eval runner failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
