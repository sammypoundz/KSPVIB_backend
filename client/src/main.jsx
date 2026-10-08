import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ReceiptPage from "./ReceiptPage.jsx";
import DashboardPage from "./DashboardPage.jsx";
import CreateInvoicePage from "./CreateInvoicePage.jsx";
import InvoicePage from "./InvoicePage.jsx";
import LoginPage from "./LoginPage.jsx";
import Shell from "./Shell.jsx";
import { useRoute, navigate } from "./router.jsx";
import { checkAuth, onAuthChange } from "./auth.js";
import "./styles.css";

function Page({ path }) {
  if (path === "/login") return <LoginPage />;
  if (path === "/receipt") return <ReceiptPage />;
  if (path === "/invoice") return <InvoicePage />;
  if (path === "/create") return <CreateInvoicePage />;
  if (path === "/verify") return <App />; // scan / verify page
  return <DashboardPage />; // "/" — invoice dashboard
}

function Root() {
  const path = useRoute();
  // null = still validating the token; user object = signed in; false = not
  const [admin, setAdmin] = React.useState(null);

  // Validate the stored JWT against the server on mount and after login/logout
  const refresh = React.useCallback(() => {
    checkAuth().then((user) => setAdmin(user || false));
  }, []);
  useEffect(refresh, [refresh]);
  useEffect(() => onAuthChange(refresh), [refresh]);

  // Admin-only routes require login — bounce to /login otherwise
  useEffect(() => {
    const needsAdmin = path === "/" || path === "/create";
    if (needsAdmin && admin === false) navigate("/login");
  }, [path, admin]);

  // Nav bar logic: admin sees the nav everywhere (verify/receipt/invoice
  // included); the public sees standalone pages without the nav.
  const isAdminView = !!admin && path !== "/login";
  if (admin === null) return null; // validating token — render nothing yet
  return isAdminView ? (
    <Shell>{<Page path={path} />}</Shell>
  ) : (
    <Page path={path} />
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
