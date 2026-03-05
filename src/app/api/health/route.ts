/**
 * Health check: verifies Supabase connection.
 * GET /api/health → { ok: true, supabase: "connected" } or error.
 */
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { error } = await supabase.from("audit_logs").select("id").limit(1);
    if (error) {
      return NextResponse.json(
        { ok: false, supabase: "error", error: error.message },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, supabase: "connected" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, supabase: "error", error: message },
      { status: 500 }
    );
  }
}
