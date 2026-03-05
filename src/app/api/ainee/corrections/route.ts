/**
 * Add or list Ainee corrections: "when lead says X, Ainee should say Y".
 * POST: add a correction. Body: { trigger_text: string, preferred_response: string }
 * GET: list active corrections
 */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const triggerText = (body.trigger_text ?? body.triggerText ?? "").toString().trim();
    const preferredResponse = (body.preferred_response ?? body.preferredResponse ?? "").toString().trim();
    if (!triggerText || !preferredResponse) {
      return NextResponse.json(
        { error: "Send trigger_text and preferred_response" },
        { status: 400 }
      );
    }
    const { data, error } = await supabase
      .from("ainee_corrections")
      .insert({ trigger_text: triggerText, preferred_response: preferredResponse, active: true })
      .select("id, trigger_text, preferred_response, created_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, correction: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("ainee_corrections")
      .select("id, trigger_text, preferred_response, active, created_at")
      .eq("active", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ ok: true, corrections: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
