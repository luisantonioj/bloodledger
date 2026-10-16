export class ApiFailure extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    /** Safe field paths and rule names only; never echoes submitted values. */
    readonly details?: { field: string; rule: string }[],
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiFailure";
  }
}

export class WorkerFailure extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "WorkerFailure";
  }
}
