import { PoNotFoundError } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";
import { newCaseId, newCommandId, nowIso } from "../../shared/ids.js";
import type { Forecast } from "../../domain/purchase-orders/Forecast.js";
import type { PurchaseOrder } from "../../domain/purchase-orders/PurchaseOrder.js";
import type { PolicyChunkSearchResult } from "../../domain/rag/PolicyChunk.js";
import type {
  GuardrailResult,
  TriageRecommendation,
  VarianceSummary
} from "../../domain/triage/Recommendation.js";
import type { LlmClient, LlmMessage } from "../../infrastructure/llm/LlmClient.js";
import type { ToolCallingLoop } from "../../infrastructure/llm/ToolCallingLoop.js";
import type { AgentToolRegistry } from "../../infrastructure/tools/AgentToolRegistry.js";
import type { GetPoOutput } from "../../infrastructure/tools/GetPoTool.js";
import type { PiiDetector } from "../../infrastructure/security/PiiDetector.js";
import type { CommandBus } from "../commands/CommandBus.js";
import { StartTriageCaseCommand } from "../commands/StartTriageCaseCommand.js";
import { RecordRetrievedContextCommand } from "../commands/RecordRetrievedContextCommand.js";
import { RecordToolDataLoadedCommand } from "../commands/RecordToolDataLoadedCommand.js";
import { RecordRecommendationGeneratedCommand } from "../commands/RecordRecommendationGeneratedCommand.js";
import { RecordGuardrailsEvaluatedCommand } from "../commands/RecordGuardrailsEvaluatedCommand.js";
import { CompleteTriageCaseCommand } from "../commands/CompleteTriageCaseCommand.js";
import { EscalateTriageCaseCommand } from "../commands/EscalateTriageCaseCommand.js";
import type { PolicyChunkQueryBuilderFactory } from "../queries/PolicyChunkQueryBuilder.js";
import type { Guardrail } from "../guardrails/Guardrail.js";
import { parseAndValidateRecommendation } from "./RecommendationSchema.js";
import { VarianceCalculator } from "./VarianceCalculator.js";
import { TRIAGE_SYSTEM_PROMPT, buildContextBlock } from "./prompts/triage-system-prompt.js";

const PO_ID_PATTERN = /\bPO-\d+\b/i;

export type TriageOrchestratorConfig = {
  topK: number;
  minScore: number;
  toolLoopMaxIterations: number;
};

export type TriageOrchestratorDeps = {
  llm: LlmClient;
  toolLoop: ToolCallingLoop;
  toolRegistry: AgentToolRegistry;
  policyChunkQueryBuilderFactory: PolicyChunkQueryBuilderFactory;
  guardrails: Guardrail[];
  varianceCalculator: VarianceCalculator;
  piiDetector: PiiDetector;
  commandBus: CommandBus;
  config: TriageOrchestratorConfig;
};

export class TriageOrchestrator {
  constructor(private readonly deps: TriageOrchestratorDeps) {}

