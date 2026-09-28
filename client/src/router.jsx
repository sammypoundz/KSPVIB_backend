import React from "react";

// Minimal client-side router: reads the pathname, exposes navigate()
export function route() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return path;
}

export function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function useRoute() {
  const [path, setPath] = React.useState(route());
  React.useEffect(() => {
    const update = () => {
      console.error("[router] popstate ->", route());
      setPath(route());
    };
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return path;
}
