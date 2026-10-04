import type { HttpModule } from '../../shared/http/http-module.ts';
import type { Database } from '../../shared/infrastructure/database.ts';
import { DeleteMyAccount } from './application/delete-my-account.ts';
import { GetMyAccount } from './application/get-my-account.ts';
import { UpdateMyAccount } from './application/update-my-account.ts';
import type { AccountDirectory } from './domain/account-directory.ts';
import { registerAccountsOpenApi } from './http/accounts.openapi.ts';
import { createAccountsRouter } from './http/accounts.router.ts';
import {
  DrizzleAccountErasure,
  type VisitorDataEraserFor,
} from './infrastructure/persistence/drizzle-account-erasure.ts';
import { DrizzleAccountRepository } from './infrastructure/persistence/drizzle-account-repository.ts';

export type { AccountDirectory } from './domain/account-directory.ts';
export type { VisitorDataEraser } from './domain/visitor-data-eraser.ts';
export type { VisitorDataEraserFor } from './infrastructure/persistence/drizzle-account-erasure.ts';
export { SupabaseAccountDirectory } from './infrastructure/supabase-account-directory.ts';

export interface AccountsModuleDependencies {
  readonly db: Database;
  readonly directory: AccountDirectory;
  /** What other modules keep about a Visitor, erased with their account. */
  readonly erasers: readonly VisitorDataEraserFor[];
}

const basePath = '/me';

export function createAccountsModule({
  db,
  directory,
  erasers,
}: AccountsModuleDependencies): HttpModule {
  const accounts = new DrizzleAccountRepository(db);
  const getMyAccount = new GetMyAccount(accounts);

  return {
    basePath,
    router: createAccountsRouter({
      getMyAccount,
      updateMyAccount: new UpdateMyAccount(accounts, getMyAccount),
      deleteMyAccount: new DeleteMyAccount({
        erasure: new DrizzleAccountErasure(db, erasers),
        directory,
      }),
    }),
    registerOpenApi: (registry) => {
      registerAccountsOpenApi(registry, basePath);
    },
  };
}
