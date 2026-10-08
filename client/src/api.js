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
// Uses fetch + blob so failures surface as a thrown error (the caller can
// show a notice) instead of silently navigating to an error page.
export async function downloadDocPdf(kind, ref) {
  const url = `/api/${kind}/${encodeURIComponent(ref)}/pdf`;
  const res = await fetch(url);
  if (!res.ok) {
    let msg = "Could not generate the PDF.";
    try {
      const data = await res.json();
      if (data.error) msg = data.error;
    } catch {
      // non-JSON error body
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${kind === "receipt" ? "Receipt" : "Invoice"}-${ref}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
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
