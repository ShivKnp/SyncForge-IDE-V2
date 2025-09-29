
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import '@tldraw/tldraw/tldraw.css';
import App from "./App";


const root = createRoot(document.getElementById("root"));
root.render(<App />);
