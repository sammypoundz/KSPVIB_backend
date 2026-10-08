// JWT-based auth — the server issues a signed token (backed by the
// admin_users collection in MongoDB); the token is kept in localStorage and
// validated against GET /api/auth/me so the app knows if an admin is signed in.

const TOKEN_KEY = "kspvib_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Asks the server whether the stored token is valid. Resolves to the user
// object or null (never throws).
export async function checkAuth() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      clearToken(); // expired / invalid — discard it
      return null;
    }
    const data = await res.json();
    return data.ok ? data.user : null;
  } catch {
    return null;
  }
}

// POST /api/auth/login — throws on bad credentials
export async function login(email, password) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Invalid email or password.");
  setToken(data.token);
  return data.user;
}

export async function logout() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // stateless JWT — ignoring network errors is fine
  }
  clearToken();
}

// Subscribe so the app re-renders when login state changes
const listeners = new Set();
export function onAuthChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function notifyAuthChange() {
  listeners.forEach((fn) => fn());
}
