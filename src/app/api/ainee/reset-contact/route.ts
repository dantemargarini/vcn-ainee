/**
 * Reset a contact's conversation so Ainee treats them as fresh.
 * POST body: { ghl_contact_id: string, move_to_new_lead?: boolean }
 * Sets conversation_reset_at so only messages after now are used. Optionally moves opportunity to New Lead in GHL.
 */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  getOpportunityForContact,
  getPipelineStages,
  updateOpportunityStage,
} from "@/lib/ghl";

const LOCATION_ID = process.env.GHL_LOCATION_ID!;
const PIPELINE_ID = process.env.GHL_PIPELINE_ID!;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const ghlContactId = (body.ghl_contact_id ?? body.ghlContactId ?? "").toString().trim();
    if (!ghlContactId) {
      return NextResponse.json(
        { error: "Send ghl_contact_id" },
        { status: 400 }
      );
    }
    const moveToNewLead = body.move_to_new_lead !== false;

    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("leads")
      .update({ conversation_reset_at: now, updated_at: now })
      .eq("ghl_contact_id", ghlContactId);
    if (updateError) throw updateError;

    if (moveToNewLead && LOCATION_ID && PIPELINE_ID) {
      const opp = await getOpportunityForContact(ghlContactId, LOCATION_ID, PIPELINE_ID);
      if (opp?.id) {
        const stages = await getPipelineStages(LOCATION_ID, PIPELINE_ID);
        const newLeadStage = stages.find((s: { name: string }) => s.name === "New Lead");
        if (newLeadStage?.id) {
          await updateOpportunityStage(opp.id, newLeadStage.id, LOCATION_ID);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Conversation reset. Ainee will use only new messages from now.",
      conversation_reset_at: now,
      moved_to_new_lead: moveToNewLead,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
