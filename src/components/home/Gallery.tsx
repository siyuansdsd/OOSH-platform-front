"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TouchEvent } from "react";
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
  const [mediaIndex, setMediaIndex] = useState(0);
  const touchStartRef = useRef<number | null>(null);
  const touchCurrentRef = useRef<number | null>(null);

  const gridItems = useMemo(() => items ?? [], [items]);

  const modalTitle = modalItem
    ? modalItem.title ||
      modalItem.groupName ||
      modalItem.personName ||
      "Project"
    : "";
  const modalStudents = modalItem
    ? Array.from(
        new Set([
          ...(modalItem.members || []),
          ...(modalItem.personName ? [modalItem.personName] : []),
        ])
      )
    : [];

  const mediaItems = useMemo(() => {
    if (!modalItem)
      return [] as Array<{ type: "image" | "video" | "website"; src: string }>;
    const itemsList: Array<{
      type: "image" | "video" | "website";
      src: string;
    }> = [];
    modalItem.images.forEach((src) => {
      if (src) itemsList.push({ type: "image", src });
    });
    modalItem.videos.forEach((src) => {
      if (src) itemsList.push({ type: "video", src });
    });
    modalItem.urls.forEach((src) => {
      if (src) itemsList.push({ type: "website", src });
    });
    return itemsList;
  }, [modalItem]);

  useEffect(() => {
    setMediaIndex(0);
  }, [modalItem?.id]);

  const handleNextMedia = () => {
    if (mediaItems.length === 0) return;
    setMediaIndex((prev) => (prev + 1) % mediaItems.length);
  };

  const handlePrevMedia = () => {
    if (mediaItems.length === 0) return;
    setMediaIndex((prev) => (prev - 1 + mediaItems.length) % mediaItems.length);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartRef.current = event.touches[0]?.clientX ?? null;
    touchCurrentRef.current = touchStartRef.current;
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    touchCurrentRef.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = () => {
    if (touchStartRef.current === null || touchCurrentRef.current === null) {
      touchStartRef.current = null;
      touchCurrentRef.current = null;
      return;
    }
    const delta = touchStartRef.current - touchCurrentRef.current;
    const SWIPE_THRESHOLD = 40;
    if (Math.abs(delta) > SWIPE_THRESHOLD) {
      if (delta > 0) handleNextMedia();
      else handlePrevMedia();
    }
    touchStartRef.current = null;
    touchCurrentRef.current = null;
  };

  const detailLine = useMemo(() => {
    if (!modalItem) return "";
    const parts: string[] = [];
    if (modalItem.groupName || modalItem.personName) {
      parts.push(modalItem.groupName || modalItem.personName || "");
    }
    if (modalStudents.length > 0) {
      parts.push(modalStudents.join(", "));
    }
    return parts.filter(Boolean).join(" · ");
  }, [modalItem, modalStudents]);

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

    // Detect mobile devices and tablets (including iPad)
    const isMobile = useMemo(() => {
      if (typeof window === "undefined") return false;

      // Check for touch capability
      const hasTouchSupport =
        "ontouchstart" in window || navigator.maxTouchPoints > 0;

      // Traditional mobile/tablet user agents
      const mobileUserAgent =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );

      // Modern iPad detection (iPadOS 13+ reports as desktop Safari)
      const isIPad = /Macintosh/i.test(navigator.userAgent) && hasTouchSupport;

      return mobileUserAgent || isIPad || hasTouchSupport;
    }, []);

    const badges: Array<{ label: string; variant: "video" | "image" }> = [];
    if (videoCount > 0) {
      if (videoCount - 1 > 0) {
        badges.push({
          label:
            videoCount - 1 === 1
              ? "+1 more video"
              : `+${videoCount - 1} more videos`,
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

    if (imageCount > 0) {
      return (
        <div className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
          <img
            src={item.images[0]}
            alt={
              item.title || item.groupName || item.personName || "Project image"
            }
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

    if (videoCount > 0) {
      // On mobile, show static video poster to avoid touch conflicts
      if (isMobile) {
        return (
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
            <video
              className="h-full w-full object-cover"
              src={item.videos[0]}
              muted
              playsInline
              preload="metadata"
              controls={false}
              poster=""
            >
              Your browser does not support the video tag.
            </video>
            {/* Play icon overlay for mobile */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-full bg-black/60 p-3">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="white"
                  className="ml-1"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
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

      // Desktop version with hover to play
      return (
        <div
          className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black"
          onMouseEnter={schedulePlay}
          onMouseLeave={stopVideo}
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
      <div
        className={`rounded-3xl border border-foreground/10 bg-white/5 p-10 text-center text-sm text-foreground/60 ${className}`}
      >
        {emptyState ?? "No items found."}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {gridItems.map((item, index) => {
          const cardTitle =
            item.title ||
            item.groupName ||
            item.personName ||
            "Untitled project";
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
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 sm:px-6">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeModal}
            aria-hidden="true"
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-gradient-to-br from-blue-500/95 to-orange-500/95 p-4 text-white shadow-2xl backdrop-blur sm:p-6">
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-4 top-4 z-30 h-10 w-10 rounded-full bg-black/30 text-2xl font-semibold text-white transition hover:bg-black/50"
              aria-label="Close"
            >
              ×
            </button>
            <div className="flex flex-col gap-6">
              <div
                className="relative h-[280px] w-full overflow-hidden rounded-3xl bg-black/70 sm:h-[360px]"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {mediaItems.length > 0 ? (
                  <>
                    <div
                      className="flex h-full w-full transition-transform duration-300"
                      style={{ transform: `translateX(-${mediaIndex * 100}%)` }}
                    >
                      {mediaItems.map((media) => (
                        <div
                          key={`${media.type}-${media.src}`}
                          className="flex h-full w-full flex-shrink-0 items-center justify-center bg-black/80"
                        >
                          {media.type === "image" ? (
                            <img
                              src={media.src}
                              alt={modalTitle}
                              className="h-full w-full object-contain"
                            />
                          ) : media.type === "video" ? (
                            <video
                              src={media.src}
                              controls
                              playsInline
                              className="h-full w-full object-contain"
                            >
                              Your browser does not support the video tag.
                            </video>
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-white">
                              <iframe
                                src={media.src}
                                loading="lazy"
                                sandbox="allow-scripts allow-same-origin allow-popups"
                                className="h-full w-full border-0"
                                title="Website preview"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {mediaItems.length > 1 ? (
                      <>
                        <span className="absolute right-16 top-4 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white shadow">
                          {mediaIndex + 1}/{mediaItems.length}
                        </span>
                        <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-2">
                          {mediaItems.map((_, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setMediaIndex(idx)}
                              className={`h-2.5 w-2.5 rounded-full transition ${
                                idx === mediaIndex ? "bg-white" : "bg-white/40"
                              }`}
                              aria-label={`Go to media ${idx + 1}`}
                            />
                          ))}
                        </div>
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-2">
                          <button
                            type="button"
                            onClick={handlePrevMedia}
                            className="pointer-events-auto hidden size-10 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60 sm:flex"
                            aria-label="Previous media"
                          >
                            ‹
                          </button>
                          <button
                            type="button"
                            onClick={handleNextMedia}
                            className="pointer-events-auto hidden size-10 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60 sm:flex"
                            aria-label="Next media"
                          >
                            ›
                          </button>
                        </div>
                      </>
                    ) : null}
                  </>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-white/70">
                    No media available
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h2 className="text-xl font-semibold text-white sm:text-2xl">
                  {modalTitle}
                </h2>
                {detailLine ? (
                  <p className="text-sm text-white/80">{detailLine}</p>
                ) : null}
                {modalItem.schoolName ? (
                  <p className="text-xs uppercase tracking-wide text-white/60">
                    {modalItem.schoolName}
                  </p>
                ) : null}
                {modalItem.description ? (
                  <p className="text-sm leading-relaxed text-white/90">
                    {modalItem.description}
                  </p>
                ) : null}
              </div>

              {modalItem.urls.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {modalItem.urls.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-medium text-white shadow-sm transition hover:border-white/50 hover:bg-white/30"
                    >
                      View site
                      <span aria-hidden="true">→</span>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
