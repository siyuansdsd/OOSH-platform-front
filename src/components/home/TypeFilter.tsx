"use client";

type FilterValue = "all" | "media" | "website";

interface TypeFilterProps {
  value: FilterValue;
  onChange: (next: FilterValue) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  className?: string;
}

const OPTIONS: Array<{ value: FilterValue; label: string; description?: string }> = [
  { value: "media", label: "Video & Image" },
  { value: "website", label: "Website" },
];

export function TypeFilter({ value, onChange, onRefresh, refreshing = false, className = "" }: TypeFilterProps) {
  const handleSelect = (next: FilterValue) => {
    if (next === value) {
      onChange("all");
    } else {
      onChange(next);
    }
  };

  return (
    <div
      className={`glass-panel flex w-full flex-col items-stretch gap-3 rounded-2xl p-3 shadow-sm md:flex-row md:items-center md:justify-between ${className}`}
    >
      <div className="text-sm font-medium text-foreground">Filter by content type</div>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-foreground/10 bg-background/60 p-1 shadow-inner md:flex-1 md:justify-start">
          {OPTIONS.map((option) => {
            const active = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`min-w-[8rem] rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-orange-300/70 focus:ring-offset-1 focus:ring-offset-background md:px-6 md:py-2.5 ${
                  active
                    ? "glass-pill text-foreground"
                    : "border border-transparent bg-white/15 text-foreground/80 hover:bg-white/25 hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex size-10 items-center justify-center self-end rounded-full border border-foreground/10 bg-white/70 text-foreground transition hover:border-foreground/30 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 md:self-auto"
            aria-label="Refresh results"
          >
            <span
              aria-hidden="true"
              className={`inline-block text-lg ${refreshing ? "animate-spin" : ""}`}
            >
              ↻
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
