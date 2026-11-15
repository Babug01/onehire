import { execSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL not set: skipping schema sync, the site will show sample posts.");
  process.exit(0);
}

process.env.DIRECT_URL ??= process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
execSync("npx prisma db push --skip-generate", { stdio: "inherit", env: process.env });
