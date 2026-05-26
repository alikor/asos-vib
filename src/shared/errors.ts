export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public override readonly cause?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class PoNotFoundError extends AppError {
  constructor(poId: string) {
    super("po_not_found", `No purchase order found for ${poId}`);
  }
}

export class InvalidRequestError extends AppError {
  constructor(message: string) {
    super("invalid_request", message);
  }
}

export class ConcurrencyError extends AppError {
  constructor(streamId: string, expected: number, actual: number) {
    super(
      "concurrency_conflict",
      `Concurrency conflict on stream ${streamId}: expected version ${expected}, got ${actual}`
    );
  }
}
