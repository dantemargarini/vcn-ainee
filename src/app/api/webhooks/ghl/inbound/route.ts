/**
 * GHL inbound message webhook. When a lead sends an SMS, GHL POSTs here.
 * We run pre-check, then Ainee replies and we send back via GHL and log to Supabase.
 */
import { NextResponse } from "next/server";
import {
  getContact,
  getConversationMessages,
  getPipelineStages,
  getOpportunityForContact,
  updateContact,
  updateOpportunityStage,
  sendSms,
} from "@/lib/ghl";
import { generateReply } from "@/lib/ainee/chat";
import type { ConversationMessage } from "@/lib/ainee/chat";
import { supabase } from "@/lib/supabase";

const LOCATION_ID = process.env.GHL_LOCATION_ID!;
const PIPELINE_ID = process.env.GHL_PIPELINE_ID!;

/** True if current time is between 8:30 AM and 8:00 PM EST. */
function isWithinMessagingWindow(): boolean {
  const now = new Date();
  const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const hours = est.getHours();
  const mins = est.getMinutes();
  const totalMins = hours * 60 + mins;
  const start = 8 * 60 + 30;  // 8:30 AM
  const end = 20 * 60;        // 8:00 PM
  return totalMins >= start && totalMins < end;
}

/** Normalize inbound webhook body (GHL may send camelCase or snake_case). */
function parseInboundBody(body: unknown): {
  contactId: string;
  conversationId: string;
  messageBody: string;
  locationId: string;
} | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const contactId = (b.contactId ?? b.contact_id) as string | undefined;
  const conversationId = (b.conversationId ?? b.conversation_id) as string | undefined;
  const messageBody = (b.body ?? b.message) as string | undefined;
  const locationId = (b.locationId ?? b.location_id) as string | undefined;
  if (!contactId || !conversationId || messageBody == null) return null;
  return {
    contactId,
    conversationId,
    messageBody: String(messageBody).trim(),
    locationId: locationId || LOCATION_ID,
  };
}

/** Detect STOP / opt-out. */
function isStopMessage(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === "stop" || t === "stop." || t === "unsubscribe" || t === "opt out" || t.startsWith("stop ");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = parseInboundBody(body);
    if (!parsed) {
      return NextResponse.json({ ok: false, error: "Missing contactId, conversationId, or body" }, { status: 400 });
    }
    const { contactId, conversationId, messageBody, locationId } = parsed;

    // 1) STOP handling: set DND, move to DND stage, do not reply
    if (isStopMessage(messageBody)) {
      await updateContact(contactId, { dnd: true }, locationId);
      const opp = await getOpportunityForContact(contactId, locationId, PIPELINE_ID);
      if (opp?.id) {
        const stages = await getPipelineStages(locationId, PIPELINE_ID);
        const dndStage = stages.find((s: { name: string }) => s.name === "DND");
        if (dndStage?.id) {
          await updateOpportunityStage(opp.id, dndStage.id, locationId);
        }
      }
      await supabase.from("conversations").insert({
        ghl_contact_id: contactId,
        body: messageBody,
        direction: "inbound",
        from_type: "lead",
        created_at: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true, action: "DND" });
    }

    // 2) Messaging window: do not send reply outside 8:30 AM - 8:00 PM EST
    if (!isWithinMessagingWindow()) {
      await supabase.from("conversations").insert({
        ghl_contact_id: contactId,
        body: messageBody,
        direction: "inbound",
        from_type: "lead",
        created_at: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true, action: "logged_only_outside_window" });
    }

    // 3) Pre-check: contact and DND
    const contact = await getContact(contactId, locationId);
    const con = contact as Record<string, unknown>;
    if (con.dnd === true) {
      return NextResponse.json({ ok: true, action: "DND_skip" });
    }

    // 4) Stage and context for Ainee
    let currentStage = "New Lead";
    const opp = await getOpportunityForContact(contactId, locationId, PIPELINE_ID);
    const stages = await getPipelineStages(locationId, PIPELINE_ID);
    if (opp && (opp as Record<string, unknown>).pipelineStageId) {
      const stageId = (opp as Record<string, unknown>).pipelineStageId as string;
      const stage = stages.find((s: { id: string }) => s.id === stageId);
      if (stage) currentStage = stage.name;
    }

    const firstName = (con.firstName ?? con.name ?? "") as string;
    const lastName = (con.lastName ?? "") as string;

    // 5) Conversation history from GHL
    const rawMessages = await getConversationMessages(conversationId, locationId);
    const sorted = [...(Array.isArray(rawMessages) ? rawMessages : [])].sort(
      (a, b) =>
        new Date((a as Record<string, unknown>).createdAt ?? (a as Record<string, unknown>).dateAdded ?? 0).getTime() -
        new Date((b as Record<string, unknown>).createdAt ?? (b as Record<string, unknown>).dateAdded ?? 0).getTime()
    );
    const messages: ConversationMessage[] = [];
    for (const m of sorted) {
      const msg = m as Record<string, unknown>;
      const content = (msg.body ?? msg.message ?? msg.text ?? "").toString();
      const direction = (msg.direction ?? msg.type ?? "inbound").toString().toLowerCase();
      const role = direction === "inbound" ? "user" : "assistant";
      messages.push({ role, content });
    }
    messages.push({ role: "user", content: messageBody });

    const leadContext = {
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      currentStage,
      lastReplyAt: new Date().toISOString(),
    };

    // 6) Generate and send reply
    const reply = await generateReply(messages, leadContext);
    await sendSms(contactId, reply, locationId);

    // 7) Log to Supabase
    const now = new Date().toISOString();
    await supabase.from("conversations").insert([
      { ghl_contact_id: contactId, body: messageBody, direction: "inbound", from_type: "lead", created_at: now },
      { ghl_contact_id: contactId, body: reply, direction: "outbound", from_type: "ainee", created_at: now },
    ]);

    const { data: leadRow } = await supabase.from("leads").select("id").eq("ghl_contact_id", contactId).single();
    if (leadRow?.id) {
      await supabase
        .from("leads")
        .update({
          current_stage: "Sale in Progress",
          last_message_at: now,
          last_message_from: "ainee",
          last_reply_at: now,
          updated_at: now,
        })
        .eq("id", leadRow.id);
    }

    // Move opportunity to Sale in Progress when lead replies
    if (opp?.id && currentStage !== "Sale in Progress") {
      const sipStage = stages.find((s: { name: string }) => s.name === "Sale in Progress");
      if (sipStage?.id) {
        await updateOpportunityStage(opp.id, sipStage.id, locationId);
      }
    }

    return NextResponse.json({ ok: true, action: "replied" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[webhook/ghl/inbound]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
