/**
 * Isolated SMS.BY test script.
 * Run: npx ts-node --project tsconfig.scripts.json scripts/manual-tests/test-sms-by.ts
 * Or:  npx tsx scripts/manual-tests/test-sms-by.ts
 *
 * Set TEST_PHONE env var to your real number, e.g.:
 *   TEST_PHONE=375447777405 npx tsx scripts/manual-tests/test-sms-by.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const TOKEN = process.env.SMS_BY_TOKEN;
const BASE_URL = process.env.SMS_BY_BASE_URL ?? "https://app.sms.by";
const TEST_PHONE = process.env.TEST_PHONE ?? "375447777405"; // override via env

async function main() {
  console.log("=== SMS.BY Test ===");
  console.log("Base URL:", BASE_URL);
  console.log("Token present:", !!TOKEN, TOKEN ? `(${TOKEN.slice(0, 6)}...)` : "MISSING");
  console.log("Target phone:", TEST_PHONE);
  console.log("");

  if (!TOKEN) {
    console.error("ERROR: SMS_BY_TOKEN is not set in .env.local");
    process.exit(1);
  }

  // --- Test 1: URL-encoded form (current implementation) ---
  console.log("--- Test 1: application/x-www-form-urlencoded ---");
  await testFormEncoded(TOKEN, BASE_URL, TEST_PHONE);

  // --- Test 2: JSON body ---
  console.log("\n--- Test 2: application/json ---");
  await testJson(TOKEN, BASE_URL, TEST_PHONE);
}

async function testFormEncoded(token: string, baseUrl: string, phone: string) {
  const url = `${baseUrl}/api/v1/sendQuickSms`;
  const body = new URLSearchParams({
    token,
    phone,
    message: "mamaGo test: 1234",
    alphaname_id: "4720",
  });

  console.log("URL:", url);
  console.log("Body:", body.toString().replace(token, token.slice(0, 6) + "..."));

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body,
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
    try { console.log("Parsed:", JSON.parse(text)); } catch { /* not JSON */ }
  } catch (e) {
    console.error("Fetch error:", e);
  }
}

async function testJson(token: string, baseUrl: string, phone: string) {
  const url = `${baseUrl}/api/v1/sendQuickSms`;
  const payload = { token, phone, message: "mamaGo test: 1234" };

  console.log("URL:", url);
  console.log("Body:", JSON.stringify({ ...payload, token: token.slice(0, 6) + "..." }));

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
    try { console.log("Parsed:", JSON.parse(text)); } catch { /* not JSON */ }
  } catch (e) {
    console.error("Fetch error:", e);
  }
}

main().catch(console.error);
