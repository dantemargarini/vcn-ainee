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

/** Normalize inbound webhook body (GHL may send camelCase or snake_case; workflow may send nested message). */
function parseInboundBody(body: unknown): {
  contactId: string;
  conversationId: string;
  messageBody: string;
  locationId: string;
} | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const contactId = (b.contactId ?? b.contact_id ?? b.id) as string | undefined;
  let conversationId = (b.conversationId ?? b.conversation_id) as string | undefined;
  let messageBody: string | undefined = (b.body ?? b.message) as string | undefined;
  const locationId = (b.locationId ?? b.location_id) as string | undefined;
  const loc = locationId || LOCATION_ID;
  if (!messageBody && b.message && typeof b.message === "object") {
    const msg = b.message as Record<string, unknown>;
    messageBody = (msg.body ?? msg.message ?? msg.text) as string | undefined;
  }
  if (b.location && typeof b.location === "object") {
    const locObj = b.location as Record<string, unknown>;
    if (!locationId && locObj.id) return parseInboundBody({ ...b, locationId: locObj.id });
  }
  if (!contactId || messageBody == null) return null;
  return {
    contactId,
    conversationId: conversationId ?? "",
    messageBody: String(messageBody).trim(),
    locationId: loc,
  };
}

/** Get conversationId from contact if missing (e.g. workflow payload). */
async function getConversationIdIfMissing(
  contactId: string,
  conversationId: string,
  locationId: string
): Promise<string | null> {
  if (conversationId && conversationId.trim()) return conversationId;
  const contact = await getContact(contactId, locationId);
  const c = contact as Record<string, unknown>;
  const convId = (c.conversationId ?? c.conversation_id) as string | undefined;
  return convId && String(convId).trim() ? convId : null;
}

/** Detect STOP / opt-out. */
function isStopMessage(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t === "stop" || t === "stop." || t === "unsubscribe" || t === "opt out" || t.startsWith("stop ");
}

/** Test numbers that can approve "ainee is ready" (10 digits). */
const READINESS_TEST_PHONES = ["6197918675", "6198693700"];

function normalizePhone10(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length === 10) return digits;
  return digits.slice(-10);
}

