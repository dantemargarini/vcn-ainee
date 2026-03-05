/**
 * Sync leads from GHL into Supabase: contacts in pipeline, conversations, notes, stage.
 * POST /api/ghl/sync — optional body: { limit?: number, page?: number }
 */
import { NextResponse } from "next/server";
import {
  getOpportunities,
  getContact,
  getContactNotes,
  getConversationMessages,
  getPipelineStages,
} from "@/lib/ghl";
import { supabase } from "@/lib/supabase";

const LOCATION_ID = process.env.GHL_LOCATION_ID!;
const PIPELINE_ID = process.env.GHL_PIPELINE_ID!;

type Opportunity = {
  id?: string;
  contactId?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  stageName?: string;
  status?: string;
  assignedTo?: string;
  [k: string]: unknown;
};

function normalizeOpportunities(data: unknown): Opportunity[] {
  if (!data || typeof data !== "object") return [];
  const d = data as Record<string, unknown>;
  const list = (d.opportunities ?? d.data ?? d) as unknown;
  return Array.isArray(list) ? list : [];
}

function normalizeStages(data: unknown): { id: string; name: string }[] {
  const stages = (data as { id?: string; name?: string }[]) ?? [];
  return stages
    .filter((s) => s && s.id && s.name)
    .map((s) => ({ id: s.id!, name: s.name! }));
}

export async function POST(req: Request) {
  if (!LOCATION_ID || !PIPELINE_ID) {
    return NextResponse.json(
      { error: "Missing GHL_LOCATION_ID or GHL_PIPELINE_ID" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit) || 50, 100);
    const page = Number(body.page) || 1;

    // 1) Pipeline stages: id -> name
    const stagesRaw = await getPipelineStages(LOCATION_ID, PIPELINE_ID);
    const stageList = normalizeStages(stagesRaw);
    const stageIdToName = new Map(stageList.map((s) => [s.id, s.name]));

    // 2) Opportunities (contacts in this pipeline)
    const oppRes = await getOpportunities({
      locationId: LOCATION_ID,
      pipelineId: PIPELINE_ID,
      limit,
      page,
    });
    const opportunities = normalizeOpportunities(oppRes);

    if (opportunities.length === 0) {
      return NextResponse.json({
        ok: true,
        synced: 0,
        message: "No opportunities in this page",
      });
    }

    // 3) Unique contact IDs and their current stage
    const contactStages = new Map<string, string>();
    for (const opp of opportunities) {
      const cid = opp.contactId ?? (opp as Record<string, unknown>).contact_id as string | undefined;
      if (!cid) continue;
      const stageId = opp.pipelineStageId ?? (opp as Record<string, unknown>).pipelineStageId as string | undefined;
      const stageName = stageId ? (stageIdToName.get(stageId) ?? stageId) : "New Lead";
      contactStages.set(cid, stageName);
    }

    let synced = 0;
    const errors: string[] = [];

    for (const [ghlContactId, currentStage] of contactStages) {
      try {
        const contact = await getContact(ghlContactId, LOCATION_ID);
        const con = contact as Record<string, unknown>;
        const firstName = (con.firstName ?? con.name ?? "") as string;
        const lastName = (con.lastName ?? "") as string;
        const phone = (con.phone ?? "") as string;
        const email = (con.email ?? null) as string | null;
        const dnd = Boolean(con.dnd);
        const ghlOwnerId = (con.assignedTo ?? con.ownerId ?? null) as string | null;
        const conversationId = (con.conversationId ?? con.conversation_id) as string | undefined;

        const { data: existingLead } = await supabase
          .from("leads")
          .select("id")
          .eq("ghl_contact_id", ghlContactId)
          .single();

        const leadRow = {
          ghl_contact_id: ghlContactId,
          location_id: LOCATION_ID,
          pipeline_id: PIPELINE_ID,
          first_name: firstName || null,
          last_name: lastName || null,
          phone: phone || "unknown",
          email,
          current_stage: currentStage,
          dnd,
          ghl_owner_id: ghlOwnerId ?? null,
          updated_at: new Date().toISOString(),
        };

        const { data: upsertedLead, error: leadErr } = await supabase
          .from("leads")
          .upsert(leadRow, {
            onConflict: "ghl_contact_id",
            ignoreDuplicates: false,
          })
          .select("id")
          .single();

        if (leadErr) {
          errors.push(`lead ${ghlContactId}: ${leadErr.message}`);
          continue;
        }
        const leadId = upsertedLead?.id;

        if (leadId) {
          await supabase.from("stage_history").insert({
            lead_id: leadId,
            ghl_contact_id: ghlContactId,
            stage_name: currentStage,
            moved_by: "ghl",
          });
        }

        const notes = await getContactNotes(ghlContactId, LOCATION_ID);
        for (const n of Array.isArray(notes) ? notes : []) {
          const note = n as Record<string, unknown>;
          const content = (note.body ?? note.content ?? note.note ?? "").toString();
          const ghlNoteId = (note.id ?? "").toString();
          const authorId = (note.userId ?? note.createdBy ?? "").toString();
          const authorName = (note.userName ?? note.createdBy ?? "").toString();
          const createdAt = (note.createdAt ?? note.dateAdded ?? new Date()).toString();
          if (!content) continue;
          await supabase.from("rep_notes").insert({
            lead_id: leadId ?? null,
            ghl_contact_id: ghlContactId,
            ghl_note_id: ghlNoteId || null,
            content,
            author_ghl_user_id: authorId || null,
            author_name: authorName || null,
            created_at: createdAt,
          });
        }

        if (conversationId) {
          const messages = await getConversationMessages(conversationId, LOCATION_ID);
          let lastMessageAt: string | null = null;
          let lastMessageFrom: string | null = null;
          let lastReplyAt: string | null = null;
          for (const m of Array.isArray(messages) ? messages : []) {
            const msg = m as Record<string, unknown>;
            const body = (msg.body ?? msg.message ?? msg.text ?? "").toString();
            const direction = (msg.direction ?? msg.type ?? "inbound").toString().toLowerCase();
            const fromType = direction === "inbound" ? "lead" : (msg.fromType ?? "rep");
            const ghlMessageId = (msg.id ?? "").toString();
            const created = (msg.createdAt ?? msg.dateAdded ?? msg.created_at ?? new Date()).toString();
            const isInbound = direction === "inbound";
            if (isInbound) lastReplyAt = created;
            if (!lastMessageAt || created > lastMessageAt) {
              lastMessageAt = created;
              lastMessageFrom = isInbound ? "lead" : (fromType as string);
            }
            await supabase.from("conversations").insert({
              lead_id: leadId ?? null,
              ghl_contact_id: ghlContactId,
              ghl_message_id: ghlMessageId || null,
              body,
              direction: isInbound ? "inbound" : "outbound",
              from_type: isInbound ? "lead" : (fromType as string),
              from_ghl_user_id: (msg.userId ?? msg.assignedTo ?? null) as string | null,
              created_at: created,
              raw: msg,
            });
          }
          if (lastMessageAt && leadId) {
            await supabase
              .from("leads")
              .update({
                last_message_at: lastMessageAt,
                last_message_from: lastMessageFrom,
                last_reply_at: lastReplyAt,
                updated_at: new Date().toISOString(),
              })
              .eq("id", leadId);
          }
        }

        synced++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${ghlContactId}: ${msg}`);
      }
    }

    return NextResponse.json({
      ok: true,
      synced,
      opportunitiesPage: opportunities.length,
      errors: errors.length ? errors.slice(0, 20) : undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
