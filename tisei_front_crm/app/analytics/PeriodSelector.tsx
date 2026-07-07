"use client";

type Period = "day" | "week" | "month" | "quarter" | "year";

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: "day", label: "День" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "quarter", label: "Квартал" },
  { key: "year", label: "Год" },
];

export function PeriodSelector({
  active,
  onChange,
}: {
  active: Period;
  onChange: (period: Period) => void;
}) {
  return (
    <div className="flex items-center bg-surface-container-low p-1 rounded-lg border border-outline-variant">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          className={
            active === p.key
              ? "px-4 py-1.5 rounded text-label-md font-label-md transition-colors bg-surface-container-highest text-primary shadow-sm"
              : "px-4 py-1.5 rounded text-label-md font-label-md transition-colors hover:bg-surface-container hover:text-primary"
          }
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export type { Period };
