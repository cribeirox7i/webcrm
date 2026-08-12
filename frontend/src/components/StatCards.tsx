interface Stat {
  label: string;
  value: number | string;
  tone?: "accent" | "green" | "red" | "gray";
}

export function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="stat-cards">
      {stats.map((s) => (
        <div className="stat-card" key={s.label}>
          <span className={`stat-dot stat-dot-${s.tone ?? "accent"}`} />
          <div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
