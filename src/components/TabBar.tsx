interface TabBarProps {
  tabs: readonly { key: string; label: string; icon?: string }[];
  active: string;
  onChange: (key: string) => void;
}

export function TabBar({ tabs, active, onChange }: TabBarProps) {
  return (
    <div className="mb-5 flex flex-wrap gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`rounded-[9px] px-4 py-2.5 text-[13px] font-semibold tracking-[0.2px] transition-all ${
            active === tab.key
              ? "border border-[rgba(0,232,123,0.2)] bg-[rgba(0,232,123,0.08)] text-[var(--color-accent-primary)]"
              : "border border-transparent bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
