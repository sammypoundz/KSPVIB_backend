import React, { useState } from "react";
import { createInvoice } from "./api.js";
import { navigate } from "./router.jsx";

const CATEGORIES = ["Private", "Community-Based"];
const PAYMENT_TYPES = [
  "Tuition Fees",
  "Registration",
  "Renewal",
  "Examination Fee",
  "Accreditation",
  "Tax",
  "Other",
];
const DESCRIPTIONS = {
  "Tuition Fees": "Tuition Fees",
  Registration: "Registration Fee",
  Renewal: "Renewal Fee",
  "Examination Fee": "Examination Fee",
  Accreditation: "Accreditation Fee",
  Tax: "Tax",
  Other: "Other Fee",
};

const TERMS = ["First Term", "Second Term", "Third Term"];
const GRADES = ["Grade A", "Grade B", "Grade C", "Grade D"];
const LGAS = [
  "Ajingi", "Albasu", "Bagwai", "Bebeji", "Bichi", "Bunkure", "Dala",
  "Dambatta", "Dawakin Kudu", "Dawakin Tofa", "Doguwa", "Fagge", "Gabasawa",
  "Garko", "Garun Mallam", "Gaya", "Gezawa", "Gwale", "Kano Municipal",
  "Karaye", "Kibiya", "Kiru", "Kumbotso", "Kunchi", "Kura", "Makoda",
  "Minjibir", "Nasarawa", "Rano", "Rimin Gado", "Roggo", "Shanono",
  "Sumaila", "Takai", "Tarauni", "Tofa", "Tudun Wada", "Ungogo", "Warawa", "Wudil",
];

export default function CreateInvoicePage() {
  const [form, setForm] = useState({
    school: "",
    proprietor: "",
    category: "Private",
    session: "",
    paymentType: "Tuition Fees",
    amount: "",
    lga: "Nasarawa",
    grade: "Grade B",
    terms: ["First Term"],
    phone: "",
    email: "",
    address: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const toggleTerm = (t) =>
    setForm((f) => ({
      ...f,
      terms: f.terms.includes(t)
        ? f.terms.filter((x) => x !== t)
        : [...f.terms, t],
    }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await createInvoice({
        school: form.school.trim(),
        proprietor: form.proprietor.trim(),
        category: form.category,
        session: form.session.trim(),
        paymentType: form.paymentType,
        amount: Number(form.amount),
        lga: form.lga,
        grade: form.grade,
        terms: form.terms,
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
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
          payment type.
        </p>
      </div>

      <section className="card create-card">
        <form onSubmit={submit} className="create-form" autoComplete="off">
          <div className="field">
            <label htmlFor="school">Billed To (School Name)</label>
            <input
              id="school"
              required
              placeholder="e.g. Private School Test II"
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
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={form.category}
              onChange={set("category")}
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="session">Session</label>
            <input
              id="session"
              type="text"
              placeholder="e.g. 2026/2027"
              value={form.session}
              onChange={set("session")}
            />
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
            <label htmlFor="paymentType">Payment Type</label>
            <select
              id="paymentType"
              value={form.paymentType}
              onChange={set("paymentType")}
            >
              {PAYMENT_TYPES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="description">Description</label>
            <input
              id="description"
              readOnly
              value={DESCRIPTIONS[form.paymentType] || "Other Fee"}
            />
          </div>
          <div className="field">
            <label htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              type="tel"
              placeholder="e.g. 0803 000 0000"
              value={form.phone}
              onChange={set("phone")}
            />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="e.g. school@example.com"
              value={form.email}
              onChange={set("email")}
            />
          </div>
          <div className="field">
            <label htmlFor="address">School Address</label>
            <input
              id="address"
              placeholder="e.g. 12 Zoo Road, Kano"
              value={form.address}
              onChange={set("address")}
            />
          </div>
          <div className="field">
            <label htmlFor="lga">LGA</label>
            <select id="lga" value={form.lga} onChange={set("lga")}>
              {LGAS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="grade">School Grade</label>
            <select id="grade" value={form.grade} onChange={set("grade")}>
              {GRADES.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Term</label>
            <div className="checkbox-group">
              {TERMS.map((t) => (
                <label key={t} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={form.terms.includes(t)}
                    onChange={() => toggleTerm(t)}
                  />
                  <span>{t}</span>
                </label>
              ))}
            </div>
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
