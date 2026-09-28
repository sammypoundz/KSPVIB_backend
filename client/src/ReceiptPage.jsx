import React, { useState, useEffect } from "react";
import { fetchReceipt, money, fmtDate } from "./api.js";
import QrCode from "./QrCode.jsx";
import logo from "./assets/KSPVIB.jpg.jpeg";

export default function ReceiptPage() {
  const ref =
    new URLSearchParams(window.location.search).get("inv") || "INV-2026-0001";
  const [state, setState] = useState({
    loading: true,
    error: null,
    receipt: null,
    verifyUrl: null,
  });

  useEffect(() => {
    let alive = true;
    fetchReceipt(ref)
      .then(
        (data) =>
          alive &&
          setState({
            loading: false,
            receipt: data.receipt,
            verifyUrl: data.verifyUrl,
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
    document.title = state.receipt
      ? `Payment Receipt ${state.receipt.invoiceNumber} — KSPVIB`
      : state.error
        ? "Receipt unavailable — KSPVIB"
        : "Receipt — KSPVIB";
  }, [state]);

  return (
    <div className="doc-page">
      <div className="printbar">
        <button onClick={() => window.print()}>Print / Save receipt as PDF</button>
        <a href="/verify">← Back to verification</a>
      </div>
      <article className="doc-paper receipt-doc">
        {state.loading && <div className="notice">Loading receipt…</div>}
        {state.error && (
          <div className="notice">
            <strong>Receipt unavailable.</strong> {state.error}
          </div>
        )}
        {state.receipt && (
          <Receipt {...state.receipt} verifyUrl={state.verifyUrl} />
        )}
      </article>
    </div>
  );
}

function Receipt(props) {
  const { verifyUrl, ...r } = props;
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
          <div className="title">Payment Receipt</div>
          <p className="intro">
            This is your official receipt from the Kano State Private and
            Voluntary Institutions Board (KSPVIB).
          </p>
        </div>
        <div className="meta">
          <div>Receipt for</div>
          <div className="no">{r.invoiceNumber}</div>
          <div>Paid: {fmtDate(r.paidDate)}</div>
          <span className="paid">✓ PAID</span>
        </div>
      </div>
      <div className="boxes">
        <Box cap="RECEIVED FROM" val={r.school} sub={r.state} />
        <Box cap="CATEGORY" val={r.category} />
        <Box cap="PROPRIETOR" val={r.proprietor} />
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
            <td>{r.description}</td>
            <td>{money(r.amount)}</td>
          </tr>
        </tbody>
      </table>
      <div className="total">
        <span>Total Paid</span>
        <strong>{money(r.amount)}</strong>
      </div>
      <div className="bottom">
        <div className="thanks">
          Thank you for your payment.
          <br />
          Keep this receipt for your records.
          <br />
          <br />
          Kano State Ministry of Education
          <br />
          Private and Voluntary Institutions Board (KSPVIB)
        </div>
        <div className="qr-block">
          <QrCode value={verifyUrl ? new URL(verifyUrl, window.location.origin).href : ""} />
          <div className="verify-url">Scan to verify this payment: {verifyUrl}</div>
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
