export class CoordinationError extends Error {
  public constructor(public readonly code: string) {
    super(code);
    this.name = "CoordinationError";
  }
}

export function fail(code: string): never {
  throw new CoordinationError(code);
}
