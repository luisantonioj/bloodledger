declare module "pg" {
  import type { EventEmitter } from "node:events";
  export interface QueryResult<R = Record<string, unknown>> {
    rowCount: number | null;
    rows: R[];
  }
  export interface PoolClient extends EventEmitter {
    query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
    release(): void;
  }
  export class Pool extends EventEmitter {
    constructor(config?: Record<string, unknown>);
    query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }
}
