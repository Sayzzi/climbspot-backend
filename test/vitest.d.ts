declare module 'vitest' {
  export interface ProvidedContext {
    databaseAdminUrl: string;
    databaseTemplate: string;
  }
}

export {};
