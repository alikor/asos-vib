import { v4 as uuidv4 } from "uuid";

export const newCaseId = (): string => `case_${uuidv4()}`;
export const newCommandId = (): string => `cmd_${uuidv4()}`;
export const nowIso = (): string => new Date().toISOString();
