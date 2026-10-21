import { Routes, Route } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import ExplorePage from "./pages/ExplorePage";
import LaunchPage from "./pages/LaunchPage";
import TokenDetailPage from "./pages/TokenDetailPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import ForumPage from "./pages/ForumPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import PortfolioPage from "./pages/PortfolioPage";
import NotFoundPage from "./pages/NotFoundPage";
import SwapPage from "./pages/SwapPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<ExplorePage />} />
        <Route path="/launch" element={<LaunchPage />} />
        <Route path="/token/:symbol" element={<TokenDetailPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/forum" element={<ForumPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/swap" element={<SwapPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
