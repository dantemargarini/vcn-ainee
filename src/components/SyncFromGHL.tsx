"use client";

import { useState } from "react";

export default function SyncFromGHL() {
  const [loading, setLoading] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ghl/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 20, page: 1 }),
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setResult("Error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }

  async function handleSendTestConvo() {
    setSmsLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ghl/send-test-convo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phones: ["6197918675", "6198693700"] }),
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setResult("Error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSmsLoading(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleSync}
        disabled={loading}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Syncing…" : "Sync from GHL (first 20 leads)"}
      </button>
      <button
        type="button"
        onClick={handleSendTestConvo}
        disabled={smsLoading}
        className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
      >
        {smsLoading ? "Sending…" : "Text both test numbers (training convo)"}
      </button>
      {result && (
        <pre className="max-w-xl overflow-auto rounded bg-gray-100 p-3 text-left text-xs text-gray-800">
          {result}
        </pre>
      )}
    </div>
  );
}
