import React from "react";
import { useUploadCtx } from "./UploadContext";

export default function UrlUploader() {
  const { urls, setUrls, disabled } = useUploadCtx();
  const [previews, setPreviews] = React.useState<string[]>(
    Array(urls.length).fill("")
  );
  const [loadingIdx, setLoadingIdx] = React.useState<number | null>(null);
  const timers = React.useRef<Record<number, ReturnType<typeof setTimeout>>>(
    {}
  );

  const baseInput =
    "w-full rounded-xl border border-foreground/15 bg-white/70 dark:bg-black/20 px-4 py-3 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:shadow-[0_0_0_4px_rgba(59,130,246,0.12)]";

  const setOne = (idx: number, val: string) => {
    const next = urls.slice();
    next[idx] = val;
    setUrls(next);
    // Clear preview when field is emptied to avoid stale card
    if (!val) {
      const p = previews.slice();
      p[idx] = "";
      setPreviews(p);
    }
  };

  const add = () => {
    setUrls([...urls, ""]);
    setPreviews([...previews, ""]);
  };
  const remove = (idx: number) => {
    const next = urls.slice();
    next.splice(idx, 1);
    setUrls(next.length ? next : [""]);
    const p = previews.slice();
    p.splice(idx, 1);
    setPreviews(p.length ? p : [""]);
  };

  React.useEffect(() => {
    if (previews.length !== urls.length) {
      const next = previews.slice();
      while (next.length < urls.length) next.push("");
      setPreviews(next.slice(0, urls.length));
    }
    // Clear any timers for indices that are now out of range
    Object.keys(timers.current).forEach((k) => {
      const i = Number(k);
      if (Number.isFinite(i) && i >= urls.length) {
        clearTimeout(timers.current[i]!);
        delete timers.current[i];
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls.length]);

  // Auto-initialize previews when URLs are present (e.g., restored state)
  React.useEffect(() => {
    const localTimers: ReturnType<typeof setTimeout>[] = [];
    urls.forEach((u, i) => {
      if (u && !previews[i] && loadingIdx !== i) {
        const val = u.trim();
        if (!val) return;
        if (isImageUrl(val)) {
          const p = previews.slice();
          p[i] = val;
          setPreviews(p);
        } else {
          const t = setTimeout(() => void fetchPreview(i, val), 200);
          localTimers.push(t);
        }
      }
    });
    return () => {
      localTimers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls, previews]);

  // Cleanup all scheduled timers on unmount
  React.useEffect(() => {
    return () => {
      Object.values(timers.current).forEach((t) => clearTimeout(t));
      timers.current = {};
    };
  }, []);

  const isImageUrl = (u: string) =>
    /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(u);

  const schedulePreview = (idx: number, raw: string) => {
    const val = raw.trim();
    if (timers.current[idx]) clearTimeout(timers.current[idx]);
    if (!val) return;
    timers.current[idx] = setTimeout(() => {
      void fetchPreview(idx, val);
    }, 500);
  };

  const fetchPreview = async (idx: number, u: string) => {
    if (!u) return;
    if (isImageUrl(u)) {
      const p = previews.slice();
      p[idx] = u;
      setPreviews(p);
      return;
    }
    try {
      setLoadingIdx(idx);
      const res = await fetch("/api/link/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      const data = await res.json().catch(() => ({}));
      const img = data?.image || "";
      const p = previews.slice();
      p[idx] = img;
      setPreviews(p);
    } catch {
      const p = previews.slice();
      p[idx] = "";
      setPreviews(p);
    } finally {
      setLoadingIdx(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {urls.map((u, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-foreground/10 bg-white/5 p-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px]"
        >
          <div>
            <label className="block">
              <div className="mb-1 text-sm text-foreground/80">Page URL</div>
              <input
                value={u}
                onChange={(e) => {
                  setOne(idx, e.target.value);
                  schedulePreview(idx, e.target.value);
                }}
                onPaste={(e) => {
                  const v = (e.clipboardData?.getData("text") || "").trim();
                  if (v) schedulePreview(idx, v);
                }}
                onBlur={(e) => setOne(idx, e.target.value.trim())}
                disabled={disabled}
                placeholder="https://example.com/page-image.jpg"
                className={baseInput}
              />
            </label>
            {u ? (
              <div className="mt-3 overflow-hidden rounded-lg border border-foreground/10 bg-white min-h-12 flex items-center justify-center">
                {loadingIdx === idx ? (
                  <span className="text-xs text-foreground/60">
                    Loading preview...
                  </span>
                ) : previews[idx] ? (
                  <img
                    src={previews[idx]}
                    className="w-full h-40 object-cover"
                    alt={u}
                  />
                ) : isImageUrl(u) ? (
                  <img src={u} className="w-full h-40 object-cover" alt={u} />
                ) : (
                  <span className="text-xs text-foreground/70">
                    {(() => {
                      try {
                        const d = new URL(u).hostname.replace(/^www\./, "");
                        return d;
                      } catch {
                        return u;
                      }
                    })()}
                  </span>
                )}
              </div>
            ) : null}
          </div>
          <div className="flex items-start gap-2 sm:flex-col sm:w-[160px]">
            <button
              type="button"
              onClick={add}
              disabled={disabled}
              className="h-10 sm:w-full rounded-xl bg-blue-600 px-4 text-white text-sm font-medium shadow-lg shadow-blue-600/20 transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
            >
              + Add URL
            </button>
            {urls.length > 1 && (
              <button
                type="button"
                onClick={() => remove(idx)}
                disabled={disabled}
                className="h-10 sm:w-full rounded-xl border border-foreground/15 px-4 text-sm transition-colors hover:bg-white/10"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Initialize previews for pre-filled URLs and cleanup timers
// Note: Keep outside component return but inside module scope not needed; using effects below.
