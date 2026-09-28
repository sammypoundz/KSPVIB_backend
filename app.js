// ---------------------------------------------------------------------------
// Frontend talks to the Node.js backend via /api/verify and /api/receipt
// ---------------------------------------------------------------------------
const money = n => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(n);
const fmtDate = iso => new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const result = document.getElementById("result");
const input = document.getElementById("invoiceNumber");
const btn = document.getElementById("verifyBtn");

async function verify(number) {
  const ref = number.trim().toUpperCase();
  result.classList.remove("visible");
  btn.disabled = true;
  btn.textContent = "Verifying…";

  try {
    const res = await fetch(`/api/verify/${encodeURIComponent(ref)}`);
    const data = await res.json();
    if (!res.ok) {
      result.innerHTML = `<div class="notice"><strong>Not found.</strong> ${escapeHtml(data.error || "Invoice not found.")}</div>`;
      result.classList.add("visible");
      return;
    }
    render(data.invoice, data.receiptAvailable);
  } catch (err) {
    result.innerHTML = `<div class="notice"><strong>Connection error.</strong> Could not reach the verification server. Please try again.</div>`;
    result.classList.add("visible");
  } finally {
    btn.disabled = false;
    btn.textContent = "Verify";
  }
}

function render(inv, receiptAvailable) {
  const paid = inv.status === "PAID";
  result.innerHTML = `
    <div class="result-head">
      <div class="invoice-no">${escapeHtml(inv.invoiceNumber)}</div>
      <div class="status ${paid ? "paid" : "unpaid"}">${paid ? "✓ PAID" : "UNPAID"}</div>
    </div>
    <div class="details">
      <div class="detail"><div class="k">School</div><div class="v">${escapeHtml(inv.school)}</div></div>
      <div class="detail"><div class="k">Payment type</div><div class="v">${escapeHtml(inv.paymentType)}</div></div>
      <div class="detail"><div class="k">Amount</div><div class="v">${money(inv.amount)}</div></div>
      <div class="detail"><div class="k">Issued</div><div class="v">${fmtDate(inv.issued)}</div></div>
      ${paid ? `<div class="detail"><div class="k">Paid</div><div class="v">${fmtDate(inv.paidDate)}</div></div>` : ""}
    </div>
    <div class="actions">
      <a class="action secondary" href="javascript:window.print()">Print / Save invoice</a>
      <a class="action primary ${receiptAvailable ? "" : "disabled"}" href="receipt.html?inv=${encodeURIComponent(inv.invoiceNumber)}">
        ${receiptAvailable ? "Download receipt" : "Receipt unavailable until payment"}
      </a>
    </div>
    ${paid ? "" : `<div class="notice">Payment has not been confirmed. The receipt download becomes available once the backend records this invoice as paid.</div>`}
  `;
  result.classList.add("visible");
}

// wire up form + demo chips
document.getElementById("verifyForm").addEventListener("submit", e => {
  e.preventDefault();
  verify(input.value);
});

document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    input.value = chip.dataset.inv;
    verify(input.value);
  });
});

// deep link: /verify?inv=REF or URL param
const params = new URLSearchParams(location.search);
if (params.get("inv")) {
  input.value = params.get("inv");
  verify(input.value);
}
