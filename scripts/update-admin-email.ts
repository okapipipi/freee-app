import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

async function main() {
  const dbPath = path.resolve(process.cwd(), "dev.db");
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });

  const mod = await import("../src/generated/prisma/client.ts");
  const prisma = new mod.PrismaClient({ adapter });

  try {
    const updated = await prisma.user.update({
      where: { email: "admin@example.com" },
      data:  { email: "r.okabe@digi-man.com" },
    });
    console.log("メールアドレスを更新しました:", updated.email);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