  async triage(question: string): Promise<TriageRecommendation> {
    const trimmed = question.trim();
    if (!trimmed) throw new Error("question is required");
    const caseId = newCaseId();
    const poIdMatch = trimmed.match(PO_ID_PATTERN);
    const candidatePoId = poIdMatch ? poIdMatch[0].toUpperCase() : undefined;

    await this.deps.commandBus.dispatch(
      new StartTriageCaseCommand(newCommandId(), nowIso(), caseId, trimmed, candidatePoId)
    );

    const initialChunks = await this.retrieve(trimmed);
    await this.recordContext(caseId, initialChunks);

    const toolMessages: LlmMessage[] = [
      { role: "system", content: TRIAGE_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildContextBlock({
          question: trimmed,
          retrievedChunks: initialChunks.map((result) => ({
            citation: result.chunk.citation,
            safeText: result.chunk.safeText
          })),
          toolOutputs: [],
          knownPoId: candidatePoId
        })
      }
    ];

    const toolResult = await this.deps.toolLoop.run({
      messages: toolMessages,
      maxIterations: this.deps.config.toolLoopMaxIterations
    });

    const toolOutputs: Array<{ toolName: string; output: unknown }> = toolResult.toolCalls.map(
      ({ toolName, output }) => ({ toolName, output })
    );

    let po = this.extractPo(toolOutputs);
    if (!po && candidatePoId && this.deps.toolRegistry.has("get_po")) {
      const tool = this.deps.toolRegistry.get("get_po")!;
      const out = (await tool.execute({ po_id: candidatePoId })) as GetPoOutput;
      toolOutputs.push({ toolName: "get_po", output: out });
      if (out.found && out.po) po = out.po;
    }
    if (!po && candidatePoId) {
      throw new PoNotFoundError(candidatePoId);
    }
    if (!po) {
      // Question lacks a PO id and the model didn't supply one — escalate
      const escalation = this.buildEscalationForMissingPo(trimmed);
      await this.finaliseEscalation(caseId, escalation, []);
      return escalation;
    }

    const forecast = this.extractForecast(toolOutputs);
    const variance: VarianceSummary = this.deps.varianceCalculator.calculate(po);

    for (const record of toolOutputs) {
      await this.deps.commandBus.dispatch(
        new RecordToolDataLoadedCommand(
          newCommandId(),
          nowIso(),
          caseId,
          record.toolName,
          record.output
        )
      );
    }

    const secondQuery = this.buildSecondPassQuery(po, variance);
    const secondChunks = await this.retrieve(secondQuery);
    const merged = this.mergeChunks(initialChunks, secondChunks);
    if (secondChunks.length > 0) {
      await this.recordContext(caseId, secondChunks);
    }

    const finalRecommendation = await this.generateAndValidate({
      caseId,
      question: trimmed,
      knownPoId: po.po_id,
      retrievedChunks: merged,
      toolOutputs,
      varianceSummary: variance
    });

    const guardrailResults = await this.evaluateGuardrails({
      question: trimmed,
      recommendation: finalRecommendation,
      retrievedChunks: merged,
      retrievedCitations: merged.map((r) => r.chunk.citation),
      po,
      forecast,
      varianceSummary: variance
    });

    let effective = finalRecommendation;
    const blocking = guardrailResults.find((r) => !r.passed && r.severity === "blocking");
    if (blocking?.override) {
      effective = { ...effective, ...blocking.override } as TriageRecommendation;
      if (effective.recommended_action === "escalate" && effective.citations.length === 0) {
        effective.citations = merged.slice(0, 2).map((r) => r.chunk.citation);
      }
    }

    await this.deps.commandBus.dispatch(
      new RecordRecommendationGeneratedCommand(
        newCommandId(),
        nowIso(),
        caseId,
        finalRecommendation
      )
    );
    await this.deps.commandBus.dispatch(
      new RecordGuardrailsEvaluatedCommand(
        newCommandId(),
        nowIso(),
        caseId,
        guardrailResults
      )
    );

    if (effective.recommended_action === "escalate") {
      await this.deps.commandBus.dispatch(
        new EscalateTriageCaseCommand(newCommandId(), nowIso(), caseId, effective)
      );
    } else {
      await this.deps.commandBus.dispatch(
        new CompleteTriageCaseCommand(newCommandId(), nowIso(), caseId, effective)
      );
    }

    return effective;
  }

