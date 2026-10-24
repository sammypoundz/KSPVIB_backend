import React, { useRef, useState, useEffect } from "react";
import { verifyInvoice, money, fmtDate, downloadDocPdf, fetchReceipt } from "./api.js";
import { navigate, useRoute } from "./router.jsx";
import { Receipt } from "./ReceiptPage.jsx";
import logo from "./assets/3.png";
import logo1 from "./assets/1.png";
import logo2 from "./assets/2.png";
import QrCode from "./QrCode.jsx";

export default function App() {
  const [ref, setRef] = useState(
    new URLSearchParams(window.location.search).get("inv") || "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [receiptAvailable, setReceiptAvailable] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  // Off-screen container where the receipt is rendered before PDF capture.
  // verifyUrl is built from the page origin, matching the on-page receipt.
  const receiptSlot = useRef(null);
  const verifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify?inv=${encodeURIComponent(
          invoice?.invoiceNumber || "",
        )}`
      : "";

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
        <h1 className="portal-title">KANO STATE GOVERNMENT</h1>
        <p className="portal-subtitle">
          Voluntary and Private Education Portal - Invoice Verification
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
          </form>

          <div className="result visible" aria-live="polite">
            {error && (
              <div className="notice">
                <strong>Not found.</strong> {error}
              </div>
            )}

            {invoice && (
              <>
                <div className="details">
                  <div className="result-head detail-head">
                    <div className="invoice-no">{invoice.invoiceNumber}</div>
                    <div className={`status ${paid ? "paid" : "unpaid"}`}>
                      {paid ? "Paid" : "Unpaid"}
                    </div>
                  </div>
                  <Detail k="School" v={invoice.school} />
                  <Detail k="Payment type" v={invoice.paymentType} />
                  <Detail k="Amount" v={money(invoice.amount)} />
                  <Detail k="Issued" v={fmtDate(invoice.issued)} />
                  {paid && <Detail k="Paid" v={fmtDate(invoice.paidDate)} />}
                </div>
                <div className="actions">
                  {paid && receiptAvailable ? (
                    <button
                      className="action primary"
                      disabled={downloadingReceipt}
                      onClick={async () => {
                        try {
                          setDownloadingReceipt(true);
                          const data = await fetchReceipt(invoice.invoiceNumber);
                          setReceiptData(data.receipt);
                          if (!receiptSlot.current) throw new Error("Preparing receipt failed. Try again.");
                          // Wait for the off-screen receipt (logos, QR) to paint:
                          // poll briefly until the QR <img> has rendered.
                          for (let i = 0; i < 30; i++) {
                            if (receiptSlot.current.querySelector("img.qr-img")) break;
                            await new Promise((r) => setTimeout(r, 50));
                          }
                          await new Promise((r) => setTimeout(r, 100));
                          await downloadDocPdf(
                            "receipt",
                            invoice.invoiceNumber,
                            receiptSlot.current.querySelector(".doc-paper"),
                          );
                        } catch (err) {
                          alert(`Download failed: ${err.message}`);
                        } finally {
                          setDownloadingReceipt(false);
                        }
                      }}
                    >
                      {downloadingReceipt ? "Preparing…" : "Download receipt"}
                    </button>
                  ) : (
                    <a
                      className="action primary"
                      href={`/invoice?inv=${encodeURIComponent(invoice.invoiceNumber)}`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(
                          `/invoice?inv=${encodeURIComponent(invoice.invoiceNumber)}`,
                        );
                      }}
                    >
                      View invoice
                    </a>
                  )}
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
      </main>

      {/* Off-screen receipt mount used for direct PDF download — never visible */}
      <div
        ref={receiptSlot}
        aria-hidden="true"
        style={{
          position: "fixed",
          left: "-10000px",
          top: 0,
          width: 860,
        }}
      >
        {downloadingReceipt && (
          <article
            className="doc-paper receipt-doc"
            style={{ width: 860, maxWidth: "none", background: "#fff" }}
          >
            <Receipt
              {...(receiptData || invoice)}
              verifyUrl={verifyUrl}
            />
          </article>
        )}
      </div>

      <footer>
        This page confirms an invoice issued by the Kano State VPE Portal.
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
