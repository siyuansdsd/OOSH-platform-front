import React, { useCallback, useMemo, useRef, useState } from "react";
import { useUploadCtx } from "./UploadContext";

type SelectedItem = {
  file: File;
  id: string;
};

export default function FileDropzone({
  maxCount = 4,
  maxTotalBytes = 200 * 1024 * 1024, // 200MB
}: {
  maxCount?: number;
  maxTotalBytes?: number;
}) {
  const { files: value, setFiles: onChange } = useUploadCtx();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected: SelectedItem[] = useMemo(
    () => value.map((f, i) => ({ file: f, id: `${i}-${f.name}-${f.size}` })),
    [value]
  );

  const totalBytes = useMemo(
    () => value.reduce((a, f) => a + f.size, 0),
    [value]
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      setError(null);
      const list = Array.from(files).filter((f) =>
        /^(image|video)\//.test(f.type)
      );

      const combined = [...value, ...list].slice(0, maxCount);
      const bytes = combined.reduce((a, f) => a + f.size, 0);
      if (combined.length > maxCount) {
        setError(`Up to ${maxCount} files allowed`);
      } else if (bytes > maxTotalBytes) {
        setError("Total size must be under 200MB");
        return; // don't update if size fails
      }
      onChange(combined);
    },
    [maxCount, maxTotalBytes, onChange, value]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const removeAt = (idx: number) => {
    const next = value.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`rounded-2xl border-2 border-dashed p-6 transition-all duration-200 ${
          dragOver
            ? "border-blue-500/70 bg-blue-500/5"
            : "border-foreground/20 hover:border-foreground/40"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={(e) => (e.key === "Enter" ? openPicker() : null)}
      >
        <div className="flex flex-col items-center justify-center gap-2 text-center select-none">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="size-8 text-foreground/70"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M9 13h6m-8 8h10a2 2 0 0 0 2-2V9.828a2 2 0 0 0-.586-1.414l-3.828-3.828A2 2 0 0 0 13.172 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"
            />
          </svg>
          <div className="text-sm text-foreground/80">
            Drag and drop Images or Videos here, or click to select
          </div>
          <div className="text-xs text-foreground/60">
            Up to {maxCount} files. Total size under 200MB.
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {error ? (
        <p className="text-xs text-red-500">{error}</p>
      ) : (
        <p className="text-xs text-foreground/60">
          Selected {value.length} • Total{" "}
          {(totalBytes / (1024 * 1024)).toFixed(1)} MB
        </p>
      )}

      {!!selected.length && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {selected.map(({ file }, idx) => (
            <li
              key={`${idx}-${file.name}`}
              className="rounded-xl border border-foreground/10 bg-white/5 p-3 backdrop-blur-sm flex gap-3 items-center"
            >
              <div className="size-14 shrink-0 overflow-hidden rounded-md bg-black/5 flex items-center justify-center">
                {/^image\//.test(file.type) ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="text-xs text-foreground/60">Video</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium">
                  filename: {file.name}
                </div>
                <div className="text-xs text-foreground/60 truncate">
                  contentType: {file.type || "unknown"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded-md border border-red-500/20 hover:border-red-500/40 transition-colors"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
