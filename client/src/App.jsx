import React, { useState, useEffect } from "react";
import { verifyInvoice, money, fmtDate } from "./api.js";
import { navigate, useRoute } from "./router.jsx";

const DEMOS = [
  { ref: "INV-2026-0001", label: "INV-2026-0001 · Paid" },
  { ref: "INV-2026-0004", label: "INV-2026-0004 · Unpaid" },
];

export default function App() {
  const [ref, setRef] = useState(
    new URLSearchParams(window.location.search).get("inv") || "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [receiptAvailable, setReceiptAvailable] = useState(false);

  useRoute(); // keep in sync with back/forward

  const verify = async (value) => {
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setInvoice(null);
    try {
      const data = await verifyInvoice(trimmed);
      setInvoice(data.invoice);
      setReceiptAvailable(data.receiptAvailable);
      window.history.replaceState(
        {},
        "",
        `/verify?inv=${encodeURIComponent(trimmed)}`,
      );
    } catch (err) {
      setError(
        err.message.includes("Failed to fetch")
          ? "Connection error. Could not reach the verification server."
          : err.message,
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("inv");
    if (initial) verify(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paid = invoice && invoice.status === "PAID";

  return (
    <div className="layout">
      <main className="page hero">
        <h1>Invoice Verification</h1>
        <p className="lead">
          Confirm the authenticity and payment status of an invoice issued by
          the Kano State Private and Voluntary Institutions Board.
        </p>

        <section className="card">
          <form
            className="verify-form"
            onSubmit={(e) => {
              e.preventDefault();
              verify(ref);
            }}
            autoComplete="off"
          >
            <label htmlFor="invoiceNumber">Invoice number</label>
            <div className="row">
              <input
                id="invoiceNumber"
                placeholder="e.g. INV-2026-0001"
                spellCheck={false}
                value={ref}
                onChange={(e) => setRef(e.target.value)}
              />
              <button type="submit" disabled={loading}>
                {loading ? "Verifying…" : "Verify"}
              </button>
            </div>
            <div className="hints">
              {DEMOS.map((d) => (
                <button
                  type="button"
                  key={d.ref}
                  className="chip"
                  onClick={() => {
                    setRef(d.ref);
                    verify(d.ref);
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </form>

          <div className="result visible" aria-live="polite">
            {error && (
              <div className="notice">
                <strong>Not found.</strong> {error}
              </div>
            )}

            {invoice && (
              <>
                <div className="result-head">
                  <div className="invoice-no">{invoice.invoiceNumber}</div>
                  <div className={`status ${paid ? "paid" : "unpaid"}`}>
                    {paid ? "✓ PAID" : "UNPAID"}
                  </div>
                </div>
                <div className="details">
                  <Detail k="School" v={invoice.school} />
                  <Detail k="Payment type" v={invoice.paymentType} />
                  <Detail k="Amount" v={money(invoice.amount)} />
                  <Detail k="Issued" v={fmtDate(invoice.issued)} />
                  {paid && <Detail k="Paid" v={fmtDate(invoice.paidDate)} />}
                </div>
                <div className="actions">
                  <a
                    className="action secondary"
                    href={`/invoice?inv=${encodeURIComponent(invoice.invoiceNumber)}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(
                        `/invoice?inv=${encodeURIComponent(invoice.invoiceNumber)}`,
                      );
                    }}
                  >
                    Print invoice
                  </a>
                  <a
                    className={`action primary ${receiptAvailable ? "" : "disabled"}`}
                    href={
                      receiptAvailable
                        ? `/receipt?inv=${encodeURIComponent(invoice.invoiceNumber)}`
                        : "#"
                    }
                    onClick={(e) => {
                      if (!receiptAvailable) {
                        e.preventDefault();
                        return;
                      }
                      e.preventDefault();
                      navigate(
                        `/receipt?inv=${encodeURIComponent(invoice.invoiceNumber)}`,
                      );
                    }}
                  >
                    {receiptAvailable
                      ? "Download receipt"
                      : "Receipt unavailable until payment"}
                  </a>
                </div>
                {!paid && (
                  <div className="notice">
                    Payment has not been confirmed. The receipt download becomes
                    available once the backend records this invoice as paid.
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <ul className="features">
          <li>
            <strong>Instant check</strong>
            <span>
              Status is verified against the official records in real time.
            </span>
          </li>
          <li>
            <strong>Official receipts</strong>
            <span>Download receipts only after payment is confirmed.</span>
          </li>
          <li>
            <strong>Secure by design</strong>
            <span>
              Status comes from the server — never from the QR code itself.
            </span>
          </li>
        </ul>
      </main>

      <footer>
        This page confirms invoices issued through the Kano State VPE Portal.
        <br />
        Kano State Ministry of Education · KSPVIB
      </footer>
    </div>
  );
}

function Detail({ k, v }) {
  return (
    <div className="detail">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}
