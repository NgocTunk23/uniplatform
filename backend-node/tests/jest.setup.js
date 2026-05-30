/**
 * Jest safety setup — runs (via `setupFiles`) BEFORE each test file imports
 * `src/config/prisma`, so it controls which database Prisma connects to.
 *
 * Why this exists: tests call `prisma.*.deleteMany({})` to clean state. Prisma's
 * datasource is `env("MONGO_URI")`. If that points at a real/remote database,
 * running the suite WIPES production data. (This happened once against Atlas.)
 *
 * Two layers of protection:
 *   1. Force MONGO_URI to a dedicated LOCAL test database.
 *   2. Hard-abort the whole run if MONGO_URI somehow still points at a remote/
 *      Atlas host — even if someone overrides it.
 */

const DEFAULT_TEST_MONGO_URI =
  'mongodb://root:password@127.0.0.1:27017/uniplatform_test'
  + '?authSource=admin&replicaSet=rs0&directConnection=true';

// Layer 1: force tests onto the local test DB (TEST_MONGO_URI may override, but
// it still has to pass the guard below).
process.env.MONGO_URI = process.env.TEST_MONGO_URI || DEFAULT_TEST_MONGO_URI;

// Layer 2: refuse to run against anything that is not an explicitly-local host.
const uri = String(process.env.MONGO_URI || '');

const isRemote =
  uri.includes('mongodb+srv') ||
  /mongodb\.net/i.test(uri) ||
  // any host that is not loopback/local
  !/@?(127\.0\.0\.1|localhost|mongodb)(:|\/|$)/i.test(uri);

const looksLikeProdDbName = /\/uniplatform_db(\?|$)/i.test(uri);

if (isRemote || looksLikeProdDbName) {
  // eslint-disable-next-line no-console
  console.error(
    '\n\x1b[31m[jest.setup] ABORTING: tests must not run against a remote/production database.\x1b[0m\n'
    + `Resolved MONGO_URI host is not a local test database: ${uri.replace(/:\/\/[^@]*@/, '://****@')}\n`
    + `Tests are restricted to a local DB (default: ${DEFAULT_TEST_MONGO_URI.replace(/:\/\/[^@]*@/, '://****@')}).\n`,
  );
  throw new Error('Refusing to run tests against a non-local MONGO_URI (data-loss guard).');
}
