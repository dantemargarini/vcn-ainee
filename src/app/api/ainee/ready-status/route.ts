/**
 * Check if both testers have said "ainee is ready".
 * GET /api/ainee/ready-status → { ready: boolean, approvals: [...], test_phones: [...] }
 */
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const TEST_PHONES = ["6197918675", "6198693700"];

export async function GET() {
  try {
    const { data: approvals, error } = await supabase
      .from("readiness_approvals")
      .select("phone, ghl_contact_id, approved_at")
      .order("approved_at", { ascending: true });
    if (error) throw error;
    const list = Array.isArray(approvals) ? approvals : [];
    const ready = list.length >= 2;
    return NextResponse.json({
      ok: true,
      ready,
      approvals: list,
      test_phones: TEST_PHONES,
      message: ready
        ? "Both testers have approved. Ainee is ready for go-live."
        : `Waiting for ${2 - list.length} more tester(s) to text 'ainee is ready'.`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
