import { Router } from 'express';

import { signedInVisitor } from '../../../shared/http/identity.ts';
import type { GetMyAccount } from '../application/get-my-account.ts';
import type { UpdateMyAccount } from '../application/update-my-account.ts';
import { accountChangesSchema, toAccountResponse } from './account.schemas.ts';

export interface AccountsRouterDependencies {
  readonly getMyAccount: GetMyAccount;
  readonly updateMyAccount: UpdateMyAccount;
}

export function createAccountsRouter({
  getMyAccount,
  updateMyAccount,
}: AccountsRouterDependencies): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    res.json(toAccountResponse(await getMyAccount.execute(signedInVisitor(res))));
  });

  router.patch('/', async (req, res) => {
    const identity = signedInVisitor(res);
    const { displayName, flatPace } = accountChangesSchema.parse(req.body);
    const account = await updateMyAccount.execute(identity, {
      ...(displayName !== undefined && { displayName }),
      ...(flatPace !== undefined && { flatPace }),
    });
    res.json(toAccountResponse(account));
  });

  return router;
}
