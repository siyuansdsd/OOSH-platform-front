"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  interactive?: boolean;
}

function WebsitePreview({ url, interactive = true }: WebsitePreviewProps) {
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

  const looksLikeIcon = (href: string) => /favicon|icon|logo/i.test(href);

  if (!image || looksLikeIcon(image)) {
    const frame = (
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-foreground/5">
        <iframe
          src={url}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups"
          scrolling="no"
          className="pointer-events-none absolute inset-0 border-0"
          style={{
            width: "166%",
            height: "166%",
            transform: "scale(0.6)",
            transformOrigin: "top left",
          }}
          title="Website preview"
        />
      </div>
    );
    return interactive ? (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        {frame}
      </a>
    ) : (
      frame
    );
  }

  if (!interactive) {
    return (
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
        <img
          src={image}
          alt="Website preview"
          className="h-full w-full object-cover"
        />
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

  const gridItems = useMemo(() => items ?? [], [items]);

  const modalTitle = modalItem
    ? modalItem.title || modalItem.groupName || modalItem.personName || "Project"
    : "";
  const modalStudents = modalItem
    ? Array.from(
        new Set(
          [
            ...(modalItem.members || []),
            ...(modalItem.personName ? [modalItem.personName] : []),
          ]
        )
      )
    : [];

  const openModal = (item: HomeworkRecord) => {
    setModalItem(item);
  };

  const closeModal = () => {
    setModalItem(null);
  };

  const CardMedia = ({ item }: { item: HomeworkRecord }) => {
    const videoCount = item.videos.length;
    const imageCount = item.images.length;
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const badges: Array<{ label: string; variant: "video" | "image" }> = [];
    if (videoCount > 0) {
      if (videoCount - 1 > 0) {
        badges.push({
          label:
            videoCount - 1 === 1 ? "+1 more video" : `+${videoCount - 1} more videos`,
          variant: "video",
        });
      }
      if (imageCount > 0) {
        badges.push({
          label:
            imageCount === 1 ? "+1 more image" : `+${imageCount} more images`,
          variant: "image",
        });
      }
    } else if (imageCount > 1) {
      const remaining = imageCount - 1;
      badges.push({
        label: remaining === 1 ? "+1 more image" : `+${remaining} more images`,
        variant: "image",
      });
    }

    const clearTimer = () => {
      if (hoverTimer.current) {
        clearTimeout(hoverTimer.current);
        hoverTimer.current = null;
      }
    };

    const stopVideo = () => {
      clearTimer();
      const videoEl = videoRef.current;
      if (videoEl) {
        videoEl.pause();
        try {
          videoEl.currentTime = 0;
        } catch {}
      }
    };

    const schedulePlay = () => {
      if (videoCount === 0) return;
      clearTimer();
      hoverTimer.current = setTimeout(() => {
        const videoEl = videoRef.current;
        if (videoEl) {
          videoEl.play().catch(() => {});
        }
      }, 900);
    };

    useEffect(() => () => stopVideo(), []);

    if (videoCount > 0) {
      return (
        <div
          className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black"
          onMouseEnter={schedulePlay}
          onMouseLeave={stopVideo}
          onTouchStart={schedulePlay}
          onTouchEnd={stopVideo}
          onTouchCancel={stopVideo}
        >
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            src={item.videos[0]}
            muted
            loop
            playsInline
            preload="metadata"
            controls={false}
          >
            Your browser does not support the video tag.
          </video>
          {badges.length > 0 ? (
            <div className="pointer-events-none absolute right-3 top-3 flex w-32 flex-col items-end gap-1 text-xs font-semibold text-white">
              {badges.map((badge) => (
                <span
                  key={badge.label}
                  className={`inline-flex w-full justify-center rounded-full px-3 py-1 ${
                    badge.variant === "video"
                      ? "bg-sky-500/80"
                      : "bg-orange-500/80"
                  }`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      );
    }

    if (imageCount > 0) {
      return (
        <div className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
          <img
            src={item.images[0]}
            alt={item.title || item.groupName || item.personName || "Project image"}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
          {badges.length > 0 ? (
            <div className="pointer-events-none absolute right-3 top-3 flex w-32 flex-col items-end gap-1 text-xs font-semibold text-white">
              {badges.map((badge) => (
                <span
                  key={badge.label}
                  className={`inline-flex w-full justify-center rounded-full px-3 py-1 ${
                    badge.variant === "video"
                      ? "bg-sky-500/80"
                      : "bg-orange-500/80"
                  }`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      );
    }

    if (item.hasWebsite && item.urls[0]) {
      return <WebsitePreview url={item.urls[0]} interactive={false} />;
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
        {gridItems.map((item, index) => {
          const cardTitle =
            item.title || item.groupName || item.personName || "Untitled project";
          return (
            <article
              key={`${item.id}-${index}`}
              role="button"
              tabIndex={0}
              onClick={() => openModal(item)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openModal(item);
                }
              }}
              className="flex h-full cursor-pointer flex-col overflow-hidden rounded-3xl border border-foreground/10 bg-white/5 p-4 backdrop-blur transition duration-200 hover:-translate-y-1 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
            >
              <CardMedia item={item} />
              <div className="mt-4">
                <h3 className="text-base font-semibold text-foreground">
                  {cardTitle}
                </h3>
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
          <div className="relative z-10 max-h-[90vh] w-[min(90vw,960px)] overflow-y-auto rounded-3xl bg-background p-6 text-foreground shadow-2xl">
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-4 top-4 h-10 w-10 rounded-full bg-foreground/10 text-2xl font-semibold text-foreground/80 transition hover:bg-foreground/20"
              aria-label="Close"
            >
              ×
            </button>
            <div className="flex flex-col gap-6">
              <header className="space-y-3">
                <span className="text-xs uppercase tracking-wide text-foreground/50">
                  Project overview
                </span>
                <h2 className="text-2xl font-semibold text-foreground">{modalTitle}</h2>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-foreground/70">
                  <div>
                    <span className="font-medium text-foreground">School:</span> {modalItem.schoolName}
                  </div>
                  {modalItem.groupName ? (
                    <div>
                      <span className="font-medium text-foreground">Team:</span> {modalItem.groupName}
                    </div>
                  ) : null}
                  {modalStudents.length > 0 ? (
                    <div>
                      <span className="font-medium text-foreground">Students:</span> {modalStudents.join(", ")}
                    </div>
                  ) : null}
                </div>
              </header>

              {modalItem.description ? (
                <p className="rounded-2xl bg-foreground/5 p-4 text-sm leading-relaxed text-foreground/80">
                  {modalItem.description}
                </p>
              ) : null}

              {modalItem.images.length > 0 ? (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Images</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {modalItem.images.map((image) => (
                      <img
                        key={image}
                        src={image}
                        alt={modalTitle}
                        className="w-full rounded-2xl object-cover"
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {modalItem.videos.length > 0 ? (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Videos</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {modalItem.videos.map((video) => (
                      <video
                        key={video}
                        src={video}
                        controls
                        playsInline
                        className="w-full overflow-hidden rounded-2xl"
                      >
                        Your browser does not support the video tag.
                      </video>
                    ))}
                  </div>
                </section>
              ) : null}

              {modalItem.urls.length > 0 ? (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Websites</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {modalItem.urls.map((url) => (
                      <WebsitePreview key={url} url={url} />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
