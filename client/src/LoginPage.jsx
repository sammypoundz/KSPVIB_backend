import React, { useState } from "react";
import { login, notifyAuthChange } from "./auth.js";
import { navigate } from "./router.jsx";
import logo from "./assets/KSPVIB.jpg.jpeg";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      notifyAuthChange();
      navigate("/");
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="layout login-layout">
      <main className="page login-page">
        <section className="card login-card">
          <img className="logo-img login-logo" src={logo} alt="KSPVIB logo" />
          <h1>Admin Login</h1>
          <p className="lead">
            Sign in to manage invoices on the KSPVIB payment portal.
          </p>
          <form onSubmit={submit} className="login-form" autoComplete="off">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                spellCheck={false}
                placeholder="admin@kspvib.gov.ng"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              className="primary login-btn"
              type="submit"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
            {error && (
              <div className="notice">
                <strong>Login failed.</strong> {error}
              </div>
            )}
          </form>
          <div className="login-hint">
            Default credentials (prototype): <code>admin@kspvib.gov.ng</code>{" "}
            / <code>admin123</code>
          </div>
        </section>
      </main>
    </div>
  );
}
