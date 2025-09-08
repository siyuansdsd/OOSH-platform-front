"use client";

import React from "react";

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6">
      <div
        aria-label="loading"
        className="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white/90 dark:border-black/30 dark:border-t-black/80"
        role="status"
      />
      {label ? (
        <div className="text-sm text-foreground/70 select-none">{label}</div>
      ) : null}
    </div>
  );
}

export default Spinner;
