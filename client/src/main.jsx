import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ReceiptPage from "./ReceiptPage.jsx";
import DashboardPage from "./DashboardPage.jsx";
import CreateInvoicePage from "./CreateInvoicePage.jsx";
import InvoicePage from "./InvoicePage.jsx";
import Shell from "./Shell.jsx";
import { useRoute } from "./router.jsx";
import "./styles.css";

function Page({ path }) {
  if (path === "/receipt") return <ReceiptPage />;
  if (path === "/invoice") return <InvoicePage />;
  if (path === "/create") return <CreateInvoicePage />;
  if (path === "/verify") return <App />; // scan / verify page
  return <DashboardPage />; // "/" — invoice dashboard
}

function Root() {
  const path = useRoute(); // re-renders on every navigation (back/forward too)
  // Receipt/print page renders standalone (print-friendly); everything else lives in the shell
  return path === "/receipt" || path === "/invoice" ? (
    <Page path={path} />
  ) : (
    <Shell>{<Page path={path} />}</Shell>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
