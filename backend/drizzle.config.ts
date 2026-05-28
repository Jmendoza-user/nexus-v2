import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const url =
  process.env.DATABASE_URL ||
  'postgres://nexus_user:nexus_j4_2026@127.0.0.1:5432/nexus_v2';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
