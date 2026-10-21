import { NavLink } from "react-router-dom";
import { Compass, Rocket, Trophy, MessageSquare, BarChart3, Wallet2 } from "lucide-react";
import Logo from "../ui/Logo";

const NAV_ITEMS = [
  { to: "/", label: "Explore", icon: Compass, end: true },
  { to: "/launch", label: "Launch", icon: Rocket },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  // { to: "/forum", label: "Forum", icon: MessageSquare },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/portfolio", label: "Portfolio", icon: Wallet2 },
];

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:flex-col w-60 shrink-0 h-screen sticky top-0 border-r border-border bg-surface px-4 py-5">
      <div className="px-2 mb-8">
        <Logo />
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-lime text-lime-ink"
                  : "text-ink-soft hover:bg-surface-alt hover:text-ink"
              }`
            }
          >
            <Icon size={18} strokeWidth={2.2} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-3 py-3 rounded-xl bg-surface-alt">
        <p className="text-xs font-medium text-ink-soft leading-relaxed">
          Every launch is a fair-launch bonding curve. No presale, no team allocation.
        </p>
      </div>
    </aside>
  );
}
