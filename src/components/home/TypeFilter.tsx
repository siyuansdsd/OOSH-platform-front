"use client";

type FilterValue = "all" | "media" | "website";

interface TypeFilterProps {
  value: FilterValue;
  onChange: (next: FilterValue) => void;
  className?: string;
}

const OPTIONS: Array<{ value: FilterValue; label: string; description?: string }> = [
  { value: "media", label: "Video & Image" },
  { value: "website", label: "Website" },
];

export function TypeFilter({ value, onChange, className = "" }: TypeFilterProps) {
  const handleSelect = (next: FilterValue) => {
    if (next === value) {
      onChange("all");
    } else {
      onChange(next);
    }
  };

  return (
    <div
      className={`flex w-full flex-col items-stretch gap-3 rounded-2xl border border-foreground/10 bg-white/5 p-3 shadow-sm backdrop-blur-md md:flex-row md:items-center md:justify-between ${className}`}
    >
      <div className="text-sm font-medium text-foreground">Filter by content type</div>
      <div className="flex items-center justify-between gap-2 rounded-xl border border-foreground/10 bg-background/60 p-1 shadow-inner">
        {OPTIONS.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`min-w-[8rem] rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-foreground/30 focus:ring-offset-1 focus:ring-offset-background md:px-6 md:py-2.5 ${
                active
                  ? "bg-foreground text-background shadow"
                  : "bg-transparent text-foreground/80 hover:bg-foreground/10"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
