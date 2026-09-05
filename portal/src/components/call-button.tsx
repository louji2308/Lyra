"use client";

import { useState } from "react";

export function CallButton() {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [calling, setCalling] = useState(false);
  const [status, setStatus] = useState("");

  async function handleCall() {
    const num = phone.replace(/\D/g, "");
    if (num.length < 10) {
      setStatus("Enter a valid 10-digit number");
      return;
    }

    setCalling(true);
    setStatus("Calling...");

    try {
      const res = await fetch("/api/call-outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toNumber: num.startsWith("91") ? `+${num}` : `+91${num}`,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus(`Call ${data.status} — ID: ${data.id}`);
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (err) {
      setStatus(`Failed: ${String(err)}`);
    } finally {
      setCalling(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 w-72 rounded-2xl bg-white p-4 shadow-2xl border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🎙️</span>
            <div>
              <div className="font-semibold text-sm">Call a Shop</div>
              <div className="text-xs text-gray-500">Lyra AI Agent</div>
            </div>
          </div>
          <input
            type="tel"
            placeholder="Shop phone number"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setStatus("");
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            onClick={handleCall}
            disabled={calling}
            className="w-full rounded-lg bg-sky-500 text-white py-2 text-sm font-medium hover:bg-sky-600 disabled:opacity-50"
          >
            {calling ? "Calling..." : "Start Call"}
          </button>
          {status && (
            <div className="mt-2 text-xs text-gray-600">{status}</div>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-500 text-white text-2xl shadow-lg hover:bg-sky-600 transition-colors"
      >
        📞
      </button>
    </div>
  );
}
