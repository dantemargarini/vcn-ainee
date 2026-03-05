/**
 * Send test convo opener to one or more numbers. Ainee-style message so you can reply and test.
 * POST /api/ghl/send-test-convo — body: { "phones": ["6197918675", "6198693700"] }
 */
import { NextResponse } from "next/server";
import { upsertContact, getContact, sendSms } from "@/lib/ghl";

const LOCATION_ID = process.env.GHL_LOCATION_ID!;

function buildOpener(firstName?: string | null): string {
  const name = firstName?.trim() || "there";
  return `Hey ${name}, this is Ainee with Veteran Career Networks. You requested information about our cybersecurity training program for Veterans.

Are you currently using your Post-9/11 GI Bill benefits?


Best,
Ainee
Veteran Careers Network
Veteran-Owned Business
Reply STOP to unsubscribe.`;
}

const DEFAULT_PHONES = ["6197918675", "6198693700"];

async function sendToPhones(phones: string[]) {
  const results: { phone: string; ok: boolean; error?: string }[] = [];
  for (const phone of phones) {
    try {
      const contactId = await upsertContact(phone, {
        locationId: LOCATION_ID,
        firstName: "Test",
        lastName: "Lead",
      });
      const contact = await getContact(contactId, LOCATION_ID);
      const firstName = (contact as { firstName?: string })?.firstName;
      const message = buildOpener(firstName);
      const smsResponse = await sendSms(contactId, message, LOCATION_ID);
      results.push({ phone, ok: true, ghl_response: smsResponse });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      results.push({ phone, ok: false, error: err });
    }
  }
  return results;
}

/** GET = same as POST with default phones (open in browser to text both numbers). */
export async function GET() {
  if (!LOCATION_ID) {
    return NextResponse.json(
      { error: "Missing GHL_LOCATION_ID" },
      { status: 500 }
    );
  }
  try {
    const results = await sendToPhones(DEFAULT_PHONES);
    return NextResponse.json({
      ok: results.every((r) => r.ok),
      sent: results.filter((r) => r.ok).length,
      results,
      message: "Test convo opener sent to " + DEFAULT_PHONES.join(" and "),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!LOCATION_ID) {
    return NextResponse.json(
      { error: "Missing GHL_LOCATION_ID in .env.local" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const phones = body.phones ?? ["6197918675", "6198693700"];
    const list = Array.isArray(phones) ? phones : [phones].map(String);
    const trimmed = list.map((p: string) => p.toString().trim()).filter(Boolean);

    if (trimmed.length === 0) {
      return NextResponse.json(
        { error: "Send body: { \"phones\": [\"6197918675\", \"6198693700\"] }" },
        { status: 400 }
      );
    }

    const results = await sendToPhones(trimmed);

    return NextResponse.json({
      ok: results.every((r) => r.ok),
      sent: results.filter((r) => r.ok).length,
      results,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
