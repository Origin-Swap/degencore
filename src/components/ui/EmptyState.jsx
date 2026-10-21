export default function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6">
      <div className="w-12 h-12 rounded-2xl bg-surface-alt flex items-center justify-center mb-4">
        <Icon size={20} className="text-ink-soft" />
      </div>
      <h2 className="font-display text-lg font-semibold text-ink mb-1.5">{title}</h2>
      <p className="text-sm text-ink-soft max-w-sm">{description}</p>
    </div>
  );
}
