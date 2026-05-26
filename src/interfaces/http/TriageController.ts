import type { Request, Response } from "express";
import { z } from "zod";
import { PoNotFoundError, AppError } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";
import type { TriageOrchestrator } from "../../application/triage/TriageOrchestrator.js";

const TriageRequestSchema = z.object({
  question: z.string().min(1, "question is required")
});

export class TriageController {
  constructor(private readonly orchestrator: TriageOrchestrator) {}

  async triage(req: Request, res: Response): Promise<void> {
    const parsed = TriageRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: "invalid_request",
          message: parsed.error.issues[0]?.message ?? "question is required"
        }
      });
      return;
    }
    try {
      const recommendation = await this.orchestrator.triage(parsed.data.question);
      res.status(200).json(recommendation);
    } catch (error) {
      if (error instanceof PoNotFoundError) {
        res.status(404).json({ error: { code: error.code, message: error.message } });
        return;
      }
      if (error instanceof AppError) {
        res.status(400).json({ error: { code: error.code, message: error.message } });
        return;
      }
      logger.error("triage_failed", {
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({
        error: {
          code: "internal_error",
          message: "An unexpected error occurred while triaging the request."
        }
      });
    }
  }

  health(_req: Request, res: Response): void {
    res.status(200).json({ status: "ok" });
  }
}
