import React from "react";
import { useUploadCtx } from "./UploadContext";

export default function UrlUploader() {
  const { urls, setUrls, disabled } = useUploadCtx();

  const baseInput =
    "w-full rounded-xl border border-foreground/15 bg-white/70 dark:bg-black/20 px-4 py-3 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:shadow-[0_0_0_4px_rgba(59,130,246,0.12)]";

  const setOne = (idx: number, val: string) => {
    const next = urls.slice();
    next[idx] = val;
    setUrls(next);
  };

  const add = () => setUrls([...urls, ""]);
  const remove = (idx: number) => {
    const next = urls.slice();
    next.splice(idx, 1);
    setUrls(next.length ? next : [""]);
  };

  return (
    <div className="flex flex-col gap-4">
      {urls.map((u, idx) => (
        <div
          key={idx}
          className="rounded-2xl border border-foreground/10 bg-white/5 p-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]"
        >
          <div>
            <label className="block">
              <div className="mb-1 text-sm text-foreground/80">
                页面链接 URL
              </div>
              <input
                value={u}
                onChange={(e) => setOne(idx, e.target.value)}
                disabled={disabled}
                placeholder="https://example.com/page"
                className={baseInput}
              />
            </label>
            {u ? (
              <div className="mt-3 overflow-hidden rounded-lg border border-foreground/10 bg-black/5">
                <img src={u} className="w-full h-40 object-cover" alt={u} />
              </div>
            ) : null}
          </div>
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={add}
              disabled={disabled}
              className="h-10 rounded-xl bg-blue-600 px-4 text-white text-sm font-medium shadow-lg shadow-blue-600/20 transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
            >
              + 新增 URL
            </button>
            {urls.length > 1 && (
              <button
                type="button"
                onClick={() => remove(idx)}
                disabled={disabled}
                className="h-10 rounded-xl border border-foreground/15 px-4 text-sm transition-colors hover:bg-white/10"
              >
                移除
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
