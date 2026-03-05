/**
 * Test endpoint: generate Ainee's reply given a conversation and optional lead context.
 * POST /api/ainee/reply
 * Body: { messages: [ { role: "user"|"assistant", content: "..." } ], firstName?: string, currentStage?: string, note?: string }
 */
import { NextResponse } from "next/server";
import { generateReply } from "@/lib/ainee/chat";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const messages = body.messages ?? [];
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Body must include messages: [ { role, content } ]" },
        { status: 400 }
      );
    }
    const leadContext = {
      firstName: body.firstName,
      lastName: body.lastName,
      currentStage: body.currentStage,
      lastReplyAt: body.lastReplyAt,
      note: body.note,
    };
    const reply = await generateReply(messages, leadContext);
    return NextResponse.json({ reply });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
