/**
 * Fetch pipelines from GHL for this location.
 * GET /api/ghl/pipelines — returns list so we can see Pipeline ID.
 */
import { NextResponse } from "next/server";

const GHL_BASE = "https://services.leadconnectorhq.com";

export async function GET() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!apiKey || !locationId) {
    return NextResponse.json(
      { error: "Missing GHL_API_KEY or GHL_LOCATION_ID in .env.local" },
      { status: 500 }
    );
  }

  try {
    const url = `${GHL_BASE}/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Version: "2021-07-28",
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        {
          error: "GHL API error",
          status: res.status,
          body: data,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: "Request failed", message },
      { status: 500 }
    );
  }
}
