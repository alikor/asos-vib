type Level = "debug" | "info" | "warn" | "error";

const log = (level: Level, msg: string, meta?: Record<string, unknown>): void => {
  const record = { level, ts: new Date().toISOString(), msg, ...(meta ?? {}) };
  const out = level === "error" || level === "warn" ? console.error : console.log;
  out(JSON.stringify(record));
};

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta)
};
