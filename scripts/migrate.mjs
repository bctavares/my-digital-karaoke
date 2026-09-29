import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL não configurada.");
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1, prepare: false });

try {
  await sql`
    CREATE TABLE IF NOT EXISTS public.app_migrations (
      id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      filename text NOT NULL UNIQUE,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "drizzle", "migrations");
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const filename of files) {
    const [applied] = await sql`
      SELECT 1 FROM public.app_migrations WHERE filename = ${filename} LIMIT 1
    `;
    if (applied) continue;

    const migration = await readFile(join(migrationsDir, filename), "utf8");
    console.log(`Aplicando migration ${filename}...`);

    await sql.begin(async (tx) => {
      await tx.unsafe(migration);
      await tx`
        INSERT INTO public.app_migrations (filename) VALUES (${filename})
      `;
    });
  }

  console.log("Banco PostgreSQL atualizado.");
} finally {
  await sql.end({ timeout: 5 });
}
