import express, { type Express } from "express";
import { buildRoutes } from "./interfaces/http/routes.js";
import type { TriageController } from "./interfaces/http/TriageController.js";

export const buildApp = (controller: TriageController): Express => {
  const app = express();
  app.use(express.json({ limit: "256kb" }));
  app.use(buildRoutes(controller));
  return app;
};
