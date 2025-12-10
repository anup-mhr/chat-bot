import { createRoot } from "react-dom/client";
import App2 from "./components/App2.tsx";
import { VisitorProvider } from "./context/org.context.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <VisitorProvider>
    <App2 />
  </VisitorProvider>
);
