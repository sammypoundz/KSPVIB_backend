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
  // authState.status "checking" = validating the token (guard must NOT bounce
  // during this — otherwise logging in races the redirect back to /login);
  // "ready" with admin user object = signed in; admin false = signed out.
  const [authState, setAuthState] = React.useState({
    status: "checking",
    admin: null,
  });

  // Validate the stored JWT against the server on mount and after login/logout
  const refresh = React.useCallback(() => {
    setAuthState((s) => ({ ...s, status: "checking" }));
    checkAuth().then((user) =>
      setAuthState({ status: "ready", admin: user || false }),
    );
  }, []);
  useEffect(refresh, [refresh]);
  useEffect(() => onAuthChange(refresh), [refresh]);

  // Admin-only routes require login — bounce to /login otherwise. Only bounce
  // once the check has finished: while "checking" the user may have just
  // logged in and the result is still in flight.
  useEffect(() => {
    const needsAdmin = path === "/" || path === "/create";
    if (authState.status === "ready" && needsAdmin && authState.admin === false)
      navigate("/login");
  }, [path, authState]);

  // Nav bar logic: admin sees the nav everywhere (verify/receipt/invoice
  // included); the public sees standalone pages without the nav.
  const admin = authState.admin;
  const isAdminView = !!admin && path !== "/login";
  if (authState.status === "checking") return null; // validating token
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
