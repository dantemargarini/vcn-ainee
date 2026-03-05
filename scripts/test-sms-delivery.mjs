#!/usr/bin/env node
/**
 * Test SMS delivery via GHL API. Loads .env.local and sends test messages.
 * Run: node scripts/test-sms-delivery.mjs           → sends to BOTH 6197918675 and 6198693700
 * Run: node scripts/test-sms-delivery.mjs 6197918675  → sends to one number only
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const DEFAULT_PHONES = ["6197918675", "6198693700"];

function loadEnv() {
  const path = resolve(root, ".env.local");
  const content = readFileSync(path, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const API_KEY = env.GHL_API_KEY;
const LOCATION_ID = env.GHL_LOCATION_ID;
const BASE = "https://services.leadconnectorhq.com";
const phones = process.argv.length > 2
  ? process.argv.slice(2)
  : DEFAULT_PHONES;

if (!API_KEY || !LOCATION_ID) {
  console.error("Missing GHL_API_KEY or GHL_LOCATION_ID in .env.local");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
  "Version": "2021-07-28",
  "Location-Id": LOCATION_ID,
};

function normalize(phone) {
  const p = String(phone).trim();
  const digits = p.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return p.startsWith("+") ? p : `+${p}`;
}

const TEST_MSG = `[Delivery test] Hey, this is Ainee with VCN. If you get this, delivery is working. Reply STOP to opt out.`;

async function sendToOne(normalizedPhone) {
  console.log("\n---", normalizedPhone, "---");
  console.log("1. Upserting contact:", normalizedPhone);
  const upsertRes = await fetch(`${BASE}/contacts/upsert`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      locationId: LOCATION_ID,
      phone: normalizedPhone,
      firstName: "Test",
      lastName: "Delivery",
    }),
  });
  const upsertData = await upsertRes.json().catch(() => ({}));
  console.log("   Status:", upsertRes.status);
  const contactId = upsertData.contact?.id ?? upsertData.contactId ?? upsertData.id;
  if (!contactId) {
    console.error("   No contact id — skipping.");
    return { phone: normalizedPhone, ok: false };
  }
  console.log("   Contact ID:", contactId);

  console.log("2. Sending SMS...");
  const smsRes = await fetch(`${BASE}/conversations/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      contactId,
      type: "SMS",
      message: TEST_MSG,
    }),
  });
  const smsData = await smsRes.json().catch(() => ({}));
  console.log("   Status:", smsRes.status, smsRes.ok ? "✓" : "✗");
  if (!smsRes.ok) console.log("   Error:", smsData.message || smsData.error || smsData);
  return { phone: normalizedPhone, ok: smsRes.ok, contactId, smsData };
}

async function main() {
  console.log("Sending test SMS to:", phones.join(", "));
  const results = [];
  for (const p of phones) {
    const normalized = normalize(p);
    results.push(await sendToOne(normalized));
  }
  console.log("\n--- Done ---");
  const ok = results.filter((r) => r.ok).length;
  console.log(ok === results.length
    ? `✓ GHL accepted all ${results.length} message(s). Check both phones and GHL Conversations.`
    : `${ok}/${results.length} accepted. Check errors above.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
