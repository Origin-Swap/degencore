import { useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Search, Moon, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import Logo from "../ui/Logo";
import { searchTokens } from "../../data/api";
import { mapApiToken } from "../../data/adapters";
import { BACKEND_CONNECTED } from "../../config/env";
import { useTheme } from "../../hooks/useTheme";

export default function Topbar({ search, onSearchChange, showSearch = false }) {
  const { theme, toggleTheme } = useTheme();
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  // Debounced API search
  useEffect(() => {
    if (!BACKEND_CONNECTED || !search?.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const id = setTimeout(() => {
      searchTokens(search.trim(), { limit: 8 })
        .then((rows) => {
          if (!cancelled) {
            setResults((rows || []).map(mapApiToken));
            setOpen(true);
          }
        })
        .catch((err) => console.error("[topbar] search failed:", err));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [search]);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-canvas/90 backdrop-blur-sm border-b border-border">
      <div className="flex items-center gap-3 px-4 lg:px-8 h-16">
        <div className="lg:hidden">
          <Logo />
        </div>

        {showSearch && (
          <div ref={boxRef} className="hidden md:flex relative items-center gap-2 flex-1 max-w-sm bg-surface border border-border rounded-xl px-3 h-10">
            <Search size={16} className="text-ink-faint shrink-0" />
            <input
              value={search}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search token or ticker"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint"
            />

            {open && results.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-lg overflow-hidden z-40">
                {results.map((t) => (
                  <Link
                    key={t.address}
                    to={`/token/${t.symbol}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-surface-alt"
                  >
                    <span className="text-sm font-medium text-ink">{t.name}</span>
                    <span className="text-xs text-ink-faint font-mono">{t.symbol}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
        <button
            onClick={toggleTheme}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border hover:bg-surface-alt text-ink-soft hover:text-ink transition-colors"
            aria-label="Toggle Dark Mode"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <ConnectButton
            chainStatus="icon"
            accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
            showBalance={{ smallScreen: false, largeScreen: true }}
          />
        </div>
      </div>

      {showSearch && (
        <div className="md:hidden px-4 pb-3 -mt-1">
          <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-3 h-10">
            <Search size={16} className="text-ink-faint shrink-0" />
            <input
              value={search}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search token or ticker"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint"
            />
          </div>
        </div>
      )}
    </header>
  );
}
