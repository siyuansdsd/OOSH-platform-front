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
          className={`relative rounded-xl px-4 py-2 text-sm font-medium outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500/60 active:scale-[0.98] ${
            mode === opt.key
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
              : "bg-white/5 text-foreground border border-foreground/10 hover:bg-white/10"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