  private async retrieve(query: string): Promise<PolicyChunkSearchResult[]> {
    try {
      return await this.deps.policyChunkQueryBuilderFactory
        .create()
        .withQuery(query)
        .withTopK(this.deps.config.topK)
        .withMinScore(this.deps.config.minScore)
        .execute();
    } catch (error) {
      logger.warn("retrieval_failed", {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  private async recordContext(
    caseId: string,
    chunks: PolicyChunkSearchResult[]
  ): Promise<void> {
    await this.deps.commandBus.dispatch(
      new RecordRetrievedContextCommand(
        newCommandId(),
        nowIso(),
        caseId,
        chunks.map((r) => r.chunk.citation),
        chunks.map((r) => ({ citation: r.chunk.citation, score: r.score }))
      )
    );
  }

  private buildSecondPassQuery(po: PurchaseOrder, variance: VarianceSummary): string {
    const action = po.status === "planned" ? "firm planned order" : "amend or split or backorder";
    return `Triage decision for category=${po.category} channel=${po.channel} status=${po.status} ` +
      `quantity_variance_percent=${variance.quantityVariancePercent} ` +
      `eta_variance_days=${variance.etaVarianceDays} value_gbp=${po.value_gbp}. ` +
      `Consider candidate actions: ${action}, raise backorder, split child PO, escalate. ` +
      `Reference amendment thresholds, variance severity, child PO split rules, backorder rules, ` +
      `and escalation matrix value bands.`;
  }

  private mergeChunks(
    a: PolicyChunkSearchResult[],
    b: PolicyChunkSearchResult[]
  ): PolicyChunkSearchResult[] {
    const seen = new Set<string>();
    const merged: PolicyChunkSearchResult[] = [];
    for (const result of [...a, ...b]) {
      if (seen.has(result.chunk.citation)) continue;
      seen.add(result.chunk.citation);
      merged.push(result);
    }
    merged.sort((x, y) => y.score - x.score);
    return merged.slice(0, this.deps.config.topK);
  }

  private extractPo(
    toolOutputs: Array<{ toolName: string; output: unknown }>
  ): PurchaseOrder | undefined {
    for (let i = toolOutputs.length - 1; i >= 0; i -= 1) {
      const entry = toolOutputs[i];
      if (!entry || entry.toolName !== "get_po") continue;
      const output = entry.output as GetPoOutput;
      if (output?.found && output.po) return output.po;
    }
    return undefined;
  }

  private extractForecast(
    toolOutputs: Array<{ toolName: string; output: unknown }>
  ): Forecast[] | undefined {
    for (let i = toolOutputs.length - 1; i >= 0; i -= 1) {
      const entry = toolOutputs[i];
      if (!entry || entry.toolName !== "get_forecast") continue;
      const output = entry.output as { found: boolean; forecasts: Forecast[] };
      if (output?.found) return output.forecasts;
    }
    return undefined;
  }

  private async generateAndValidate(input: {
    caseId: string;
    question: string;
    knownPoId: string;
    retrievedChunks: PolicyChunkSearchResult[];
    toolOutputs: Array<{ toolName: string; output: unknown }>;
    varianceSummary: VarianceSummary;
  }): Promise<TriageRecommendation> {
    const context = buildContextBlock({
      question: input.question,
      knownPoId: input.knownPoId,
      retrievedChunks: input.retrievedChunks.map((r) => ({
        citation: r.chunk.citation,
        safeText: r.chunk.safeText
      })),
      toolOutputs: input.toolOutputs,
      varianceSummary: input.varianceSummary
    });

    const messages: LlmMessage[] = [
      { role: "system", content: TRIAGE_SYSTEM_PROMPT },
      { role: "user", content: context }
    ];

    const retrievedCitations = input.retrievedChunks.map((r) => r.chunk.citation);
    const first = await this.deps.llm.complete({
      messages,
      responseFormat: { type: "json_object" }
    });
    const firstParse = this.tryParse(first.content, retrievedCitations, input.knownPoId);
    if (firstParse.ok) return firstParse.recommendation;

    const retryMessage: LlmMessage = {
      role: "user",
      content:
        `Your previous response was rejected for the following reasons:\n` +
        `${firstParse.issues.join("\n")}\n\n` +
        `Re-issue the JSON object, fixing every issue. Only cite from: ` +
        `${retrievedCitations.join(", ")}. Use po_id ${input.knownPoId}. ` +
        `Return strictly JSON.`
    };
    const second = await this.deps.llm.complete({
      messages: [...messages, retryMessage],
      responseFormat: { type: "json_object" }
    });
    const secondParse = this.tryParse(second.content, retrievedCitations, input.knownPoId);
    if (secondParse.ok) return secondParse.recommendation;

    logger.warn("recommendation_safe_fallback", { issues: secondParse.issues });
    return {
      po_id: input.knownPoId,
      recommended_action: "escalate",
      rationale:
        "The system could not produce a schema-valid, policy-grounded recommendation. The case must be escalated for human review.",
      citations: retrievedCitations.slice(0, 2),
      confidence: "low",
      escalation_target_role: "Senior Merch Planner"
    };
  }

  private tryParse(
    content: string | null,
    retrievedCitations: string[],
    knownPoId?: string
  ): ReturnType<typeof parseAndValidateRecommendation> {
    if (!content) return { ok: false, issues: ["LLM returned empty content"] };
    let raw: unknown;
    try {
      raw = JSON.parse(content);
    } catch (error) {
      return { ok: false, issues: [`invalid JSON: ${(error as Error).message}`] };
    }
    return parseAndValidateRecommendation({
      raw,
      retrievedCitations,
      piiDetector: this.deps.piiDetector,
      knownPoId
    });
  }

  private async evaluateGuardrails(context: {
    question: string;
    recommendation: TriageRecommendation;
    retrievedChunks: PolicyChunkSearchResult[];
    retrievedCitations: string[];
    po?: PurchaseOrder;
    forecast?: Forecast[];
    varianceSummary?: VarianceSummary;
  }): Promise<GuardrailResult[]> {
    const results: GuardrailResult[] = [];
    for (const guardrail of this.deps.guardrails) {
      const result = await guardrail.evaluate({
        ...context,
        minScore: this.deps.config.minScore
      });
      results.push(result);
      if (!result.passed && result.severity === "blocking" && result.override) {
        context = { ...context, recommendation: { ...context.recommendation, ...result.override } };
      }
    }
    return results;
  }

  private buildEscalationForMissingPo(question: string): TriageRecommendation {
    return {
      po_id: "PO-UNKNOWN",
      recommended_action: "escalate",
      rationale:
        `No purchase order id was provided in the question and no PO data could be loaded for: "${question}". ` +
        `The case must be escalated for human review.`,
      citations: [],
      confidence: "low",
      escalation_target_role: "Senior Merch Planner"
    };
  }

  private async finaliseEscalation(
    caseId: string,
    recommendation: TriageRecommendation,
    guardrailResults: GuardrailResult[]
  ): Promise<void> {
    await this.deps.commandBus.dispatch(
      new RecordRecommendationGeneratedCommand(
        newCommandId(),
        nowIso(),
        caseId,
        recommendation
      )
    );
    await this.deps.commandBus.dispatch(
      new RecordGuardrailsEvaluatedCommand(newCommandId(), nowIso(), caseId, guardrailResults)
    );
    await this.deps.commandBus.dispatch(
      new EscalateTriageCaseCommand(newCommandId(), nowIso(), caseId, recommendation)
    );
  }
}
