import React, { useState } from "react";
import { createInvoice } from "./api.js";
import { navigate } from "./router.jsx";

const CATEGORIES = [
  "Tuition Fees",
  "Registration",
  "Renewal",
  "Examination Fee",
  "Accreditation",
  "Fees",
  "Tax Fee",
  "Other",
];
const DESCRIPTIONS = {
  "Tuition Fees": "Tuition Fees",
  Registration: "Registration Fee",
  Renewal: "Renewal Fee",
  "Examination Fee": "Examination Fee",
  Accreditation: "Accreditation Fee",
  Fees: "Fees",
  "Tax Fee": "Tax Fee",
  Other: "Other Fee",
};

export default function CreateInvoicePage() {
  const [form, setForm] = useState({
    school: "",
    proprietor: "",
    paymentType: "Tuition Fees",
    amount: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await createInvoice({
        school: form.school.trim(),
        proprietor: form.proprietor.trim(),
        paymentType: form.paymentType,
        amount: Number(form.amount),
      });
      navigate(`/verify?inv=${encodeURIComponent(data.invoice.invoiceNumber)}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="hero">
        <h1>Create Invoice</h1>
        <p className="lead">
          Enter the invoice data. The description is derived from the selected
          category.
        </p>
      </div>

      <section className="card create-card">
        <form onSubmit={submit} className="create-form" autoComplete="off">
          <div className="field">
            <label htmlFor="school">Received From</label>
            <input
              id="school"
              required
              placeholder="e.g. PRIVATE SCHOOL TEST II"
              value={form.school}
              onChange={set("school")}
            />
          </div>
          <div className="field">
            <label htmlFor="proprietor">Proprietor</label>
            <input
              id="proprietor"
              placeholder="e.g. Alhaji / Mrs. ..."
              value={form.proprietor}
              onChange={set("proprietor")}
            />
          </div>
          <div className="field">
            <label htmlFor="category">Category / Payment Type</label>
            <select
              id="category"
              value={form.paymentType}
              onChange={set("paymentType")}
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="amount">Amount (₦)</label>
            <input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.amount}
              onChange={set("amount")}
            />
          </div>
          <div className="field">
            <label htmlFor="description">Description</label>
            <input
              id="description"
              readOnly
              value={DESCRIPTIONS[form.paymentType]}
            />
          </div>
          <div className="field submit-field">
            <button className="primary" type="submit" disabled={loading}>
              {loading ? "Generating…" : "Generate Invoice"}
            </button>
          </div>
          {error && (
            <div className="notice" style={{ gridColumn: "1 / -1" }}>
              <strong>Error.</strong> {error}
            </div>
          )}
        </form>
      </section>
    </>
  );
}
