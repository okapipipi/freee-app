import fs from "fs";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";

const FREEE_AUTH_URL =
  "https://accounts.secure.freee.co.jp/public_api/authorize";
const FREEE_TOKEN_URL =
  "https://accounts.secure.freee.co.jp/public_api/token";
const FREEE_API_BASE = "https://api.freee.co.jp";

// ===== OAuth2 =====

export function getFreeeAuthUrl(): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.FREEE_CLIENT_ID!,
    redirect_uri: process.env.FREEE_REDIRECT_URI!,
    prompt: "select_company",
  });
  return `${FREEE_AUTH_URL}?${params}`;
}

export async function exchangeCodeForTokens(code: string) {
  const res = await fetch(FREEE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.FREEE_CLIENT_ID!,
      client_secret: process.env.FREEE_CLIENT_SECRET!,
      code,
      redirect_uri: process.env.FREEE_REDIRECT_URI!,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function refreshAccessToken(): Promise<string> {
  const [config] = await db
    .select()
    .from(schema.freeeConfig)
    .where(eq(schema.freeeConfig.id, "singleton"));
  if (!config?.refreshToken) throw new Error("リフレッシュトークンがありません");

  const res = await fetch(FREEE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.FREEE_CLIENT_ID!,
      client_secret: process.env.FREEE_CLIENT_SECRET!,
      refresh_token: config.refreshToken,
    }),
  });
  if (!res.ok) throw new Error("トークンの更新に失敗しました");

  const data = await res.json();
  await db
    .update(schema.freeeConfig)
    .set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
      updatedAt: new Date(),
    })
    .where(eq(schema.freeeConfig.id, "singleton"));
  return data.access_token;
}

export async function getValidAccessToken(): Promise<string> {
  const [config] = await db
    .select()
    .from(schema.freeeConfig)
    .where(eq(schema.freeeConfig.id, "singleton"));
  if (!config?.accessToken) throw new Error("freeeに接続されていません");

  // 有効期限5分前に自動更新
  if (
    config.tokenExpiresAt &&
    config.tokenExpiresAt.getTime() - 5 * 60 * 1000 < Date.now()
  ) {
    return refreshAccessToken();
  }
  return config.accessToken;
}

// ===== API呼び出し共通 =====

