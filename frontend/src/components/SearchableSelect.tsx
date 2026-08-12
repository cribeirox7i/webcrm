import { useMemo, useRef, useState } from "react";

export interface SearchableOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  id?: string;
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
}

export function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Buscar...",
  allowEmpty = true,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    const list = t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options;
    return list.slice(0, 200);
  }, [options, term]);

  function handleBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setOpen(false);
      setTerm("");
    }
  }

  return (
    <div className="searchable-select" ref={containerRef} onBlur={handleBlur}>
      <input
        id={id}
        value={open ? term : selected?.label ?? ""}
        placeholder={selected ? selected.label : placeholder}
        onFocus={() => {
          setOpen(true);
          setTerm("");
        }}
        onChange={(e) => setTerm(e.target.value)}
      />
      {open && (
        <ul className="searchable-select-list">
          {allowEmpty && (
            <li
              onMouseDown={() => {
                onChange("");
                setOpen(false);
              }}
            >
              (nenhum)
            </li>
          )}
          {filtered.map((o) => (
            <li
              key={o.value}
              className={o.value === value ? "active" : ""}
              onMouseDown={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </li>
          ))}
          {filtered.length === 0 && <li className="empty">Nenhum resultado</li>}
        </ul>
      )}
    </div>
  );
}
