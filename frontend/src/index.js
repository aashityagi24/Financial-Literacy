import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const rootEl = document.getElementById("root");

// Use hydrateRoot when react-snap has pre-rendered HTML into the root div,
// otherwise fall back to createRoot (normal dev/non-prerendered production).
if (rootEl.hasChildNodes()) {
  ReactDOM.hydrateRoot(
    rootEl,
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
