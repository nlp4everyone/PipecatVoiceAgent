#!/usr/bin/env node
// Đặt tên model avatar theo nội dung (bước 4.6.4.2) để server có thể gửi `Cache-Control: immutable`.
// Dùng:
//   node tools/hash-avatar.mjs public/avatars/AvatarSample_E.web.vrm   # sao chép sang ...web.<hash8>.vrm, in URL
//   node tools/hash-avatar.mjs --check                                  # VITE_AVATAR_URL (.env.local) có đúng hash không
// Không ghi đè file gốc. Đổi nội dung model thì chạy lại và cập nhật VITE_AVATAR_URL theo URL được in ra.
import { createHash } from "node:crypto";
import { copyFile, readFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const HASHED = /\.[0-9a-f]{8}\.vrm$/;

const hash8 = async (file) => createHash("sha256").update(await readFile(file)).digest("hex").slice(0, 8);
const hashedName = (name, h) => name.replace(/\.vrm$/, `.${h}.vrm`);

async function envAvatarUrl() {
  try {
    const text = await readFile(join(root, ".env.local"), "utf8");
    return text.match(/^VITE_AVATAR_URL=(.+)$/m)?.[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

const arg = process.argv[2];
if (!arg) {
  console.error("Thiếu đường dẫn file .vrm hoặc --check");
  process.exit(2);
}

if (arg === "--check") {
  const url = await envAvatarUrl();
  if (!url) {
    console.error("Không thấy VITE_AVATAR_URL trong .env.local");
    process.exit(1);
  }
  const file = join(root, "public", url.replace(/^\//, ""));
  if (!HASHED.test(url)) {
    console.error(`URL chưa có hash trong tên: ${url}`);
    process.exit(1);
  }
  const expected = hashedName(basename(url).replace(HASHED, ".vrm"), await hash8(file));
  if (basename(url) !== expected) {
    console.error(`Hash không khớp nội dung.\n  đang đặt: ${basename(url)}\n  đúng là:  ${expected}`);
    process.exit(1);
  }
  console.log(`OK: ${url}`);
} else {
  if (HASHED.test(arg)) {
    console.error("File này đã có hash trong tên; đưa vào file gốc chưa có hash.");
    process.exit(2);
  }
  const h = await hash8(arg);
  const dest = resolve(dirname(arg), hashedName(basename(arg), h));
  await copyFile(arg, dest);
  const rel = dest.split("/public/")[1];
  if (!rel) {
    console.error(`Đã tạo ${dest}, nhưng file không nằm dưới thư mục public/ nên không suy ra được URL.`);
    process.exit(1);
  }
  console.log(`Đã tạo ${dest}\nĐặt: VITE_AVATAR_URL=/${rel}`);
}
