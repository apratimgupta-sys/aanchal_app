import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "ux4g-web-components/styles.css";
import "ux4g-web-components/design-system";
import "./styles.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
