"use client";

import { useMemo } from "react";

type SearchFilters = {
  school: string;
  name: string;
};

interface SearchBarProps {
  schools?: string[];
  value: SearchFilters;
  onChange: (next: SearchFilters) => void;
  onSubmit?: () => void;
  loading?: boolean;
  className?: string;
}

export function SearchBar({
  schools = [],
  value,
  onChange,
  onSubmit,
  loading,
  className = "",
}: SearchBarProps) {
  const schoolOptions = useMemo(() => {
    const unique = Array.from(new Set(schools.filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
    return unique;
  }, [schools]);

  const handleSubmit = (evt: React.FormEvent) => {
    evt.preventDefault();
    onSubmit?.();
  };

  const update = (patch: Partial<SearchFilters>) => {
    onChange({ ...value, ...patch });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`glass-panel flex flex-col gap-3 rounded-3xl p-4 shadow-sm md:flex-row md:items-end ${className}`}
    >
      <label className="flex flex-col gap-2 text-sm text-foreground/80 md:flex-1">
        <span className="font-medium text-foreground">School</span>
        <select
          value={value.school}
          onChange={(event) => update({ school: event.target.value })}
          className="rounded-xl border border-foreground/20 bg-white/90 px-3 py-2 text-base text-foreground shadow-sm focus:border-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/20"
        >
          <option value="">All schools</option>
          {schoolOptions.map((school) => (
            <option key={school} value={school}>
              {school}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2 text-sm text-foreground/80 md:flex-[1.2]">
        <span className="font-medium text-foreground">Student / Team Name</span>
        <input
          type="text"
          inputMode="text"
          value={value.name}
          onChange={(event) => update({ name: event.target.value })}
          placeholder="Search by student or team"
          className="rounded-xl border border-foreground/20 bg-white/90 px-3 py-2 text-base text-foreground shadow-sm focus:border-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/20"
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="btn-gradient inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-base font-medium text-foreground transition focus:outline-none focus:ring-2 focus:ring-orange-200/80 focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60 md:w-40"
      >
        {loading ? "Searching…" : "Search"}
      </button>
    </form>
  );
}