function isReadinessMessage(text: string): boolean {
  return text.trim().toLowerCase().includes("ainee is ready");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const b = body as Record<string, unknown>;
    console.log("[inbound] Received", { keys: Object.keys(b), contactId: b.contactId ?? b.id, hasBody: !!(b.body ?? b.message) });
    const parsed = parseInboundBody(body);
    if (!parsed) {
      console.log("[inbound] Rejected: missing contactId or body");
      return NextResponse.json({ ok: false, error: "Missing contactId or message body" }, { status: 400 });
    }
    let { contactId, conversationId, messageBody, locationId } = parsed;
    const resolvedConversationId = await getConversationIdIfMissing(contactId, conversationId, locationId);
    if (!resolvedConversationId) {
      console.log("[inbound] No conversationId for contact", contactId, "- replying with current message only (no history)");
    }
    conversationId = resolvedConversationId ?? "";

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

    // 2) Messaging window: do not send reply outside 8:30 AM - 8:00 PM EST (except test numbers)
    const contactForWindow = await getContact(contactId, locationId);
    const conForWindow = contactForWindow as Record<string, unknown>;
    const rawPhoneForWindow = (conForWindow.phone ?? "").toString();
    const phone10ForWindow = normalizePhone10(rawPhoneForWindow);
    const isTestNumber = READINESS_TEST_PHONES.includes(phone10ForWindow);

    if (!isTestNumber && !isWithinMessagingWindow()) {
      await supabase.from("conversations").insert({
        ghl_contact_id: contactId,
        body: messageBody,
        direction: "inbound",
        from_type: "lead",
        created_at: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true, action: "logged_only_outside_window" });
    }

    // 2b) "Ainee is ready" from test numbers: track readiness, only go live when both have said it
    if (isReadinessMessage(messageBody)) {
      const contact = await getContact(contactId, locationId);
      const con = contact as Record<string, unknown>;
      const rawPhone = (con.phone ?? "").toString();
      const phone10 = normalizePhone10(rawPhone);
      if (READINESS_TEST_PHONES.includes(phone10)) {
        await supabase.from("readiness_approvals").upsert(
          { phone: phone10, ghl_contact_id: contactId, approved_at: new Date().toISOString() },
          { onConflict: "phone" }
        );
        const { data: approvals } = await supabase.from("readiness_approvals").select("phone, approved_at");
        const count = Array.isArray(approvals) ? approvals.length : 0;
        const bothApproved = count >= 2;
        const replyText = bothApproved
          ? "Both testers have approved. Ainee is ready for go-live. You can start using her for real leads. Ainee."
          : "Got it. You are marked as ready. Waiting for the other tester to text 'ainee is ready'.";
        await sendSms(contactId, replyText, locationId);
        if (bothApproved) {
          await supabase.from("audit_logs").insert({
            log_type: "ainee_go_live",
            payload: { message: "Both testers approved", approvals: approvals ?? [] },
          });
        }
        await supabase.from("conversations").insert({
          ghl_contact_id: contactId,
          body: messageBody,
          direction: "inbound",
          from_type: "lead",
          created_at: new Date().toISOString(),
        });
        return NextResponse.json({ ok: true, action: "readiness", both_approved: bothApproved });
      }
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

    // 5) Lead row for conversation_reset_at (only use messages after this time)
    const { data: leadRowForReset } = await supabase
      .from("leads")
      .select("conversation_reset_at")
      .eq("ghl_contact_id", contactId)
      .single();
    const resetAt = leadRowForReset?.conversation_reset_at
      ? new Date(leadRowForReset.conversation_reset_at).getTime()
      : null;

    // 6) Conversation history from GHL (filter by reset_at if set), or just current message if no conversationId
    let messages: ConversationMessage[] = [];
    if (conversationId.trim()) {
      const rawMessages = await getConversationMessages(conversationId, locationId);
      const toTime = (m: Record<string, unknown>) => {
        const v = m.createdAt ?? m.dateAdded ?? 0;
        return new Date(typeof v === "string" || typeof v === "number" ? v : 0).getTime();
      };
      const sorted = [...(Array.isArray(rawMessages) ? rawMessages : [])].sort(
        (a, b) => toTime(a as Record<string, unknown>) - toTime(b as Record<string, unknown>)
      );
      for (const m of sorted) {
        const msg = m as Record<string, unknown>;
        const msgTime = toTime(msg);
        if (resetAt != null && msgTime < resetAt) continue;
        const content = (msg.body ?? msg.message ?? msg.text ?? "").toString();
        const direction = (msg.direction ?? msg.type ?? "inbound").toString().toLowerCase();
        const role = direction === "inbound" ? "user" : "assistant";
        messages.push({ role, content });
      }
    }
    messages.push({ role: "user", content: messageBody });

    const leadContext = {
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      currentStage,
      lastReplyAt: new Date().toISOString(),
    };

    // 7) Learned rules from corrections (train Ainee up)
    const { data: corrections } = await supabase
      .from("ainee_corrections")
      .select("trigger_text, preferred_response")
      .eq("active", true);
    const learnedRules =
      Array.isArray(corrections) && corrections.length > 0
        ? corrections
            .map(
              (c: { trigger_text: string; preferred_response: string }) =>
                `When lead says something like: "${(c.trigger_text || "").slice(0, 200)}" -> Ainee should say: "${(c.preferred_response || "").slice(0, 300)}"`
            )
            .join("\n")
        : undefined;

    // 8) Generate and send reply
    const reply = await generateReply(messages, leadContext, learnedRules);
    await sendSms(contactId, reply, locationId);

    // 9) Log to Supabase
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

    // 10) Move opportunity to Sale in Progress when lead replies
    if (opp?.id && currentStage !== "Sale in Progress") {
      const sipStage = stages.find((s: { name: string }) => s.name === "Sale in Progress");
      if (sipStage?.id) {
        await updateOpportunityStage(opp.id, sipStage.id, locationId);
      }
    }

    console.log("[inbound] Replied successfully to contact", contactId);
    return NextResponse.json({ ok: true, action: "replied" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[webhook/ghl/inbound]", message, e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
