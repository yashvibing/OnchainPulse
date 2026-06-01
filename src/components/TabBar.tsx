interface TabBarProps {
  tabs: readonly { key: string; label: string; icon?: string }[];
  active: string;
  onChange: (key: string) => void;
}

export function TabBar({ tabs, active, onChange }: TabBarProps) {
  return (
    <div className="sticky top-[84px] z-30 mb-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(10,18,15,0.94)] p-2 shadow-[0_12px_36px_rgba(0,0,0,0.28)] backdrop-blur">
      <div className="flex gap-1 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`shrink-0 rounded-[var(--radius-md)] border px-4 py-2.5 text-[13px] font-semibold tracking-[0.2px] transition-all ${
            active === tab.key
              ? "border-[var(--color-accent-primary)] bg-[rgba(0,245,204,0.08)] text-[var(--color-accent-primary)]"
              : "border-transparent bg-transparent text-[var(--color-text-muted)] hover:border-[var(--color-border)] hover:text-[var(--color-text-secondary)]"
          }`}
        >
          {tab.label}
        </button>
      ))}
      </div>
    </div>
  );
}
