export function Spinner({ label }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 py-16 text-muted"
    >
      <span
        className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent"
        aria-hidden
      />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
