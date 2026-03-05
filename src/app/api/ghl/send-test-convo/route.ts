/**
 * Send test convo opener to one or more numbers. Ainee-style message so you can reply and test.
 * POST /api/ghl/send-test-convo — body: { "phones": ["6197918675", "6198693700"] }
 */
import { NextResponse } from "next/server";
import { upsertContact, sendSms } from "@/lib/ghl";

const LOCATION_ID = process.env.GHL_LOCATION_ID!;

const TEST_CONVO_OPENER = `Hey there! This is Ainee with Veteran Career Networks. You asked about our cybersecurity program for veterans, so I wanted to reach out. You could be earning $80K to $120K in a remote role within 6 months using benefits you have already earned. What would be most useful for you to know first, the GI Bill side, the timeline, or what the day to day looks like? Ainee. Veteran Career Networks. Reply STOP to unsubscribe.`;

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
      await sendSms(contactId, TEST_CONVO_OPENER, LOCATION_ID);
      results.push({ phone, ok: true });
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
