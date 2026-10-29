import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createTelegramFileImageSource, createWebImageSource, imageMimeFromPath, imageToDataUrl } from "./images";

async function main() {
  assert.equal(imageMimeFromPath("photos/a.PNG"), "image/png");
  assert.equal(imageMimeFromPath("photos/a.webp"), "image/webp");
  assert.equal(imageMimeFromPath("photos/a.jpg"), "image/jpeg");
  assert.equal(imageMimeFromPath("photos/a"), "image/jpeg");

  const bytes = new Uint8Array([1, 2, 3]);
  const calls: string[] = [];
  const source = createTelegramFileImageSource(
    {
      async getFile(fileId) {
        calls.push(`getFile:${fileId}`);
        return { ok: true, value: { filePath: "photos/file_1.png", fileSize: 3 } };
      },
      async downloadFile(path, options) {
        calls.push(`downloadFile:${path}:${options.maxBytes}`);
        return { ok: true, value: bytes };
      },
    },
    { maxBytes: 1234 },
  );

  const loaded = await source.load("file-1");
  assert.ok(loaded.ok);
  assert.deepEqual(calls, ["getFile:file-1", "downloadFile:photos/file_1.png:1234"]);
  assert.equal(loaded.value.mime, "image/png");
  assert.equal(loaded.value.origin, "telegram-file");
  assert.equal(loaded.value.sha256, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(imageToDataUrl(loaded.value), `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`);

  // getFile failure stops before any download.
  const failCalls: string[] = [];
  const failing = createTelegramFileImageSource(
    {
      async getFile() {
        return { ok: false, code: "TG_400" };
      },
      async downloadFile() {
        failCalls.push("downloadFile");
        return { ok: true, value: bytes };
      },
    },
    { maxBytes: 10 },
  );
  assert.deepEqual(await failing.load("x"), { ok: false, code: "TG_400" });
  assert.deepEqual(failCalls, []);

  // downloadFile failure is reported with its code.
  const tooLarge = createTelegramFileImageSource(
    {
      async getFile() {
        return { ok: true, value: { filePath: "photos/f.jpg", fileSize: null } };
      },
      async downloadFile() {
        return { ok: false, code: "TOO_LARGE" };
      },
    },
    { maxBytes: 10 },
  );
  assert.deepEqual(await tooLarge.load("x"), { ok: false, code: "TOO_LARGE" });

  // Web adapter: чужие хосты и не-https отклоняются до сетевого запроса, наружу идёт только безопасный код.
  const web = createWebImageSource({ maxBytes: 1024, isAllowedHost: (host) => host.endsWith(".telesco.pe") });
  assert.deepEqual(await web.load("https://evil.example/pic.jpg"), { ok: false, code: "IMAGE_FETCH_FAILED" });
  assert.deepEqual(await web.load("http://cdn4.telesco.pe/pic.jpg"), { ok: false, code: "IMAGE_FETCH_FAILED" });
  assert.deepEqual(await web.load("https://169.254.169.254/latest/meta-data"), { ok: false, code: "IMAGE_FETCH_FAILED" });
  assert.deepEqual(await web.load("not a url"), { ok: false, code: "IMAGE_FETCH_FAILED" });

  console.log("images tests passed");
}

void main();
