import React from "react";
import { useUploadCtx } from "./UploadContext";

export type UploadMode = "file" | "url";

export default function UploadTypeSelector() {
  const { mode, setMode } = useUploadCtx();
  return (
    <div className="flex gap-3">
      {(
        [
          { key: "file", label: "Upload Files (Images/Videos)" },
          { key: "url", label: "Upload via URLs" },
        ] as const
      ).map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => setMode(opt.key)}
          className={`relative rounded-xl px-4 py-2 text-sm font-medium outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-orange-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent active:scale-[0.98] ${
            mode === opt.key
              ? "glass-pill text-foreground"
              : "border border-foreground/10 bg-white/15 text-foreground/80 hover:bg-white/25 hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
