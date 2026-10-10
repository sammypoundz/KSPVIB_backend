import React, { useEffect, useRef, useState } from "react";
import { fetchReceipt, money, fmtDate, downloadDocPdf } from "./api.js";
import QrCode from "./QrCode.jsx";
import logo from "./assets/3.png";
import logo1 from "./assets/1.png";
import logo2 from "./assets/2.png";

export default function ReceiptPage() {
  const ref =
    new URLSearchParams(window.location.search).get("inv") || "INV-2026-0001";
  const [state, setState] = useState({
    loading: true,
    error: null,
    receipt: null,
    verifyUrl: null,
    downloading: false,
  });
  const docRef = useRef(null); // .doc-paper element captured into the PDF

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
        <button
          disabled={state.downloading}
          onClick={async () => {
            try {
              setState((s) => ({ ...s, downloading: true }));
              await downloadDocPdf("receipt", ref, docRef.current);
            } catch (err) {
              alert(`Download failed: ${err.message}`);
            } finally {
              setState((s) => ({ ...s, downloading: false }));
            }
          }}
        >
          {state.downloading ? "Preparing…" : "Download PDF"}
        </button>
        <button onClick={() => window.print()}>Print</button>
        <a href="/verify">← Back to verification</a>
      </div>
      <article className="doc-paper receipt-doc" ref={docRef}>
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
        <div className="logo-row">
          <img className="logo-img" src={logo2} alt="Ministry of Education logo" />
          <img className="logo-img" src={logo} alt="KSPVIB logo" />
          <img className="logo-img" src={logo1} alt="Kano State Government logo" />
        </div>
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
          <span className="pill paid">
            <span className="check-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>{" "}
            PAID
          </span>
        </div>
      </div>
      <div className="boxes">
        <div className="box">
          <div className="cap">RECEIVED FROM</div>
          <div className="val school">{r.school}</div>
          {r.address && r.address !== "—" && (
            <div className="sub">{r.address}</div>
          )}
          {r.lga && r.lga !== "—" && (
            <div className="sub">{`${r.lga} LGA`}</div>
          )}
          {/* Kano State is permanent on every receipt */}
          <div className="sub">{r.state || "Kano State"}</div>
        </div>
        <Box cap="CATEGORY" val={r.category || "—"}   sub={
            [
              r.session && r.session !== "—" ? r.session : null,
              r.term && r.term !== "—" ? r.term : null,
            ]
              .filter(Boolean)
              .join(" – ") || null
          }
        />
        <div className="box">
          <div className="cap">PROPRIETOR</div>
          <div className="val">{r.proprietor || "—"}</div>
          {r.phone && r.phone !== "—" && (
            <div className="sub">{r.phone}</div>
          )}
          {r.email && r.email !== "—" && (
            <div className="sub">{r.email}</div>
          )}
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th className="col-idx">#</th>
            <th>DESCRIPTION</th>
            <th className="col-amt">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>{r.description}</td>
            <td className="amt">{money(r.amount)}</td>
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
          <div className="foot-note">
            Kano State Ministry of Education
            <br />
            Private and Voluntary Institutions Board (KSPVIB)
          </div>
        </div>
        <div className="qr-block">
          <QrCode value={verifyUrl} />
          <div className="qr-caption">Scan to verify</div>
          <a className="verify-url" href={verifyUrl}>
            {verifyUrl}
          </a>
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
      {sub && <div className="sub cat-sub">{sub}</div>}
    </div>
  );
}
