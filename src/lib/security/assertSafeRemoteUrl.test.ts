import assert from "node:assert/strict";
import { assertSafeRemoteUrl } from "./assertSafeRemoteUrl";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function expectThrow(name: string, url: string) {
  test(name, () => {
    assert.throws(
      () => assertSafeRemoteUrl(url),
      { message: "Unsafe remote URL" },
    );
  });
}

function expectPass(name: string, url: string) {
  test(name, () => {
    const result = assertSafeRemoteUrl(url);
    assert.ok(result instanceof URL, "Should return a URL object");
  });
}

console.log("\nassertSafeRemoteUrl tests\n");

// ─── Valid URLs ──────────────────────────────────────────────────────────────

expectPass("allows cdninstagram.com URLs", "https://scontent-arn2-1.cdninstagram.com/v/t51.2885-19/123.jpg");

expectPass("allows fbcdn.net URLs", "https://scontent.frix1-1.fna.fbcdn.net/v/t1.6435-9/123.jpg");

expectPass("allows instagram.com main domain", "https://www.instagram.com/p/ABC123/media");

expectPass("allows subdomain of cdninstagram.com", "https://video-arn2-1.cdninstagram.com/v/123.mp4");

expectPass("allows deep subdomain of cdninstagram.com", "https://a.b.c.d.e.cdninstagram.com/image.jpg");

expectPass("allows instagram.com with path and query", "https://www.instagram.com/p/ABC123/?utm_source=test");

// ─── Rejected: localhost / loopback ─────────────────────────────────────────

expectThrow("rejects localhost", "https://localhost:3000/image.jpg");

expectThrow("rejects 127.0.0.1", "https://127.0.0.1/image.jpg");

expectThrow("rejects 127.0.0.2", "https://127.0.0.2/image.jpg");

// ─── Rejected: cloud metadata ────────────────────────────────────────────────

expectThrow("rejects 169.254.169.254 (AWS/GCP metadata)", "https://169.254.169.254/latest/meta-data/");

expectThrow("rejects metadata.google.internal", "https://metadata.google.internal/computeMetadata/v1/");

// ─── Rejected: private IP ranges ─────────────────────────────────────────────

expectThrow("rejects 10.x.x.x", "https://10.0.0.1/image.jpg");

expectThrow("rejects 172.16.x.x", "https://172.16.0.1/image.jpg");

expectThrow("rejects 172.31.x.x", "https://172.31.255.255/image.jpg");

expectThrow("rejects 192.168.x.x", "https://192.168.1.1/image.jpg");

// ─── Rejected: protocol ──────────────────────────────────────────────────────

expectThrow("rejects http://", "http://cdninstagram.com/image.jpg");

expectThrow("rejects ftp://", "ftp://cdninstagram.com/image.jpg");

// ─── Rejected: untrusted hostnames ───────────────────────────────────────────

expectThrow("rejects random evil.com", "https://evil.com/malware.jpg");

expectThrow("rejects attacker-controlled domain", "https://malicious-site.ru/image.jpg");

expectThrow("rejects public DNS IP (8.8.8.8)", "https://8.8.8.8/image.jpg");

expectThrow("rejects subdomain of untrusted domain", "https://cdn.evil.com/image.jpg");

// ─── Rejected: edge cases ────────────────────────────────────────────────────

expectThrow("rejects empty string", "");

expectThrow("rejects whitespace-only string", "   ");

expectThrow("rejects invalid URL", "not-a-url");

expectThrow("rejects IPv6 loopback", "https://[::1]/image.jpg");

expectThrow("rejects IPv6 link-local", "https://[fe80::1]/image.jpg");

expectThrow("rejects 0.0.0.0", "https://0.0.0.0/image.jpg");

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}