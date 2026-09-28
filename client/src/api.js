// Small API client — talks to the Express backend
export async function verifyInvoice(ref) {
  const res = await fetch(`/api/verify/${encodeURIComponent(ref)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Invoice not found.");
  return data;
}

export async function fetchInvoices() {
  const res = await fetch("/api/invoices");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load invoices.");
  return data;
}

export async function createInvoice(payload) {
  const res = await fetch("/api/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not create invoice.");
  return data;
}

export async function markInvoicePaid(ref) {
  const res = await fetch(`/api/invoices/${encodeURIComponent(ref)}/pay`, {
    method: "POST",
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

export const money = (n) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
    n,
  );

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