async function fetchFreee(
  path: string,
  options: RequestInit = {}
): Promise<any> {
  const token = await getValidAccessToken();
  const res = await fetch(`${FREEE_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  // 401の場合はトークンを更新してリトライ
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    const retry = await fetch(`${FREEE_API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${newToken}`,
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
    if (!retry.ok) {
      const err = await retry.text();
      throw new Error(`freee API error: ${retry.status} ${err}`);
    }
    return retry.json();
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`freee API error: ${res.status} ${err}`);
  }
  return res.json();
}

export async function freeeApiGet(path: string): Promise<any> {
  return fetchFreee(path);
}

export async function freeeApiPost(path: string, body: object): Promise<any> {
  return fetchFreee(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function freeeApiPut(path: string, body: object): Promise<any> {
  return fetchFreee(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

// ===== マスタデータ同期 =====

export async function syncMasterData(): Promise<Record<string, number>> {
  const [config] = await db
    .select()
    .from(schema.freeeConfig)
    .where(eq(schema.freeeConfig.id, "singleton"));
  if (!config?.companyId) throw new Error("事業所IDが設定されていません");

  const cid = config.companyId;
  const results: Record<string, number> = {};

  // 勘定科目
  const accountData = await freeeApiGet(
    `/api/1/account_items?company_id=${cid}`
  );
  if (accountData.account_items?.length) {
    await db.delete(schema.accountItemCache);
    await db.insert(schema.accountItemCache).values(
      accountData.account_items.map((item: any) => ({
        id: crypto.randomUUID(),
        freeeId: item.id,
        name: item.name,
        shortcut1: item.shortcut1 ?? null,
        shortcut2: item.shortcut2 ?? null,
        category: item.account_category ?? null,
        updatedAt: new Date(),
      }))
    );
    results.accountItems = accountData.account_items.length;
  }

  // 取引先（ページネーション対応）
  let partners: any[] = [];
  let offset = 0;
  while (true) {
    const data = await freeeApiGet(
      `/api/1/partners?company_id=${cid}&limit=100&offset=${offset}`
    );
    if (!data.partners?.length) break;
    partners = [...partners, ...data.partners];
    if (data.partners.length < 100) break;
    offset += 100;
  }
  await db.delete(schema.partnerCache);
  if (partners.length) {
    await db.insert(schema.partnerCache).values(
      partners.map((p: any) => ({
        id: crypto.randomUUID(),
        freeeId: p.id,
        name: p.name,
        updatedAt: new Date(),
      }))
    );
  }
  results.partners = partners.length;

  // メモタグ
  const tagData = await freeeApiGet(`/api/1/tags?company_id=${cid}`);
  if (tagData.tags?.length) {
    await db.delete(schema.memoTagCache);
    await db.insert(schema.memoTagCache).values(
      tagData.tags.map((t: any) => ({
        id: crypto.randomUUID(),
        freeeId: t.id,
        name: t.name,
        updatedAt: new Date(),
      }))
    );
    results.memoTags = tagData.tags.length;

    // 必須メモタグが無ければ自動作成
    const requiredTags = ["販管費振込確認用", "給与振込確認用", "仮"];
    for (const tagName of requiredTags) {
      if (!tagData.tags.some((t: any) => t.name === tagName)) {
        const created = await freeeApiPost(`/api/1/tags`, {
          company_id: cid,
          name: tagName,
        });
        await db.insert(schema.memoTagCache).values({
          id: crypto.randomUUID(),
          freeeId: created.tag.id,
          name: created.tag.name,
          updatedAt: new Date(),
        });
      }
    }
  }

  // 部門タグ
  const sectionData = await freeeApiGet(`/api/1/sections?company_id=${cid}`);
  if (sectionData.sections?.length) {
    await db.delete(schema.sectionCache);
    await db.insert(schema.sectionCache).values(
      sectionData.sections.map((s: any) => ({
        id: crypto.randomUUID(),
        freeeId: s.id,
        name: s.name,
        updatedAt: new Date(),
      }))
    );
    results.sections = sectionData.sections.length;
  }

  // 最終同期日時更新
  await db
    .update(schema.freeeConfig)
    .set({ lastSyncAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.freeeConfig.id, "singleton"));

  return results;
}

// ===== 税区分コード =====

export async function getTaxCodeByName(
  companyId: number,
  name: string
): Promise<number | null> {
  try {
    const data = await freeeApiGet(`/api/1/taxes/codes?company_id=${companyId}`);
    const taxes: { code: number; name: string; name_ja: string }[] = data.taxes ?? [];
    const found = taxes.find(t => t.name_ja === name);
    return found?.code ?? null;
  } catch {
    return null;
  }
}

// ===== 取引登録 =====

export async function createDeal({
  companyId,
  issueDate,
  dueDate,
  type = "expense",
  partnerId,
  details,
}: {
  companyId: number;
  issueDate: string;
  dueDate: string;
  type?: "income" | "expense";
  partnerId?: number | null;
  details: {
    accountItemId: number;
    taxCode: number;
    amount: number;
    sectionId?: number | null;
    tagIds?: number[];
    description?: string;
    receiptIds?: number[];
  }[];
}): Promise<{ deal: { id: number } }> {
  const body: any = {
    company_id: companyId,
    issue_date: issueDate,
    due_date: dueDate,
    type,
    details: details.map(d => ({
      account_item_id: d.accountItemId,
      tax_code: d.taxCode,
      amount: d.amount,
      ...(d.sectionId      ? { section_id: d.sectionId }   : {}),
      ...(d.tagIds?.length  ? { tag_ids: d.tagIds }         : {}),
      ...(d.description    ? { description: d.description } : {}),
      ...(d.receiptIds?.length ? { receipt_ids: d.receiptIds } : {}),
    })),
  };
  if (partnerId) body.partner_id = partnerId;
  return freeeApiPost("/api/1/deals", body);
}

// ===== 取引存在確認 =====

export async function dealExists(companyId: number, dealId: number): Promise<boolean> {
  try {
    await freeeApiGet(`/api/1/deals/${dealId}?company_id=${companyId}`);
    return true;
  } catch (err: any) {
    if (err.message?.includes("404")) return false;
    throw err;
  }
}

// ===== 証憑（添付ファイル）アップロード =====

export async function uploadReceiptToFreee(
  companyId: number,
  filePath: string,
  fileName: string,
  mimeType: string,
): Promise<number> {
  const makeForm = async () => {
    let fileData: ArrayBuffer;
    if (filePath.startsWith("http")) {
      const res = await fetch(filePath);
      fileData = await res.arrayBuffer();
    } else {
      fileData = fs.readFileSync(filePath).buffer as ArrayBuffer;
    }
    const form = new FormData();
    form.append("company_id", String(companyId));
    form.append("receipt", new Blob([fileData], { type: mimeType }), fileName);
    return form;
  };

  const doUpload = async (token: string) => {
    const res = await fetch(`${FREEE_API_BASE}/api/1/receipts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: await makeForm(),
    });
    return res;
  };

  let token = await getValidAccessToken();
  let res = await doUpload(token);

  if (res.status === 401) {
    token = await refreshAccessToken();
    res = await doUpload(token);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`freee証憑アップロードエラー: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.receipt.id as number;
}
