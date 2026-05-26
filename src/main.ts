import "dotenv/config";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { buildApp } from "./app.js";
import { CommandBus } from "./application/commands/CommandBus.js";
import { CompleteTriageCaseCommand } from "./application/commands/CompleteTriageCaseCommand.js";
import { EscalateTriageCaseCommand } from "./application/commands/EscalateTriageCaseCommand.js";
import { RecordGuardrailsEvaluatedCommand } from "./application/commands/RecordGuardrailsEvaluatedCommand.js";
import { RecordRecommendationGeneratedCommand } from "./application/commands/RecordRecommendationGeneratedCommand.js";
import { RecordRetrievedContextCommand } from "./application/commands/RecordRetrievedContextCommand.js";
import { RecordToolDataLoadedCommand } from "./application/commands/RecordToolDataLoadedCommand.js";
import { StartTriageCaseCommand } from "./application/commands/StartTriageCaseCommand.js";
import { CompleteTriageCaseHandler } from "./application/command-handlers/CompleteTriageCaseHandler.js";
import { EscalateTriageCaseHandler } from "./application/command-handlers/EscalateTriageCaseHandler.js";
import { RecordGuardrailsEvaluatedHandler } from "./application/command-handlers/RecordGuardrailsEvaluatedHandler.js";
import { RecordRecommendationGeneratedHandler } from "./application/command-handlers/RecordRecommendationGeneratedHandler.js";
import { RecordRetrievedContextHandler } from "./application/command-handlers/RecordRetrievedContextHandler.js";
import { RecordToolDataLoadedHandler } from "./application/command-handlers/RecordToolDataLoadedHandler.js";
import { StartTriageCaseHandler } from "./application/command-handlers/StartTriageCaseHandler.js";
import { ContradictionGuardrail } from "./application/guardrails/ContradictionGuardrail.js";
import { PiiGuardrail } from "./application/guardrails/PiiGuardrail.js";
import { RetrievalConfidenceGuardrail } from "./application/guardrails/RetrievalConfidenceGuardrail.js";
import { DefaultPolicyChunkQueryBuilderFactory } from "./application/queries/PolicyChunkQueryBuilder.js";
import { TriageOrchestrator } from "./application/triage/TriageOrchestrator.js";
import { VarianceCalculator } from "./application/triage/VarianceCalculator.js";
import { TriageController } from "./interfaces/http/TriageController.js";
import { OpenAiCompatibleEmbeddingClient } from "./infrastructure/embeddings/OpenAiCompatibleEmbeddingClient.js";
import { OpenAiCompatibleLlmClient } from "./infrastructure/llm/OpenAiCompatibleLlmClient.js";
import { ToolCallingLoop } from "./infrastructure/llm/ToolCallingLoop.js";
import { InProcessEventBus } from "./infrastructure/persistence/InProcessEventBus.js";
import { JsonFileDataSource } from "./infrastructure/persistence/JsonFileDataSource.js";
import { JsonlEventStore } from "./infrastructure/persistence/JsonlEventStore.js";
import { TriageCaseProjector } from "./infrastructure/persistence/TriageCaseProjector.js";
import { InMemoryVectorIndex } from "./infrastructure/rag/InMemoryVectorIndex.js";
import { MarkdownChunker } from "./infrastructure/rag/MarkdownChunker.js";
import { MarkdownCorpusLoader } from "./infrastructure/rag/MarkdownCorpusLoader.js";
import { VectorIndexPersister } from "./infrastructure/rag/VectorIndexPersister.js";
import { EscalationMatrixSanitizer } from "./infrastructure/security/EscalationMatrixSanitizer.js";
import { PiiDetector } from "./infrastructure/security/PiiDetector.js";
import { AgentToolRegistry } from "./infrastructure/tools/AgentToolRegistry.js";
import { GetForecastTool } from "./infrastructure/tools/GetForecastTool.js";
import { GetPoTool } from "./infrastructure/tools/GetPoTool.js";
import { logger } from "./shared/logger.js";
import type { Forecast } from "./domain/purchase-orders/Forecast.js";
import type { PurchaseOrder } from "./domain/purchase-orders/PurchaseOrder.js";
import { buildIndex } from "../scripts/build-index.js";

const projectRoot = resolve(process.cwd());

const REQUIRED_CORPUS_FILES = [
  "po_amendment_policy.md",
  "variance_detection_sop.md",
  "child_po_split_rules.md",
  "backorder_reconciliation.md",
  "merch_escalation_matrix.md"
];

const ensureFile = (filePath: string, hint: string): void => {
  if (!existsSync(filePath)) {
    throw new Error(`Required file missing: ${filePath}. ${hint}`);
  }
};

const collectKnownNames = async (corpusDir: string): Promise<string[]> => {
  const matrixPath = join(corpusDir, "merch_escalation_matrix.md");
  const raw = await readFile(matrixPath, "utf-8");
  const sanitiser = new EscalationMatrixSanitizer();
  const { knownNames } = sanitiser.sanitize(raw);
  return knownNames;
};

