interface Stat {
  label: string;
  value: number | string;
  tone?: "accent" | "green" | "red" | "gray";
  /** Torna o card clicável -- ex.: aplicar/alternar um filtro na grid abaixo. Omitir mantém o
   * card estático, exatamente como sempre foi (a maioria das telas continua assim). */
  onClick?: () => void;
  /** Realça o card (borda/fundo) quando o filtro que ele representa é o que está ativo agora.
   * Não afeta layout nem os outros cards. */
  active?: boolean;
}

export function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="stat-cards">
      {stats.map((s) => {
        const clickable = !!s.onClick;
        const className = [
          "stat-card",
          clickable ? "stat-card-clickable" : undefined,
          clickable && s.active ? "stat-card-active" : undefined,
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <div
            className={className}
            key={s.label}
            onClick={s.onClick}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-pressed={clickable ? !!s.active : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      s.onClick!();
                    }
                  }
                : undefined
            }
          >
            <span className={`stat-dot stat-dot-${s.tone ?? "accent"}`} />
            <div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
