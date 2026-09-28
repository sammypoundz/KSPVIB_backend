import React from "react";
import { navigate, useRoute } from "./router.jsx";
import logo from "./assets/KSPVIB.jpg.jpeg";

// Shared app shell — sticky top bar + nav, wrapping every page
export default function Shell({ children }) {
  const path = useRoute();
  const active = (href) => path === href || (href === "/verify" && path.startsWith("/verify"));

  const NavButton = ({ href, children }) => (
    <button
      className={`nav-btn ${active(href) ? "nav-active" : ""}`}
      onClick={() => navigate(href)}
    >
      {children}
    </button>
  );

  return (
    <div className="layout">
      <header className="topbar">
        <img className="logo-img topbar-logo" src={logo} alt="KSPVIB logo" />
        <div className="topbar-text">
          <div className="gov">KSPVIB PAYMENT PORTAL</div>
          <div className="portal">
            Kano State Private &amp; Voluntary Institutions Board
          </div>
        </div>
        <nav className="nav">
          <NavButton href="/">Dashboard</NavButton>
          <NavButton href="/create">Create Invoice</NavButton>
          <NavButton href="/verify">Verify Invoice</NavButton>
        </nav>
      </header>
      <main className="page">{children}</main>
      <footer>
        Kano State Ministry of Education · KSPVIB — Invoice &amp; Payment Portal
      </footer>
    </div>
  );
}
