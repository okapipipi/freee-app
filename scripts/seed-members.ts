import "dotenv/config";
import { hashSync } from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const PASSWORD = "digiman1007";

// メールアドレスは推測のため、正確なものはユーザー管理画面で修正してください
// sortOrder: 指定しない場合は 9999（登録日時順で末尾）
const MEMBERS: { name: string; email: string; role: string; sortOrder?: number }[] = [
  // 経営陣・管理者（岡部りさ=1 の直下）
  { name: "安達 昭典",   email: "a.adachi@digi-man.com",   role: "executive", sortOrder: 2 },
  { name: "海老根 涼太", email: "r.ebine@digi-man.com",    role: "executive", sortOrder: 3 },
  // 社員
  { name: "常田 夏生",   email: "n.tsuneda@digi-man.com",  role: "executive" },
  { name: "増谷 大輔",   email: "d.masutani@digi-man.com", role: "executive" },
  { name: "小甲 陽平",   email: "y.kokamo@digi-man.com",   role: "employee" },
  { name: "菊池 幸平",   email: "k.kikuchi@digi-man.com",  role: "executive" },
  { name: "三善 一樹",   email: "k.miyoshi@digi-man.com",  role: "employee" },
  { name: "秋元 崇利",   email: "t.akimoto@digi-man.com",  role: "employee" },
  { name: "轟 玲音",     email: "r.todoroki@digi-man.com", role: "employee" },
  { name: "松居 和輝",   email: "k.matsui@digi-man.com",   role: "employee" },
  { name: "堺 敏寿",     email: "t.sakai@digi-man.com",    role: "employee" },
  { name: "坪井 秀斗",   email: "h.tsuboi@digi-man.com",   role: "employee" },
  { name: "川野 透也",   email: "t.kawano@digi-man.com",   role: "employee" },
  { name: "中村 凌",     email: "r.nakamura@digi-man.com", role: "employee" },
  { name: "山内 菜海",   email: "n.yamauchi@digi-man.com", role: "employee" },
  { name: "池田 愛",     email: "a.ikeda@digi-man.com",    role: "employee" },
  { name: "生井 響",     email: "h.namai@digi-man.com",    role: "employee" },
  { name: "野口 純",     email: "j.noguchi@digi-man.com",  role: "employee" },
  { name: "清水 陸斗",   email: "r.shimizu@digi-man.com",  role: "employee" },
  { name: "中村 峻也",   email: "s.nakamura@digi-man.com", role: "employee" },
  // インターン
  { name: "渡邉 空",     email: "s.watanabe@digi-man.com",  role: "intern" },
  { name: "河村 英洋",   email: "h.kawamura@digi-man.com",  role: "intern" },
  { name: "末武 美宝",   email: "m.suetake@digi-man.com",   role: "intern" },
  { name: "川上 健斗",   email: "k.kawakami@digi-man.com",  role: "intern" },
  { name: "宮城 一平",   email: "i.miyagi@digi-man.com",    role: "intern" },
  { name: "堀切 友世",   email: "t.horikiri@digi-man.com",  role: "intern" },
  { name: "笹田 怜央",   email: "r.sasada@digi-man.com",    role: "intern" },
  { name: "石津 大樹",   email: "d.ishizu@digi-man.com",    role: "intern" },
  { name: "田中 克樹",   email: "k.tanaka@digi-man.com",    role: "intern" },
  { name: "渡辺 羽菜",   email: "h.watanabe@digi-man.com",  role: "intern" },
  { name: "中村 優来",   email: "y.nakamura@digi-man.com",  role: "intern" },
  { name: "杉山 丈太郎", email: "j.sugiyama@digi-man.com",  role: "intern" },
  { name: "村松 和哉",   email: "k.muramatsu@digi-man.com", role: "intern" },
];

async function main() {
  const dbPath = path.resolve(process.cwd(), "dev.db");
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
  const mod = await import("../src/generated/prisma/client.ts");
  const prisma = new mod.PrismaClient({ adapter });

  try {
    for (const m of MEMBERS) {
      const user = await prisma.user.upsert({
        where:  { email: m.email },
        update: {
          name: m.name,
          role: m.role,
          ...(m.sortOrder !== undefined && { sortOrder: m.sortOrder }),
        },
        create: {
          email:              m.email,
          name:               m.name,
          role:               m.role,
          passwordHash:       hashSync(PASSWORD, 10),
          mustChangePassword: true,
          sortOrder:          m.sortOrder ?? 9999,
        },
      });
      console.log(`✓ ${user.name.padEnd(10)} ${user.email}`);
    }
    console.log(`\n合計 ${MEMBERS.length} 名を登録しました。`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
