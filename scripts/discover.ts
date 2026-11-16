import { PrismaClient } from "@prisma/client";
import { discoverCareerSites } from "../src/lib/discover";

process.env.DIRECT_URL ??= process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const db = new PrismaClient();

discoverCareerSites(db, (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`))
  .then((result) => console.log(JSON.stringify(result)))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