export const start = async (): Promise<void> => {
  const port = Number.parseInt(process.env.PORT ?? "3000", 10);
  const corpusDir = join(projectRoot, "corpus");
  const dataDir = join(projectRoot, "data");
  const storageDir = join(projectRoot, "storage");

  await mkdir(storageDir, { recursive: true });

  ensureFile(corpusDir, "Run `pnpm seed:corpus` to generate corpus files.");
  for (const file of REQUIRED_CORPUS_FILES) {
    ensureFile(join(corpusDir, file), `Run \`pnpm seed:corpus\` to (re)generate ${file}.`);
  }
  ensureFile(
    join(dataDir, "purchase_orders.json"),
    "Run `pnpm seed:data` to generate purchase_orders.json."
  );
  ensureFile(join(dataDir, "forecasts.json"), "Run `pnpm seed:data` to generate forecasts.json.");

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  const baseUrl = process.env.OPENAI_BASE_URL;
  const llmModel = process.env.LLM_MODEL ?? "gpt-4o-mini";
  const embeddingModel = process.env.EMBEDDING_MODEL ?? "text-embedding-3-small";

  if (!apiKey || apiKey === "replace-me") {
    logger.warn("openai_api_key_missing", {
      hint: "Set OPENAI_API_KEY before issuing /triage requests; index builds will also fail."
    });
  }

  const embeddingClient = new OpenAiCompatibleEmbeddingClient({
    apiKey,
    baseUrl,
    model: embeddingModel
  });

  const persister = new VectorIndexPersister(join(storageDir, "vector-index.json"));
  if (!persister.exists()) {
    logger.info("vector_index_missing_building", { embeddingModel });
    await buildIndex({
      corpusDir,
      indexPath: join(storageDir, "vector-index.json"),
      embeddingClient,
      embeddingModel
    });
  }
  const chunks = await persister.load();
  const vectorIndex = new InMemoryVectorIndex(chunks);

  const purchaseOrderDataSource = new JsonFileDataSource<PurchaseOrder>(
    join(dataDir, "purchase_orders.json")
  );
  const forecastDataSource = new JsonFileDataSource<Forecast>(join(dataDir, "forecasts.json"));

  const knownNames = await collectKnownNames(corpusDir);
  const piiDetector = new PiiDetector(knownNames);

  const llmClient = new OpenAiCompatibleLlmClient({ apiKey, baseUrl, model: llmModel });

  const toolRegistry = new AgentToolRegistry();
  toolRegistry.register(new GetPoTool(purchaseOrderDataSource));
  toolRegistry.register(new GetForecastTool(forecastDataSource));

  const toolLoop = new ToolCallingLoop(llmClient, toolRegistry);

  const eventStore = new JsonlEventStore(join(storageDir, "events.jsonl"));
  const eventBus = new InProcessEventBus();
  const projector = new TriageCaseProjector(
    join(storageDir, "triage-case-projections.json")
  );
  eventBus.subscribe(async (event) => {
    await projector.handle(event);
  });

  const commandBus = new CommandBus();
  commandBus.register(StartTriageCaseCommand, new StartTriageCaseHandler(eventStore, eventBus));
  commandBus.register(
    RecordRetrievedContextCommand,
    new RecordRetrievedContextHandler(eventStore, eventBus)
  );
  commandBus.register(
    RecordToolDataLoadedCommand,
    new RecordToolDataLoadedHandler(eventStore, eventBus)
  );
  commandBus.register(
    RecordRecommendationGeneratedCommand,
    new RecordRecommendationGeneratedHandler(eventStore, eventBus)
  );
  commandBus.register(
    RecordGuardrailsEvaluatedCommand,
    new RecordGuardrailsEvaluatedHandler(eventStore, eventBus)
  );
  commandBus.register(
    CompleteTriageCaseCommand,
    new CompleteTriageCaseHandler(eventStore, eventBus)
  );
  commandBus.register(
    EscalateTriageCaseCommand,
    new EscalateTriageCaseHandler(eventStore, eventBus)
  );

  const factory = new DefaultPolicyChunkQueryBuilderFactory(vectorIndex, embeddingClient);
  const guardrails = [
    new PiiGuardrail(piiDetector),
    new RetrievalConfidenceGuardrail(),
    new ContradictionGuardrail()
  ];

  const topK = Number.parseInt(process.env.RAG_TOP_K ?? "6", 10);
  const minScore = Number.parseFloat(process.env.RAG_MIN_SCORE ?? "0.68");

  const orchestrator = new TriageOrchestrator({
    llm: llmClient,
    toolLoop,
    toolRegistry,
    policyChunkQueryBuilderFactory: factory,
    guardrails,
    varianceCalculator: new VarianceCalculator(),
    piiDetector,
    commandBus,
    config: { topK, minScore, toolLoopMaxIterations: 3 }
  });

  const controller = new TriageController(orchestrator);
  const app = buildApp(controller);
  app.listen(port, () => {
    logger.info("server_listening", { port });
  });
};

if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch((error) => {
    logger.error("startup_failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  });
}
