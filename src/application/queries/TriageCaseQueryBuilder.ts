import type {
  TriageCaseState,
  TriageCaseStatus
} from "../../domain/triage/TriageCaseState.js";
import type { TriageCaseProjector } from "../../infrastructure/persistence/TriageCaseProjector.js";

export class TriageCaseQueryBuilder {
  private caseId?: string;
  private poId?: string;
  private status?: TriageCaseStatus;

  constructor(private readonly projector: TriageCaseProjector) {}

  whereCaseId(caseId: string): this {
    this.caseId = caseId;
    return this;
  }

  wherePoId(poId: string): this {
    this.poId = poId;
    return this;
  }

  whereStatus(status: TriageCaseStatus): this {
    this.status = status;
    return this;
  }

  async execute(): Promise<TriageCaseState[]> {
    let rows = await this.projector.readAll();
    if (this.caseId) rows = rows.filter((row) => row.caseId === this.caseId);
    if (this.poId) rows = rows.filter((row) => row.poId === this.poId);
    if (this.status) rows = rows.filter((row) => row.status === this.status);
    return rows;
  }

  async executeOne(): Promise<TriageCaseState | null> {
    const rows = await this.execute();
    return rows[0] ?? null;
  }
}
