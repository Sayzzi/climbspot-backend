import type { HttpModule } from '../../shared/http/http-module.ts';
import type { Database } from '../../shared/infrastructure/database.ts';
import { GetMyAccount } from './application/get-my-account.ts';
import { UpdateMyAccount } from './application/update-my-account.ts';
import { registerAccountsOpenApi } from './http/accounts.openapi.ts';
import { createAccountsRouter } from './http/accounts.router.ts';
import { DrizzleAccountRepository } from './infrastructure/persistence/drizzle-account-repository.ts';

export interface AccountsModuleDependencies {
  readonly db: Database;
}

const basePath = '/me';

export function createAccountsModule({ db }: AccountsModuleDependencies): HttpModule {
  const accounts = new DrizzleAccountRepository(db);
  const getMyAccount = new GetMyAccount(accounts);

  return {
    basePath,
    router: createAccountsRouter({
      getMyAccount,
      updateMyAccount: new UpdateMyAccount(accounts, getMyAccount),
    }),
    registerOpenApi: (registry) => {
      registerAccountsOpenApi(registry, basePath);
    },
  };
}
