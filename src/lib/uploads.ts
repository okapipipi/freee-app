import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];

export async function saveUploadedFile(file: File): Promise<{
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
}> {
  if (file.size > MAX_SIZE) {
    throw new Error("ファイルサイズは10MB以下にしてください");
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("PDF・画像ファイル（JPG/PNG/GIF）のみアップロードできます");
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const ext = path.extname(file.name) || ".bin";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const filePath = path.join(UPLOAD_DIR, uniqueName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  return {
    fileName: file.name,
    filePath,
    mimeType: file.type,
    fileSize: file.size,
  };
}

export async function deleteUploadedFile(filePath: string): Promise<void> {
  await fs.unlink(filePath).catch(() => {});
}
