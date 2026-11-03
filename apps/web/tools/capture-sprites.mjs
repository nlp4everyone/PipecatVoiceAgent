#!/usr/bin/env node
// Chụp bộ sprite của avatar từ trang /?avatar-sprites bằng Chrome headless, lưu vào public/avatars/sprites/.
// Cần dev server đang chạy (npm run dev). Dùng: node tools/capture-sprites.mjs [url] [chrome]
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const base = process.argv[2] ?? "http://localhost:5173";
const chrome = process.argv[3] ?? "google-chrome";
const outDir = fileURLToPath(new URL("../public/avatars/sprites/", import.meta.url));
const port = 9333;

const proc = spawn(
  chrome,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    "--user-data-dir=" + fileURLToPath(new URL("../node_modules/.cache/sprite-chrome/", import.meta.url)),
    // Không có GPU thì dùng WebGL phần mềm (SwiftShader); chậm hơn nhưng chụp tĩnh thì không sao.
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--no-first-run",
    "about:blank",
  ],
  { stdio: "ignore" },
);
const stop = () => proc.kill();
process.on("exit", stop);

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function pageTarget() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(base + "/?avatar-sprites")}`, {
        method: "PUT",
      });
      if (res.ok) return await res.json();
    } catch {
      // Chrome chưa sẵn sàng
    }
    await sleep(200);
  }
  throw new Error("không kết nối được Chrome");
}

const target = await pageTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  pending.get(msg.id)?.(msg);
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const n = ++id;
    pending.set(n, resolve);
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
};

try {
  const deadline = Date.now() + 180_000;
  for (;;) {
    if (await evaluate("window.__spritesError")) throw new Error(await evaluate("window.__spritesError"));
    if (await evaluate("window.__spritesDone === true")) break;
    if (Date.now() > deadline) throw new Error("quá thời gian chờ chụp");
    await sleep(500);
  }
  const sprites = JSON.parse(await evaluate("JSON.stringify(window.__sprites)"));
  await mkdir(outDir, { recursive: true });
  for (const [name, dataUrl] of Object.entries(sprites)) {
    const m = /^data:image\/(\w+);base64,(.+)$/.exec(dataUrl);
    if (!m) throw new Error(`${name}: không phải data URL ảnh`);
    if (m[1] !== "webp") throw new Error(`${name}: trình duyệt xuất ${m[1]}, không phải webp`);
    await writeFile(`${outDir}${name}.webp`, Buffer.from(m[2], "base64"));
  }
  console.log(`Đã lưu ${Object.keys(sprites).length} ảnh vào ${outDir}`);
} finally {
  ws.close();
  stop();
}
