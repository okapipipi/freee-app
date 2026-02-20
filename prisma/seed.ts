import "dotenv/config";
import { hashSync } from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

async function main() {
  const dbPath = path.resolve(process.cwd(), "dev.db");
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });

  const mod = await import("../src/generated/prisma/client.ts");
  const prisma = new mod.PrismaClient({ adapter });

  try {
    const admin = await prisma.user.upsert({
      where: { email: "r.okabe@digi-man.com" },
      update: { sortOrder: 1 },
      create: {
        email: "r.okabe@digi-man.com",
        passwordHash: hashSync("admin123", 10),
        name: "岡部",
        role: "admin",
        sortOrder: 1,
      },
    });
    console.log("管理者アカウント作成:", admin.email);

    await prisma.freeeConfig.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });
    console.log("freee設定初期化完了");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
