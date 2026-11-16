import { PrismaClient } from "@prisma/client";
import { ingestJobs } from "../src/lib/ingest";

process.env.DIRECT_URL ??= process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const db = new PrismaClient();

ingestJobs(db)
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
