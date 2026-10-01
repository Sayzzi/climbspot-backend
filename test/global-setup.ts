import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import type { TestProject } from 'vitest/node';

import { createDatabase } from '../src/shared/infrastructure/database.ts';
import { withDatabase } from './postgres-url.ts';

// Multi-arch build of the official PostGIS image (the official one has no arm64 variant).
const POSTGIS_IMAGE = 'imresamu/postgis:17-3.5';
const TEMPLATE_DATABASE = 'climbspot_template';

/**
 * Starts one PostGIS server for the whole run and migrates a template database.
 * Each test file then clones the template (see `createTestDatabase`), so files can
 * run in parallel without sharing rows.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const container = await new PostgreSqlContainer(POSTGIS_IMAGE).start();
  const adminUrl = container.getConnectionUri();

  // Created from `template0` so that PostGIS is installed by our migrations only,
  // not pre-enabled by the image, exactly as on Supabase.
  const admin = postgres(adminUrl, { max: 1, onnotice: () => undefined });
  await admin.unsafe(`create database ${TEMPLATE_DATABASE} template template0`);
  await admin.end();

  const template = createDatabase(withDatabase(adminUrl, TEMPLATE_DATABASE));
  await migrate(template.db, { migrationsFolder: 'drizzle' });
  await template.close();

  project.provide('databaseAdminUrl', adminUrl);
  project.provide('databaseTemplate', TEMPLATE_DATABASE);

  return async () => {
    await container.stop();
  };
}
