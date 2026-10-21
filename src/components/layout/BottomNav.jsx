import { NavLink } from "react-router-dom";
import { Compass, Rocket, Trophy, MessageSquare, BarChart3, Wallet2 } from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Explore", icon: Compass, end: true },
  { to: "/launch", label: "Launch", icon: Rocket },
  { to: "/leaderboard", label: "Ranks", icon: Trophy },
  // { to: "/forum", label: "Forum", icon: MessageSquare },
  { to: "/analytics", label: "Stats", icon: BarChart3 },
  { to: "/portfolio", label: "Wallet", icon: Wallet2 },
];

export default function BottomNav() {
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border px-1.5 pt-1.5"
      style={{ paddingBottom: "calc(0.375rem + env(safe-area-inset-bottom))" }}
    >
      <div className="grid grid-cols-5">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                isActive ? "text-lime-ink" : "text-ink-faint"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex items-center justify-center w-8 h-7 rounded-full transition-colors ${
                    isActive ? "bg-lime" : "bg-transparent"
                  }`}
                >
                  <Icon size={16} strokeWidth={2.3} />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
