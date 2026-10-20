// Small API client — talks to the Express backend
import { getToken } from "./auth.js";

// Base URL of the backend. Set VITE_API_URL in client/.env when hosting the
// frontend and backend on separate servers, e.g.:
//   VITE_API_URL=https://your-backend.onrender.com
// Leave it unset in dev — the Vite proxy (vite.config.js) forwards /api to
// localhost:3000, so everything keeps working locally.
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

// Authorization header for admin endpoints (JWT)
const authHeaders = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};
export async function verifyInvoice(ref) {
  const res = await fetch(`${API_BASE}/api/verify/${encodeURIComponent(ref)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Invoice not found.");
  return data;
}

export async function fetchInvoices(page = 1, limit = 10) {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  const res = await fetch(`${API_BASE}/api/invoices?${qs}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load invoices.");
  return data;
}

export async function createInvoice(payload) {
  const res = await fetch(`${API_BASE}/api/invoices`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not create invoice.");
  return data;
}

export async function markInvoicePaid(ref) {
  const res = await fetch(`${API_BASE}/api/invoices/${encodeURIComponent(ref)}/pay`, {
    method: "POST",
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not mark invoice as paid.");
  return data;
}

export async function fetchReceipt(ref) {
  const res = await fetch(`${API_BASE}/api/receipt/${encodeURIComponent(ref)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Receipt unavailable.");
  return data;
}

// Generates the PDF entirely in the browser from the on-screen document
// element (html2canvas-pro + jsPDF). Unlike the old server-side Puppeteer
// endpoint, this works identically offline and on any deployed host (Render
// etc.) because it does not depend on headless Chromium being installed on
// the server. The layout captured is the same .doc-paper element that the
// print dialog prints, so Download and Print always match.
export async function downloadDocPdf(kind, ref, docEl) {
  if (!docEl) throw new Error("The document is not ready yet. Try again.");
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);
  // Force a desktop-width render for the capture: on phones the element is
  // squeezed by the viewport, which would produce a narrow, mobile-styled
  // PDF. Pin the element to its desktop width and capture at a desktop
  // viewport so desktop media-query styles apply, then restore the inline
  // styles afterwards.
  const DESKTOP_W = 860; // matches .doc-paper max-width
  const prev = {
    width: docEl.style.width,
    maxWidth: docEl.style.maxWidth,
  };
  docEl.style.width = `${DESKTOP_W}px`;
  docEl.style.maxWidth = "none";
  let canvas;
  try {
    canvas = await html2canvas(docEl, {
      scale: 2, // crisp text
      useCORS: true, // allow same-origin images (logos)
      backgroundColor: "#ffffff",
      windowWidth: DESKTOP_W + 40, // desktop viewport → desktop styles
      windowHeight: docEl.scrollHeight + 40,
    });
  } finally {
    docEl.style.width = prev.width;
    docEl.style.maxWidth = prev.maxWidth;
  }
  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  // A4 at 96dpi in mm
  const A4_W = 210;
  const A4_H = 297;
  const imgH = (canvas.height * A4_W) / canvas.width;
  // When the document fits on one page, size the page to the content so the
  // PDF ends where the printed page would — no blank space at the bottom.
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: imgH <= A4_H ? [A4_W, imgH] : "a4",
  });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  // One full-width page if it fits, otherwise paginate at full width.
  if (imgH <= A4_H) {
    pdf.addImage(imgData, "JPEG", 0, 0, pageW, imgH);
  } else {
    let y = 0;
    while (y < imgH) {
      if (y > 0) pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, -y, pageW, imgH);
      y += pageH;
    }
  }
  pdf.save(`${kind === "receipt" ? "Receipt" : "Invoice"}-${ref}.pdf`);
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
