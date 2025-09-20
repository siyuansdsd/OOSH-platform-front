"use client";

import { useEffect, useMemo, useState } from "react";
import type { HomeworkRecord } from "@/lib/api/homeworks";

interface GalleryProps {
  items: HomeworkRecord[];
  loading?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  className?: string;
  emptyState?: React.ReactNode;
}

interface WebsitePreviewProps {
  url: string;
}

function WebsitePreview({ url }: WebsitePreviewProps) {
  const [image, setImage] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let mounted = true;
    const fetchPreview = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/link/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("preview failed");
        const data = (await res.json()) as { image?: string };
        if (mounted) {
          setImage(data?.image ?? "");
        }
      } catch {
        if (mounted) setImage("");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchPreview();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [url]);

  if (!url) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-foreground/5 text-sm text-foreground/60">
        No website provided
      </div>
    );
  }

  if (!image) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-foreground/5 text-sm text-foreground/60">
        {loading ? "Fetching preview…" : "Preview unavailable"}
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group relative block aspect-[4/3] overflow-hidden rounded-2xl"
    >
      <img
        src={image}
        alt="Website preview"
        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-sm text-white">
        Visit website →
      </div>
    </a>
  );
}

export function Gallery({
  items,
  loading,
  loadingMore,
  onLoadMore,
  hasMore,
  className = "",
  emptyState,
}: GalleryProps) {
  const [modalItem, setModalItem] = useState<HomeworkRecord | null>(null);
  const [initialImageIndex, setInitialImageIndex] = useState(0);

  const gridItems = useMemo(() => items ?? [], [items]);

  const closeModal = () => {
    setModalItem(null);
    setInitialImageIndex(0);
  };

  const renderMedia = (item: HomeworkRecord) => {
    const firstImage = item.images[0];
    const multipleImages = item.images.length > 1;
    const firstVideo = item.videos[0];

    if (firstImage) {
      return (
        <button
          type="button"
          className={`group relative aspect-[4/3] w-full overflow-hidden rounded-2xl ${multipleImages ? "cursor-pointer" : "cursor-default"}`}
          onClick={() => {
            if (multipleImages) {
              setModalItem(item);
              setInitialImageIndex(0);
            }
          }}
        >
          <img
            src={firstImage}
            alt={item.title || item.groupName || item.personName || "Project image"}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
          {multipleImages ? (
            <div className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
              +{item.images.length - 1} more
            </div>
          ) : null}
        </button>
      );
    }

    if (firstVideo) {
      return (
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
          <video
            controls
            preload="metadata"
            className="h-full w-full object-cover"
            src={firstVideo}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }

    if (item.hasWebsite && item.urls[0]) {
      return <WebsitePreview url={item.urls[0]} />;
    }

    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-foreground/5 text-sm text-foreground/60">
        No media available
      </div>
    );
  };

  if (!loading && gridItems.length === 0) {
    return (
      <div className={`rounded-3xl border border-foreground/10 bg-white/5 p-10 text-center text-sm text-foreground/60 ${className}`}>
        {emptyState ?? "No items found."}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {gridItems.map((item) => {
          const primaryName = item.groupName || item.personName || "Untitled";
          const multipleImages = item.images.length > 1;
          return (
            <article
              key={item.id}
              className="flex h-full flex-col overflow-hidden rounded-3xl border border-foreground/10 bg-white/5 p-4 backdrop-blur"
            >
              {renderMedia(item)}
              <div className="mt-4 flex flex-1 flex-col">
                <div className="text-sm font-semibold text-foreground">
                  {item.title || primaryName}
                </div>
                <div className="mt-1 text-sm text-foreground/70">
                  {primaryName}
                </div>
                <div className="text-xs text-foreground/60">{item.schoolName}</div>
                {item.description && !multipleImages ? (
                  <p className="mt-3 line-clamp-3 text-sm text-foreground/70">
                    {item.description}
                  </p>
                ) : null}
              </div>
            </article>
          );
        })}
        {loading && gridItems.length === 0 ? (
          <div className="flex items-center justify-center rounded-3xl border border-dashed border-foreground/20 bg-background/40 p-6 text-sm text-foreground/60">
            Loading…
          </div>
        ) : null}
      </div>

      {hasMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loading || loadingMore}
          className="mx-auto inline-flex min-h-[2.75rem] min-w-[10rem] items-center justify-center rounded-full border border-foreground/20 bg-white/80 px-6 text-sm font-medium text-foreground shadow-sm transition hover:border-foreground/40 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      ) : null}

      {modalItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={closeModal}
            aria-hidden="true"
          />
          <div className="relative z-10 max-h-[90vh] w-[min(90vw,900px)] overflow-y-auto rounded-3xl bg-background p-6 text-foreground shadow-2xl">
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-4 top-4 h-10 w-10 rounded-full bg-foreground/10 text-2xl font-semibold text-foreground/80 transition hover:bg-foreground/20"
              aria-label="Close"
            >
              ×
            </button>
            <div className="flex flex-col gap-4">
              <header>
                <h2 className="text-xl font-semibold text-foreground">
                  {modalItem.title || modalItem.groupName || modalItem.personName || "Project"}
                </h2>
                <p className="text-sm text-foreground/70">{modalItem.schoolName}</p>
              </header>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {modalItem.images.map((image, index) => (
                  <img
                    key={image}
                    src={image}
                    alt={`Image ${index + 1}`}
                    className={`w-full rounded-2xl object-cover ${
                      index === initialImageIndex ? "ring-2 ring-foreground/60" : ""
                    }`}
                  />
                ))}
              </div>
              {modalItem.description ? (
                <p className="text-sm leading-relaxed text-foreground/75">
                  {modalItem.description}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
