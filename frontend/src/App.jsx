import { BrowserRouter, Route, Routes } from "react-router-dom";
import AdminApp from "./admin/AdminApp";
import ChatApp from "./components/ChatApp";
import { ImpressumPage, PrivacyPage } from "./legal/LegalPages";
import ResultsPage from "./results/ResultsPage";
import RitualApp from "./ritual/RitualApp";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RitualApp />} />
        <Route path="/chat" element={<ChatApp />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/admin" element={<AdminApp />} />
        <Route path="/impressum" element={<ImpressumPage />} />
        <Route path="/datenschutz" element={<PrivacyPage />} />
      </Routes>
    </BrowserRouter>
  );
}
