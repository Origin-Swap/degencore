import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Compass, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import TokenCard from "../components/tokens/TokenCard";
import FilterBar from "../components/tokens/FilterBar";
import EmptyState from "../components/ui/EmptyState";
import { BACKEND_CONNECTED } from "../config/env";
import { fetchTokens, fetchGlobalStats } from "../data/api";
import { mapApiToken } from "../data/adapters";
import { TOKENS, GLOBAL_STATS } from "../data/mockData";

const PAGE_LIMIT = 20;

export default function ExplorePage() {
  const { search } = useOutletContext();
  const [sort, setSort] = useState("recent");
  const [range, setRange] = useState("all");
  const [version, setVersion] = useState("both");

  const [apiTokens, setApiTokens] = useState([]);
  const [globalStats, setGlobalStats] = useState(GLOBAL_STATS);
  const [isLoading, setIsLoading] = useState(BACKEND_CONNECTED);
  const [loadError, setLoadError] = useState(null);
  const [featuredTokens, setFeaturedTokens] = useState([]);

  // State untuk Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Reset ke halaman 1 setiap kali filter atau pencarian berubah
  useEffect(() => {
    setPage(1);
  }, [sort, range, version, search]);

  // Fetch daftar token (Untuk halaman utama / All Tokens)
  useEffect(() => {
    if (!BACKEND_CONNECTED) return;

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    fetchTokens({
      sort,
      range,
      version: version === "both" ? undefined : version,
      search,
      page,
      limit: PAGE_LIMIT,
    })
      .then((rows) => {
        if (cancelled) return;
        setApiTokens(rows.map(mapApiToken));
        setHasMore(rows.length === PAGE_LIMIT);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[explore] failed to load tokens:", err);
        setLoadError(err.message || "Failed to load tokens");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sort, range, version, search, page]);

  // Fetch Featured Tokens (Top 5 Market Cap - TIDAK HARUS GRADUATED)
  useEffect(() => {
    if (!BACKEND_CONNECTED) return;
    let cancelled = false;

    // Ambil kandidat berdasarkan Market Cap tertinggi
    fetchTokens({ sort: "marketCap", range: "all", limit: 50 })
      .then((rows) => {
        if (cancelled) return;
        const top = (rows || [])
          .map(mapApiToken)
          .filter((t) => Number(t.marketCapUsd) >= 1000) // Filter MC minimal $1000 agar tidak menampilkan token kosong
          .slice(0, 5); // Ambil 5 teratas
        setFeaturedTokens(top);
      })
      .catch((err) => console.error("[explore] failed to load featured tokens:", err));

    return () => { cancelled = true; };
  }, []);

  // Fetch Global Stats
  useEffect(() => {
    if (!BACKEND_CONNECTED) return;
    let cancelled = false;
    fetchGlobalStats()
      .then((stats) => {
        if (!cancelled) setGlobalStats(stats);
      })
      .catch((err) => console.error("[explore] failed to load global stats:", err));
    return () => { cancelled = true; };
  }, []);

  // Logika Mock Data (untuk fallback tanpa backend)
  const mockTokens = useMemo(() => {
    let list = TOKENS.filter((t) => {
      if (version !== "both" && t.version !== version) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.name.toLowerCase().includes(q) && !t.symbol.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });

    const compare = {
      recent: (a, b) => a.createdMinsAgo - b.createdMinsAgo,
      newest: (a, b) => a.createdMinsAgo - b.createdMinsAgo,
      oldest: (a, b) => b.createdMinsAgo - a.createdMinsAgo,
      marketCap: (a, b) => b.marketCapUsd - a.marketCapUsd,
      volume: (a, b) => b.volume24hUsd - a.volume24hUsd,
    }[sort];

    return [...list].sort(compare);
  }, [sort, range, version, search]);

  const mockFeaturedTokens = useMemo(() => {
    // Di mock data, ambil top 5 berdasarkan MC tanpa peduli status graduated
    return [...TOKENS]
      .sort((a, b) => b.marketCapUsd - a.marketCapUsd)
      .slice(0, 5);
  }, []);

  const rawTokens = BACKEND_CONNECTED ? apiTokens : mockTokens;
  const featured = BACKEND_CONNECTED ? featuredTokens : mockFeaturedTokens;

  // Slicing untuk Mock Data pagination
  const tokens = BACKEND_CONNECTED
    ? rawTokens
    : rawTokens.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT);

  const isMockHasMore = rawTokens.length > page * PAGE_LIMIT;
  const showPagination = BACKEND_CONNECTED ? (page > 1 || hasMore) : (page > 1 || isMockHasMore);

  // Fungsi untuk merender nomor halaman
  const renderPageNumbers = () => {
    const pages = [];
    const maxPage = (BACKEND_CONNECTED ? hasMore : isMockHasMore) ? page + 1 : page;
    const start = Math.max(1, maxPage - 4);

    for (let i = start; i <= maxPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => setPage(i)}
          disabled={isLoading}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
            page === i
              ? "bg-ink text-canvas shadow-sm"
              : "bg-surface border border-border text-ink hover:bg-surface-alt"
          }`}
        >
          {i}
        </button>
      );
    }
    return pages;
  };

  return (
    <div className="px-4 lg:px-8 py-8 max-w-[1400px] mx-auto min-h-screen">

      {/* ================= HEADER ================= */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink tracking-tight">Explore</h1>
          <p className="text-sm text-ink-soft mt-1">
            {globalStats.totalLaunched.toLocaleString()} launched ·{" "}
            <span className="text-ink font-medium">tokens still climbing toward graduation</span>
          </p>
        </div>
      </div>

      {/* ================= FEATURED SECTION ================= */}
      {/* Jika featured kosong (misal tidak ada token dengan MC > 1000), section ini otomatis hilang */}
      {featured.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🏆</span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink">Top Performing Tokens</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-5 gap-3">
            {featured.map((token) => (
              <TokenCard key={token.address} token={token} />
            ))}
          </div>
        </div>
      )}

      {/* ================= FILTER BAR ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-border pb-4">
        <h2 className="text-lg font-semibold text-ink">All Tokens</h2>
        <FilterBar
          sort={sort}
          onSort={setSort}
          range={range}
          onRange={setRange}
          onVersion={setVersion}
        />
      </div>

      {/* ================= TOKEN GRID ================= */}
      {BACKEND_CONNECTED && loadError ? (
        <div className="rounded-xl2 border border-dashed border-down/40 bg-surface py-20 text-center">
          <p className="text-sm font-medium text-down">Couldn't load tokens</p>
          <p className="text-xs text-ink-soft mt-1">{loadError}</p>
        </div>
      ) : isLoading && tokens.length === 0 ? (
        <div className="rounded-xl2 border border-dashed border-border bg-surface py-24 flex flex-col items-center justify-center text-center">
          <Loader2 className="w-8 h-8 text-ink-faint animate-spin mb-4" />
          <p className="text-sm font-medium text-ink">Loading tokens…</p>
        </div>
      ) : tokens.length === 0 ? (
        <EmptyState
          icon={Compass}
          title={search ? `No tokens match "${search}"` : "No tokens found"}
          description="Try a different name or ticker."
        />
      ) : (
        <>
          <div className={`grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4 transition-opacity ${isLoading ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
            {tokens.map((token) => (
              <TokenCard key={token.address} token={token} />
            ))}
          </div>

          {/* ================= PAGINATION ================= */}
          {showPagination && (
            <div className="mt-12 flex flex-col items-center justify-center gap-4 border-t border-border pt-8">
              <div className="flex items-center gap-2">
                {/* Prev Button */}
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || isLoading}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} className="mr-1" />
                  Prev
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1.5 px-2">
                  {renderPageNumbers()}
                </div>

                {/* Next Button */}
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={(BACKEND_CONNECTED ? !hasMore : !isMockHasMore) || isLoading}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight size={16} className="ml-1" />
                </button>
              </div>

              <p className="text-xs text-ink-faint">
                Showing page {page}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
