/**
 * Send a test SMS from Ainee to a phone number (so you can see how it works).
 * POST /api/ghl/send-test-sms — body: { "phone": "6198693700" }
 */
import { NextResponse } from "next/server";
import { upsertContact, sendSms } from "@/lib/ghl";

const LOCATION_ID = process.env.GHL_LOCATION_ID!;
const TEST_MESSAGE = `Hey! This is Ainee with Veteran Career Networks. You asked to see how the SMS works — this is a test from your Ainee setup. If you got this, we're good to go. Reply STOP to unsubscribe. Ainee. Veteran Career Networks.`;

export async function POST(req: Request) {
  if (!LOCATION_ID) {
    return NextResponse.json(
      { error: "Missing GHL_LOCATION_ID in .env.local" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const phone = (body.phone ?? "6198693700").toString().trim();
    if (!phone) {
      return NextResponse.json(
        { error: "Missing phone number. Send body: { \"phone\": \"6198693700\" }" },
        { status: 400 }
      );
    }

    const contactId = await upsertContact(phone, {
      locationId: LOCATION_ID,
      firstName: "Dante",
      lastName: "Test",
    });
    await sendSms(contactId, TEST_MESSAGE, LOCATION_ID);

    return NextResponse.json({
      ok: true,
      message: "Test SMS sent from Ainee to " + phone,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
