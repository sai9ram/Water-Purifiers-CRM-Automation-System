import path from 'path';
import { execSync } from 'child_process';
import EmbeddedPostgres from 'embedded-postgres';

const PG_PORT = 54329;
const PG_USER = 'postgres';
const PG_PASS = 'postgres';
const DEV_DB = 'pure_home_waters';
const TEST_DB = 'pure_home_waters_test';

async function main() {
  const dataDir = path.resolve(process.cwd(), '.pgdata', 'dev-cluster');
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: PG_USER,
    password: PG_PASS,
    port: PG_PORT,
    persistent: true
  });

  try {
    await pg.initialise();
  } catch {
    // Already initialized
  }

  await pg.start();

  for (const dbName of [DEV_DB, TEST_DB]) {
    try {
      await pg.createDatabase(dbName);
    } catch {
      // Database already exists
    }
  }

  const devUrl = `postgresql://${PG_USER}:${PG_PASS}@127.0.0.1:${PG_PORT}/${DEV_DB}?schema=public`;
  const testUrl = `postgresql://${PG_USER}:${PG_PASS}@127.0.0.1:${PG_PORT}/${TEST_DB}?schema=public`;

  console.log('PostgreSQL running at:', devUrl);

  execSync('npx prisma migrate dev --name init_schema --skip-seed', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: devUrl
    }
  });

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: testUrl
    }
  });

  await pg.stop();
  console.log('Migrations generated and applied to dev + test PostgreSQL databases.');
  process.exit(0);
}

main().catch(err => {
  console.error('Failed to setup local PostgreSQL:', err);
  process.exit(1);
});
