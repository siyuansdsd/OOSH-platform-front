import Image from "next/image";
import type { DragEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUploadCtx } from "./UploadContext";

type SelectedItem = {
  file: File;
  id: string;
  previewUrl: string;
};

const formatFileSize = (bytes: number): string => {
  const gb = 1024 * 1024 * 1024;
  const mb = 1024 * 1024;
  const kb = 1024;

  if (bytes >= gb) {
    const value = bytes / gb;
    return Number.isInteger(value) ? `${value}GB` : `${value.toFixed(2)}GB`;
  }
  if (bytes >= mb) {
    const value = bytes / mb;
    return Number.isInteger(value) ? `${value}MB` : `${value.toFixed(2)}MB`;
  }
  if (bytes >= kb) {
    return `${(bytes / kb).toFixed(2)}KB`;
  }
  return `${bytes}B`;
};

export default function FileDropzone({
  maxCount = 30,
  maxTotalBytes = 1024 * 1024 * 1024, // 1GB
}: {
  maxCount?: number;
  maxTotalBytes?: number;
}) {
  const { files: value, setFiles: onChange } = useUploadCtx();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected: SelectedItem[] = useMemo(
    () =>
      value.map((f, i) => ({
        file: f,
        id: `${i}-${f.name}-${f.size}`,
        previewUrl: URL.createObjectURL(f),
      })),
    [value],
  );

  useEffect(
    () => () => {
      selected.forEach(({ previewUrl }) => {
        URL.revokeObjectURL(previewUrl);
      });
    },
    [selected],
  );
  const totalBytes = useMemo(
    () => value.reduce((a, f) => a + f.size, 0),
    [value],
  );
  const maxSizeLabel = useMemo(
    () => formatFileSize(maxTotalBytes),
    [maxTotalBytes],
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files).filter((file) =>
        /^(image|video)\//.test(file.type),
      );
      if (list.length === 0) return;

      setError(null);

      const merged = [...value, ...list];
      const hitMaxCount = merged.length > maxCount;
      const nextFiles = hitMaxCount ? merged.slice(0, maxCount) : merged;
      const totalSelectedBytes = nextFiles.reduce((sum, file) => sum + file.size, 0);

      if (totalSelectedBytes > maxTotalBytes) {
        setError(`Total size must be under ${maxSizeLabel}`);
        return;
      }

      if (hitMaxCount) {
        setError(`Up to ${maxCount} files allowed`);
      }

      onChange(nextFiles);
    },
    [maxCount, maxTotalBytes, maxSizeLabel, onChange, value],
  );

  const onDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
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
      <button
        type="button"
        className={`rounded-2xl border-2 border-dashed p-6 transition-all duration-200 focus:outline-none ${
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
        onClick={openPicker}
      >
        <span className="flex flex-col items-center justify-center gap-2 text-center select-none">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="size-8 text-foreground/70"
          >
            <title>Upload media</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M9 13h6m-8 8h10a2 2 0 0 0 2-2V9.828a2 2 0 0 0-.586-1.414l-3.828-3.828A2 2 0 0 0 13.172 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"
            />
          </svg>
          <span className="text-sm text-foreground/80">
            Drag and drop Images or Videos here, or click to select
          </span>
          <span className="text-xs text-foreground/60">
            Up to {maxCount} files. Total size under {maxSizeLabel}.
          </span>
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {error ? (
        <p className="text-xs text-red-500">{error}</p>
      ) : (
        <p className="text-xs text-foreground/60">
          Selected {value.length} • Total {formatFileSize(totalBytes)}
        </p>
      )}

      {!!selected.length && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {selected.map(({ file, previewUrl }, idx) => (
            <li
              key={`${idx}-${file.name}`}
              className="rounded-xl border border-foreground/10 bg-white/5 p-3 backdrop-blur-sm flex gap-3 items-center"
            >
              <div className="size-14 shrink-0 overflow-hidden rounded-md bg-black/5 flex items-center justify-center">
                {/^image\//.test(file.type) ? (
                  <Image
                    src={previewUrl}
                    alt={file.name}
                    width={56}
                    height={56}
                    unoptimized
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
