import React, { useState, useEffect } from "react";
import { fetchInvoices, money, fmtDate, markInvoicePaid } from "./api.js";
import { navigate } from "./router.jsx";

export default function DashboardPage() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
    page: 1,
    limit: 10,
  });

  const load = (page = state.page, limit = state.limit) => {
    setState((s) => ({ ...s, loading: true, page, limit }));
    fetchInvoices(page, limit)
      .then((data) =>
        setState((s) => ({ ...s, loading: false, error: null, data })),
      )
      .catch((err) =>
        setState((s) => ({
          ...s,
          loading: false,
          error: err.message,
          data: null,
        })),
      );
  };

  useEffect(() => load(state.page, state.limit), []);

  const { data } = state;

  return (
    <>
      <div className="hero">
        <h1>Invoice Dashboard</h1>
        <p className="lead">
          Full invoice lifecycle — create, scan/verify, confirm payment and
          print receipts.
        </p>
      </div>

      {state.loading && <div className="notice">Loading dashboard…</div>}
      {state.error && (
        <div className="notice">
          <strong>Could not load.</strong> {state.error}
        </div>
      )}

      {data && (
        <>
          <div className="grid">
            <div className="stat">
              <b>{data.stats.total}</b>
              <span>Total invoices</span>
            </div>
            <div className="stat stat-green">
              <b>{data.stats.paid}</b>
              <span>Paid</span>
            </div>
            <div className="stat stat-red">
              <b>{data.stats.pending}</b>
              <span>Pending / Unpaid</span>
            </div>
          </div>

          <section className="card table-card">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Billed To</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Issued</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((inv) => (
                  <tr key={inv.invoiceNumber}>
                    <td>
                      <b>{inv.invoiceNumber}</b>
                    </td>
                    <td>{inv.school}</td>
                    <td>{inv.paymentType}</td>
                    <td>{money(inv.amount)}</td>
                    <td>{fmtDate(inv.issued)}</td>
                    <td>
                      <span
                        className={`pill ${inv.status === "PAID" ? "paid" : "unpaid"}`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="row-actions">
                      <button
                        className="secondary"
                        onClick={() => navigate(`/verify?inv=${inv.invoiceNumber}`)}
                      >
                        Verify
                      </button>
                      {inv.status !== "PAID" && (
                        <button
                          className="primary"
                          onClick={async () => {
                            try {
                              await markInvoicePaid(inv.invoiceNumber);
                              load();
                            } catch (err) {
                              alert(err.message);
                            }
                          }}
                        >
                          Mark paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.pagination && (
              <div className="pagination">
                <button
                  className="secondary"
                  disabled={data.pagination.page <= 1 || state.loading}
                  onClick={() => load(data.pagination.page - 1)}
                >
                  ← Prev
                </button>
                <span className="page-info">
                  Page {data.pagination.page} of {data.pagination.totalPages}
                  <span className="muted">
                    {" "}· {data.pagination.totalItems} invoices
                  </span>
                </span>
                <button
                  className="secondary"
                  disabled={
                    data.pagination.page >= data.pagination.totalPages ||
                    state.loading
                  }
                  onClick={() => load(data.pagination.page + 1)}
                >
                  Next →
                </button>
                <select
                  value={state.limit}
                  disabled={state.loading}
                  onChange={(e) => load(1, Number(e.target.value))}
                >
                  {[10, 25, 50].map((n) => (
                    <option key={n} value={n}>
                      {n} / page
                    </option>
                  ))}
                </select>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
