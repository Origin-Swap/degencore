const VARIANTS = {
  neutral: "bg-surface-alt text-ink-soft",
  lime: "bg-lime text-lime-ink shadow-sm",
  indigo: "bg-indigo-soft text-indigo",
  up: "bg-up/10 text-up",
  down: "bg-down/10 text-down",
};

export default function Badge({ children, variant = "neutral", className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
