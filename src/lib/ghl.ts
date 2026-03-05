/**
 * GoHighLevel (LeadConnector) API client.
 * All keys from .env.local — never hardcoded.
 */
const BASE = "https://services.leadconnectorhq.com";

function getHeaders(locationId?: string) {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) throw new Error("Missing GHL_API_KEY");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Version: "2021-07-28",
  };
  if (locationId) headers["Location-Id"] = locationId;
  return headers;
}

/** Fetch opportunities (contacts in pipeline) with stages — paginated */
export async function getOpportunities(opts: {
  locationId: string;
  pipelineId: string;
  limit?: number;
  page?: number;
}) {
  const { locationId, pipelineId, limit = 100, page = 1 } = opts;
  const url = new URL(`${BASE}/opportunities/search`);
  url.searchParams.set("location_id", locationId);
  url.searchParams.set("pipeline_id", pipelineId);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("page", String(page));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: getHeaders(locationId),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `GHL opportunities: ${res.status}`);
  return data;
}

/** Get single contact (includes conversationId if present) */
export async function getContact(contactId: string, locationId?: string) {
  const loc = locationId ?? process.env.GHL_LOCATION_ID;
  const res = await fetch(`${BASE}/contacts/${contactId}`, {
    method: "GET",
    headers: getHeaders(loc),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `GHL contact: ${res.status}`);
  return data.contact ?? data;
}

/** Get all notes for a contact */
export async function getContactNotes(contactId: string, locationId?: string) {
  const loc = locationId ?? process.env.GHL_LOCATION_ID;
  const res = await fetch(`${BASE}/contacts/${contactId}/notes`, {
    method: "GET",
    headers: getHeaders(loc),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `GHL notes: ${res.status}`);
  return Array.isArray(data.notes) ? data.notes : data.notes?.notes ?? [];
}

/** Get messages in a conversation (SMS history) */
export async function getConversationMessages(
  conversationId: string,
  locationId?: string
) {
  const loc = locationId ?? process.env.GHL_LOCATION_ID;
  const res = await fetch(
    `${BASE}/conversations/${conversationId}/messages`,
    {
      method: "GET",
      headers: getHeaders(loc),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `GHL messages: ${res.status}`);
  return Array.isArray(data.messages) ? data.messages : data.messages?.messages ?? [];
}

/** Get pipeline stages (to map stage id -> stage name) */
export async function getPipelineStages(locationId: string, pipelineId: string) {
  const pipelinesRes = await fetch(
    `${BASE}/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`,
    { method: "GET", headers: getHeaders(locationId) }
  );
  const pipelinesData = await pipelinesRes.json().catch(() => ({}));
  if (!pipelinesRes.ok) throw new Error(pipelinesData.message || "Failed to get pipelines");

  const pipelines = pipelinesData.pipelines ?? pipelinesData;
  const list = Array.isArray(pipelines) ? pipelines : [];
  const pipeline = list.find((p: { id?: string }) => p.id === pipelineId);
  const stages = pipeline?.stages ?? [];
  return stages as { id: string; name: string }[];
}

/** Create or find contact by phone (upsert). Returns contact id. */
export async function upsertContact(
  phone: string,
  opts: { locationId: string; firstName?: string; lastName?: string }
) {
  const { locationId, firstName = "", lastName = "" } = opts;
  const res = await fetch(`${BASE}/contacts/upsert`, {
    method: "POST",
    headers: getHeaders(locationId),
    body: JSON.stringify({
      locationId,
      phone: (() => {
        const digits = phone.replace(/\D/g, "");
        if (digits.length === 10) return `+1${digits}`;
        if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
        return phone.startsWith("+") ? phone : `+${phone}`;
      })(),
      firstName: firstName || "Test",
      lastName: lastName || "Contact",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `GHL upsert contact: ${res.status}`);
  const contact = data.contact ?? data;
  const id = contact?.id ?? contact?.contactId;
  if (!id) throw new Error("No contact id in upsert response");
  return id as string;
}

/** Update contact (e.g. set DND). */
export async function updateContact(
  contactId: string,
  payload: { dnd?: boolean; [k: string]: unknown },
  locationId?: string
) {
  const loc = locationId ?? process.env.GHL_LOCATION_ID;
  const res = await fetch(`${BASE}/contacts/${contactId}`, {
    method: "PUT",
    headers: getHeaders(loc),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `GHL update contact: ${res.status}`);
  return data;
}

/** Get opportunity for a contact in the given pipeline (first match). */
export async function getOpportunityForContact(
  contactId: string,
  locationId: string,
  pipelineId: string
) {
  const url = new URL(`${BASE}/opportunities/search`);
  url.searchParams.set("location_id", locationId);
  url.searchParams.set("pipeline_id", pipelineId);
  url.searchParams.set("contact_id", contactId);
  url.searchParams.set("limit", "1");
  const res = await fetch(url.toString(), { method: "GET", headers: getHeaders(locationId) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `GHL opportunities search: ${res.status}`);
  const list = data.opportunities ?? data.data?.opportunities ?? [];
  return Array.isArray(list) ? list[0] : null;
}

/** Move opportunity to a pipeline stage (e.g. Sale in Progress, DND). Uses Update Opportunity PUT. */
export async function updateOpportunityStage(
  opportunityId: string,
  pipelineStageId: string,
  locationId?: string
) {
  const loc = locationId ?? process.env.GHL_LOCATION_ID;
  const res = await fetch(`${BASE}/opportunities/${opportunityId}`, {
    method: "PUT",
    headers: getHeaders(loc),
    body: JSON.stringify({ pipelineStageId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `GHL update opportunity: ${res.status}`);
  return data;
}

/** Send an SMS to a contact (by contact id). */
export async function sendSms(
  contactId: string,
  message: string,
  locationId?: string
) {
  const loc = locationId ?? process.env.GHL_LOCATION_ID;
  const res = await fetch(`${BASE}/conversations/messages`, {
    method: "POST",
    headers: getHeaders(loc),
    body: JSON.stringify({
      contactId,
      type: "SMS",
      message,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.message || data.error || (typeof data === "object" ? JSON.stringify(data) : `GHL send SMS: ${res.status}`);
    throw new Error(msg);
  }
  return data;
}
