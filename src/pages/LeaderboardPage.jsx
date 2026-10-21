import { useEffect, useMemo, useState } from "react";
import { Search, Info } from "lucide-react";
import YourRankCard from "../components/leaderboard/YourRankCard";
import Podium from "../components/leaderboard/Podium";
import LeaderboardTable from "../components/leaderboard/LeaderboardTable";
import { BACKEND_CONNECTED } from "../config/env";
import { fetchLeaderboard } from "../data/api";
import { mapLeaderboardEntry } from "../data/adapters";
import { LEADERBOARD, LEADERBOARD_STATS } from "../data/mockData";

const PAGE_SIZE = 20;

export default function LeaderboardPage() {
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [apiEntries, setApiEntries] = useState([]);
  const [apiStats, setApiStats] = useState(LEADERBOARD_STATS);
  const [isLoading, setIsLoading] = useState(BACKEND_CONNECTED);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!BACKEND_CONNECTED) return;
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    fetchLeaderboard()
      .then((res) => {
        if (cancelled) return;

        // GET /api/leaderboard returns { leaderboard: [], page, limit, totalParticipants, totalPointsIssued }
        let rawEntries = [];
        let totalParticipants = 0;
        let totalPointsIssued = 0;

        if (res && typeof res === 'object') {
          // Check if response has leaderboard array
          if (res.leaderboard && Array.isArray(res.leaderboard)) {
            rawEntries = res.leaderboard;
            totalParticipants = res.totalParticipants || rawEntries.length;
            totalPointsIssued = res.totalPointsIssued || 0;
            console.log("Using res.leaderboard:", rawEntries.length, "entries");
          }
          // Fallback: if response is array directly
          else if (Array.isArray(res)) {
            rawEntries = res;
            totalParticipants = rawEntries.length;
            totalPointsIssued = rawEntries.reduce((sum, e) => sum + (e.points || 0), 0);
            console.log("Using res as array:", rawEntries.length, "entries");
          }
          // Fallback: if response has entries
          else if (res.entries && Array.isArray(res.entries)) {
            rawEntries = res.entries;
            totalParticipants = res.totalParticipants || rawEntries.length;
            totalPointsIssued = res.totalPointsIssued || 0;
            console.log("Using res.entries:", rawEntries.length, "entries");
          }
        }


        // Sort by points descending and map
        const sorted = [...rawEntries].sort((a, b) => (b.points || 0) - (a.points || 0));
        console.log(sorted);

        const entries = sorted.map((row, i) => {

          const mapped = mapLeaderboardEntry(row, i + 1);
          console.log("Mapped result:", mapped);
          return mapped;
        });


        setApiEntries(entries);
        setApiStats({
          totalParticipants: totalParticipants || entries.length,
          totalPointsIssued: totalPointsIssued || entries.reduce((sum, e) => sum + e.points, 0),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[leaderboard] failed to load:", err);
        setLoadError(err.message || "Failed to load leaderboard");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const leaderboard = BACKEND_CONNECTED ? apiEntries : LEADERBOARD;
  const stats = BACKEND_CONNECTED ? apiStats : LEADERBOARD_STATS;

  const filtered = useMemo(() => {
    if (!search) return leaderboard;
    const q = search.toLowerCase();
    return leaderboard.filter((e) => e.address.toLowerCase().includes(q));
  }, [search, leaderboard]);

  const showPodium = !search && filtered.length >= 3;
  const tableEntries = showPodium ? filtered.slice(3) : filtered;
  const visibleEntries = tableEntries.slice(0, visibleCount);
  const hasMore = visibleCount < tableEntries.length;


  return (
    <div className="px-4 lg:px-8 py-6 max-w-4xl mx-auto">
      <div className="mb-1">
        <h1 className="font-display text-2xl font-semibold text-ink">Leaderboard</h1>
        <p className="text-sm text-ink-soft mt-1">
          {stats.totalParticipants.toLocaleString()} wallets earning points ·{" "}
          {stats.totalPointsIssued.toLocaleString()} points issued so far
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-indigo-soft text-ink px-3.5 py-3 my-4">
        <Info size={15} className="text-indigo shrink-0 mt-0.5" />
        <p className="text-xs text-ink-soft leading-relaxed">
          <span className="font-medium text-ink">1 point per trade</span> — every buy or sell, on any
          token, counts the same regardless of size or profit. This tracks activity, not PnL. Points
          are the basis for a future platform-token reward — exact terms aren't live yet.
        </p>
      </div>

      <div className="mb-5">
        <YourRankCard />
      </div>

      <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 h-10 mb-5">
        <Search size={16} className="text-ink-faint shrink-0" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
          placeholder="Search wallet address"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint font-mono"
        />
      </div>

      {BACKEND_CONNECTED && loadError && (
        <div className="rounded-xl2 border border-dashed border-down/40 bg-surface py-10 text-center mb-5">
          <p className="text-sm font-medium text-down">Couldn't load the leaderboard</p>
          <p className="text-xs text-ink-soft mt-1">{loadError}</p>
        </div>
      )}

      {BACKEND_CONNECTED && isLoading && leaderboard.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-border bg-surface py-10 text-center">
          <p className="text-sm font-medium text-ink">Loading leaderboard…</p>
        </div>
      ) : (
        <>
          {/* Debug: Show data count */}
          <div className="text-xs text-ink-faint mb-2">
            Debug: {leaderboard.length} entries found
          </div>

          {showPodium && leaderboard.length > 0 && (
            <div className="mb-5">
              <Podium entries={filtered} />
            </div>
          )}

          {visibleEntries.length > 0 ? (
            <>
              <LeaderboardTable entries={visibleEntries} />
              {hasMore && (
                <div className="flex justify-center mt-4">
                  <button
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    className="rounded-xl border border-border bg-surface hover:bg-surface-alt px-4 py-2 text-sm font-medium text-ink-soft transition-colors"
                  >
                    Load more
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl2 border border-dashed border-border bg-surface py-10 text-center">
              <p className="text-sm font-medium text-ink">No data available</p>
              <p className="text-xs text-ink-soft mt-1">Start trading to earn points and appear on the leaderboard.</p>
              {/* Debug: Show why no data */}
              {leaderboard.length === 0 && (
                <p className="text-xs text-ink-faint mt-2">Leaderboard array is empty</p>
              )}
              {leaderboard.length > 0 && visibleEntries.length === 0 && (
                <p className="text-xs text-ink-faint mt-2">
                  {leaderboard.length} entries exist but none visible (check search filter)
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
