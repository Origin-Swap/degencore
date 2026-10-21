export default function Logo({ className = "" }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <img src="/android-chrome-512x512.png" className="w-10 h-10" />
      <span className="font-display font-semibold text-[22px] tracking-tight text-ink">
        DEGENCORE
      </span>
    </div>
  );
}
