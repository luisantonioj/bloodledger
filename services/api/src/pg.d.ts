declare module "pg" {
  export interface QueryResult<R = Record<string, unknown>> {
    rowCount: number | null;
    rows: R[];
  }
  export interface PoolClient {
    query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
    release(): void;
  }
  export class Pool {
    constructor(config?: Record<string, unknown>);
    query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }
}
