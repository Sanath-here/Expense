import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as dotenv from "dotenv";

dotenv.config({
  path: ".env.local",
});

export const main = async () => {
  const migrationClient = postgres(process.env.MIGRATION_DATABASE_URL!, {
    ssl: "require",
    max: 1,
  });

  try {
    await migrate(drizzle(migrationClient), {
      migrationsFolder: "drizzle",
    });
    console.log("Migration complete");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await migrationClient.end();
  }
};

main();
