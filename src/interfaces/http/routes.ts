import { Router } from "express";
import type { TriageController } from "./TriageController.js";

export const buildRoutes = (controller: TriageController): Router => {
  const router = Router();
  router.post("/triage", (req, res) => {
    controller.triage(req, res).catch((error) => {
      // Errors are handled inside controller; this is a defensive fallback.
      res.status(500).json({
        error: {
          code: "internal_error",
          message: error instanceof Error ? error.message : "internal error"
        }
      });
    });
  });
  router.get("/health", (req, res) => controller.health(req, res));
  return router;
};
