// Small API client — talks to the Express backend
import { getToken } from "./auth.js";

// Authorization header for admin endpoints (JWT)
const authHeaders = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};
export async function verifyInvoice(ref) {
  const res = await fetch(`/api/verify/${encodeURIComponent(ref)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Invoice not found.");
  return data;
}

export async function fetchInvoices() {
  const res = await fetch("/api/invoices", { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load invoices.");
  return data;
}

export async function createInvoice(payload) {
  const res = await fetch("/api/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not create invoice.");
  return data;
}

export async function markInvoicePaid(ref) {
  const res = await fetch(`/api/invoices/${encodeURIComponent(ref)}/pay`, {
    method: "POST",
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not mark invoice as paid.");
  return data;
}

export async function fetchReceipt(ref) {
  const res = await fetch(`/api/receipt/${encodeURIComponent(ref)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Receipt unavailable.");
  return data;
}

// Downloads the server-generated PDF (headless Chromium, headers/footers
// stripped) — identical layout to the on-screen preview and browser print.
export function downloadDocPdf(kind, ref) {
  window.location.href = `/api/${kind}/${encodeURIComponent(ref)}/pdf`;
}

export const money = (n) =>
  `\u20A6${Number(n || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const fmtDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
