import { put, del } from "@vercel/blob";
import path from "path";

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

  const ext = path.extname(file.name) || ".bin";
  const uniqueName = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

  const blob = await put(uniqueName, file, {
    access: "public",
    contentType: file.type,
  });

  return {
    fileName: file.name,
    filePath: blob.url,
    mimeType: file.type,
    fileSize: file.size,
  };
}

export async function deleteUploadedFile(filePath: string): Promise<void> {
  await del(filePath).catch(() => {});
}
