import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { useUi } from "./stores/ui";
import { applyAppearance, useAppearance } from "./stores/appearance";
import "./styles/app.css";
import "./styles/personal.css";

// Ilk boyamadan once tema ve dili koke uygula: yanip sonmeyi onler.
const { language } = useUi.getState();
const { appearance, image } = useAppearance.getState();
applyAppearance(appearance, image);
document.documentElement.lang = language;

const container = document.getElementById("root");
if (!container) throw new Error("#root bulunamadi");

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
