"use strict";

// TODO:
// 期限切れのデータとファイルの削除を日毎に行うスクリプトを作成する

// メモ:
// ダウンロード機能がまだできていない

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Busboy = require("busboy");

const PORT = 8000;
// const HOST = "localhost";

const UPLOAD_DIR = path.join(__dirname, "upload");

// 32文字のランダム英数字（a-zA-Z0-9）
function randomAlphaNum32() {
  // 32 chars from base62
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(32);
  let out = "";
  for (let i = 0; i < 32; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function sendJson(res, statusCode, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function isEmpty(obj) {
  return Object.keys(obj).length === 0;
}

function loadMap(filename = "map.json") {
  const filePath = path.join(__dirname, "data", filename);
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const data = fs.readFileSync(filePath, "utf-8");
  if (!data.trim()) {
    return {};
  }
  return JSON.parse(data);
}

function saveMap(mapData, filename = "map.json") {
  const filePath = path.join(__dirname, "data", filename);
  const json = JSON.stringify(mapData, null, 4);
  fs.writeFileSync(filePath, json, "utf-8");
}

function isExpired(entry) {
  // expires_at が「秒」か「ミリ秒」か混在していても対応
  const raw = entry?.expires_at;
  if (typeof raw !== "number") return false; // expires_at が無いなら期限チェックしない方針
  const expMs = raw < 10_000_000_000 ? raw * 1000 : raw; // 10桁未満なら秒扱い
  return Date.now() > expMs;
}

async function downloadByCode(res, code) {
  const map = await loadMap();

  const entry = map[code];
  if (!entry) {
    sendJson(res, 404, { error: "code_not_found" });
    return;
  }

  if (isExpired(entry)) {
    sendJson(res, 410, { error: "expired" }); // Gone
    return;
  }

  const stored = entry.stored_name;
  const original = entry.original_name || stored;
  const mime = entry.mime || "application/octet-stream";

  if (typeof stored !== "string" || stored.length === 0) {
    sendJson(res, 500, { error: "invalid_map_entry" });
    return;
  }

  // パストラバーサル対策：basename化
  const safeStored = path.basename(stored);
  const filePath = path.join(UPLOAD_DIR, safeStored);

  let stat;
  try {
    stat = await fsp.stat(filePath);
    if (!stat.isFile()) throw new Error("not a file");
  } catch {
    sendJson(res, 404, { error: "file_missing" });
    return;
  }

  // pipeを使わずに読み出して返す（サイズが大きいとメモリ負荷が出ます）
  const buf = await fsp.readFile(filePath);

  res.writeHead(200, {
    "Content-Type": mime,
    "Content-Length": buf.length,
    "Content-Disposition": contentDispositionFilename(original),
    "Cache-Control": "no-store",
  });
  res.end(buf);
}

function contentDispositionFilename(filename) {
  // 日本語ファイル名対策：filename* を付ける
  const encoded = encodeURIComponent(filename)
    .replace(/['()]/g, escape)
    .replace(/\*/g, "%2A");
  return `attachment; filename="${filename.replace(/"/g, "")}"; filename*=UTF-8''${encoded}`;
}

function secureRandom6Digit() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (array[0] % 1000000).toString().padStart(6, "0");
}

function sanitizeCode(code) {
  // 6桁のみ許可
  if (typeof code !== "string") return null;
  if (!/^\d{6}$/.test(code)) return null;
  return code;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || HOST}`);


  // ダウンロードテスト
  if (req.method === "GET" && url.pathname === "/download") {

    const params = url.searchParams;
    const code = params.get("code");

    const map = loadMap();
    const fileData = map[code];

    if(!fileData){
      return sendJson(res, 404,{ error: "コードが存在しません" });
    }

    const imagePath = path.join(__dirname, "upload", fileData.stored_name);
    const fileName = fileData.original_name;
    const safeFileName = encodeURIComponent(fileName);

    fs.stat(imagePath, (error, stats) => {
      if (error || !stats.isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("File not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": stats.size,
        "Content-Disposition": `attachment; filename=${safeFileName}; filename*=UTF-8''${safeFileName}`,
      });
      const stream = fs.createReadStream(imagePath);
      stream.pipe(res);

      stream.on("error", (streamError) => {
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        }
        res.end("Internal Server Error");
      });
    });
    return;
  }

  // POST / upload だけ処理
  if (req.method === "POST" && url.pathname === "/upload") {
    ensureUploadDir();

    const contentType = req.headers["content-type"] || "";
    if (!contentType.startsWith("multipart/form-data")) {
      return sendJson(res, 400, { error: "Expected multipart/form-data" });
    }

    const bb = Busboy({ headers: req.headers });

    let savedName = null;
    let fileReceived = false;
    const keyNumber = secureRandom6Digit();

    // busboyがファイル検出したとき
    bb.on("file", (fieldname, file, info) => {
      fileReceived = true;

      const originalName =
        Buffer.from(info.filename, "latin1").toString("utf8") || "";
      const mimeType = info.mimeType || "";
      let fileSize = 0;
      const ext = path.extname(originalName);

      const randomName = randomAlphaNum32();
      savedName = ext ? randomName + ext : randomName;

      const savePath = path.join(UPLOAD_DIR, savedName);

      const chunks = [];

      file.on("data", (data) => {
        fileSize = fileSize + data.length;
        chunks.push(data);
      });

      file.on("end", () => {
        const buffer = Buffer.concat(chunks);

        fs.writeFile(savePath, buffer, (err) => {
          if (err) {
            return sendJson(res, 500, { error: "保存失敗" });
          }

          // データを保存する
          const now = new Date();
          const after24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

          let map = loadMap();
          map[keyNumber] = {
            original_name: originalName,
            stored_name: savedName,
            size: fileSize,
            mime: mimeType,
            created_at: now.getTime(),
            expires_at: after24h.getTime(),
          };
          saveMap(map);
        });
      });

      file.on("error", () => {
        return sendJson(res, 500, { error: "アップロードエラー" });
      });
    });
    bb.on("finish", () => {
      if (!fileReceived || !savedName) {
        return sendJson(res, 400, { error: "ファイル未受信" });
      }

      // 拡張子除いた部分を共有コードにする
      return sendJson(res, 200, {
        code: keyNumber,
      });
    });

    req.pipe(bb);
    return;
  }

  // if (req.method === "GET" && url.pathname === "/download") {
  //   const code = sanitizeCode(url.searchParams.get("code"));
  //   if (!code) {
  //     sendJson(res, 400, { error: "invalid_code" });
  //     return;
  //   }
  //   await downloadByCode(res, code);
  //   return;
  // }

  // publicフォルダを基準にする
  let filePath = path.join(
    __dirname,
    "public",
    url.pathname === "/" ? "index.html" : req.url,
  );

  // 拡張子取得
  const ext = path.extname(filePath);

  // Content-Type判定
  let contentType = "text/html; charset=utf-8";
  if (ext === ".css") contentType = "text/css";
  if (ext === ".js") contentType = "application/javascript";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
