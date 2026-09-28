import React, { useEffect, useState } from "react";
import { verifyInvoice, money, fmtDate } from "./api.js";
import QrCode from "./QrCode.jsx";
import logo from "./assets/KSPVIB.jpg.jpeg";

// Printable invoice document — opened at /invoice?inv=INV-....
// Includes a QR code that links to the verification page so anyone holding the
// printed copy can scan it to confirm authenticity and payment status.
export default function InvoicePage() {
  const ref = new URLSearchParams(window.location.search).get("inv") || "";
  const [state, setState] = useState({
    loading: true,
    error: null,
    invoice: null,
    verifyUrl: null,
  });

  useEffect(() => {
    let alive = true;
    verifyInvoice(ref)
      .then(
        (data) =>
          alive &&
          setState({
            loading: false,
            invoice: data.invoice,
            verifyUrl: `${window.location.origin}/verify?inv=${encodeURIComponent(
              data.invoiceNumber,
            )}`,
          }),
      )
      .catch(
        (err) => alive && setState({ loading: false, error: err.message }),
      );
    return () => {
      alive = false;
    };
    }, [ref]);

  // Browser tab / PDF filename states the document type explicitly
  useEffect(() => {
    document.title = state.invoice
      ? `Invoice ${state.invoice.invoiceNumber} — KSPVIB`
      : state.error
        ? "Invoice unavailable — KSPVIB"
        : "Invoice — KSPVIB";
  }, [state]);

  return (
    <div className="doc-page">
      <div className="printbar">
        <button onClick={() => window.print()}>
          Print / Save invoice as PDF
        </button>
        <a href="/verify">← Back to verification</a>
      </div>
      <article className="doc-paper invoice-doc">
        {state.loading && <div className="notice">Loading invoice…</div>}
        {state.error && (
          <div className="notice">
            <strong>Invoice unavailable.</strong> {state.error}
          </div>
        )}
        {state.invoice && (
          <InvoiceDoc {...state.invoice} verifyUrl={state.verifyUrl} />
        )}
      </article>
    </div>
  );
}

function InvoiceDoc({ verifyUrl, ...inv }) {
  const paid = inv.status === "PAID";
  return (
    <>
      <div className="rhead">
        <img className="logo-img" src={logo} alt="KSPVIB logo" />
        <div className="gov">KANO STATE GOVERNMENT</div>
        <div className="ministry">MINISTRY OF EDUCATION</div>
        <div className="board">
          KANO STATE PRIVATE AND VOLUNTARY INSTITUTIONS BOARD (KSPVIB)
        </div>
        <div className="tagline">Quality Education for a Brighter Kano</div>
      </div>
      <div className="title-row">
        <div>
          <div className="title">Invoice</div>
          <p className="intro">
            This is an official invoice issued by the Kano State Private and
            Voluntary Institutions Board (KSPVIB). It is a request for payment
            — it is <strong>not</strong> proof of payment. Scan the QR code to
            verify its current status at any time.
          </p>
        </div>
        <div className="meta">
          <div>Invoice No.</div>
          <div className="no">{inv.invoiceNumber}</div>
          <div>Issued: {fmtDate(inv.issued)}</div>
          <span className={`pill ${paid ? "paid" : "unpaid"}`}>
            {paid ? "✓ PAID" : "UNPAID"}
          </span>
        </div>
      </div>
      <div className="boxes">
        <Box cap="RECEIVED FROM" val={inv.school} sub={inv.state} />
        <Box cap="CATEGORY" val={inv.paymentType} />
        <Box cap="PROPRIETOR" val={inv.proprietor || "—"} />
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>DESCRIPTION</th>
            <th>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>{inv.description}</td>
            <td>{money(inv.amount)}</td>
          </tr>
        </tbody>
      </table>
      <div className="total">
        <span>Total Due</span>
        <strong>{money(inv.amount)}</strong>
      </div>
      <div className="bottom">
        <div className="thanks">
          Make payment through the KSPVIB portal.
          <br />
          A receipt becomes available once payment is confirmed.
          <br />
          <br />
          Kano State Ministry of Education
          <br />
          Private and Voluntary Institutions Board (KSPVIB)
        </div>
        <div className="qr-block">
          <QrCode value={verifyUrl} />
          <div className="verify-url">
            Scan to verify this invoice: {verifyUrl}
          </div>
        </div>
      </div>
    </>
  );
}

function Box({ cap, val, sub }) {
  return (
    <div className="box">
      <div className="cap">{cap}</div>
      <div className="val">{val}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
