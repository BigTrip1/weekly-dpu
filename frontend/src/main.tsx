import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Shell } from "./Shell";
import { ThemeProvider } from "./theme";
import { Audits } from "./pages/Audits";
import { Dashboard } from "./pages/Dashboard";
import { Mappings } from "./pages/Mappings";
import { Rules } from "./pages/Rules";
import { Upload } from "./pages/Upload";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Dashboard />} />
            <Route path="upload" element={<Upload />} />
            <Route path="mappings" element={<Mappings />} />
            <Route path="rules" element={<Rules />} />
            <Route path="audits" element={<Audits />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
