import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | null = null;

function getConnectionString() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL não configurada");
  }
  return connectionString;
}

export function getSql() {
  if (!client) {
    client = postgres(getConnectionString(), {
      max: Number(process.env.DB_POOL_SIZE ?? 10),
      prepare: false,
    });
  }
  return client;
}

export function getDb() {
  return drizzle(getSql(), { schema });
}
