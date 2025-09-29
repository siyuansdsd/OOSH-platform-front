"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Gallery } from "@/components/home/Gallery";
import { SearchBar } from "@/components/home/SearchBar";
import { APPROVED_SCHOOLS } from "@/constants/schools";
import {
  fetchHomeworks,
  type HomeworkListParams,
  type HomeworkRecord,
} from "@/lib/api/homeworks";

const PAGE_SIZE = 12;

interface CacheEntry {
  items: HomeworkRecord[];
  page: number;
  hasMore: boolean;
  total: number;
  pageSize: number;
}

type Filters = {
  school: string;
  name: string;
};

const defaultFilters: Filters = {
  school: "",
  name: "",
};

type RunFetchArgs = {
  filters: Filters;
  page: number;
  append: boolean;
  ignoreCache?: boolean;
};

export function HomePageClient() {
  const { accessToken } = useAuth();
  const [formFilters, setFormFilters] = useState<Filters>(defaultFilters);
  const [activeFilters, setActiveFilters] = useState<Filters>(defaultFilters);
  const [items, setItems] = useState<HomeworkRecord[]>([]);
  const itemsRef = useRef<HomeworkRecord[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [serverHasMore, setServerHasMore] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const buildCacheKey = useCallback((filters: Filters) => {
    const school = filters.school.trim().toLowerCase();
    const name = filters.name.trim().toLowerCase();
    return `${school || "*"}::${name || "*"}`;
  }, []);

  const appliedFiltersLabel = useMemo(() => {
    const parts: string[] = [];
    if (activeFilters.school) parts.push(activeFilters.school);
    if (activeFilters.name) parts.push(`Name: ${activeFilters.name}`);
    return parts.join(" · ");
  }, [activeFilters]);

  const availableSchools = useMemo(() => [...APPROVED_SCHOOLS], []);

  const syncFromCache = useCallback(
    (filters: Filters) => {
      const cached = cacheRef.current.get(buildCacheKey(filters));
      if (!cached) return false;
      setItems(cached.items);
      setPage(cached.page);
      setHasMore(cached.hasMore);
      setServerTotal(cached.total);
      setServerHasMore(cached.hasMore);
      setLoading(false);
      setLoadingMore(false);
      setError(null);
      return true;
    },
    [buildCacheKey],
  );

  const runFetch = useCallback(
    async ({ filters, page, append, ignoreCache = false }: RunFetchArgs) => {
      if (!accessToken) return;

      const cacheKey = buildCacheKey(filters);
      const cachedEntry = cacheRef.current.get(cacheKey);

      if (!append && !ignoreCache && cachedEntry) {
        setItems(cachedEntry.items);
        setPage(cachedEntry.page);
        setHasMore(cachedEntry.hasMore);
        setServerTotal(cachedEntry.total);
        setServerHasMore(cachedEntry.hasMore);
        setLoading(false);
        setLoadingMore(false);
        setError(null);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setError(null);
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const commonParams: HomeworkListParams = {
          page,
          pageSize: PAGE_SIZE,
          school: filters.school || undefined,
          name: filters.name || undefined,
          category: "all",
          signal: controller.signal,
        };

        const result = await fetchHomeworks(commonParams, accessToken);

        if (controller.signal.aborted) return;

        const normalizedItems = result.items.filter(Boolean);

        const baseItems = append
          ? (cachedEntry?.items ?? itemsRef.current)
          : [];
        const existingIds = new Set(baseItems.map((item) => item.id));
        const uniqueNew = append
          ? normalizedItems.filter((item) => !existingIds.has(item.id))
          : normalizedItems;
        const combinedItems = append
          ? [...baseItems, ...uniqueNew]
          : normalizedItems;

        setItems(combinedItems);

        const nextPage = result.page ?? page;
        const rawHasMore =
          typeof result.hasMore === "boolean" ? result.hasMore : null;
        const nextHasMore =
          rawHasMore !== null
            ? rawHasMore
            : normalizedItems.length > 0 &&
              normalizedItems.length === (result.pageSize ?? PAGE_SIZE);
        const nextTotal =
          typeof result.total === "number"
            ? result.total
            : combinedItems.length;

        setPage(nextPage);
        setHasMore(nextHasMore);
        setServerTotal(nextTotal);
        setServerHasMore(rawHasMore);

        cacheRef.current.set(cacheKey, {
          items: combinedItems,
          page: nextPage,
          hasMore: nextHasMore,
          total: nextTotal,
          pageSize: result.pageSize ?? PAGE_SIZE,
        });
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        setError(
          error instanceof Error ? error.message : "Failed to load data",
        );
      } finally {
        if (!controller.signal.aborted) {
          if (append) setLoadingMore(false);
          else setLoading(false);
        }
      }
    },
    [accessToken, buildCacheKey],
  );

  const handleSearch = () => {
    const nextFilters = { ...formFilters };
    setActiveFilters(nextFilters);
    setPage(1);
    setHasMore(false);
    setServerHasMore(null);
    setError(null);
    syncFromCache(nextFilters);
  };

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    runFetch({
      filters: activeFilters,
      page: page + 1,
      append: true,
    });
  };

  useEffect(() => {
    if (!accessToken) return;
    runFetch({
      filters: activeFilters,
      page: 1,
      append: false,
    });
  }, [accessToken, activeFilters, runFetch]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const filteredBySearch = useMemo(() => {
    const normalizedSchool = activeFilters.school.trim().toLowerCase();
    const normalizedName = activeFilters.name.trim().toLowerCase();

    if (!normalizedSchool && !normalizedName) return items;

    return items.filter((item) => {
      const matchesSchool = normalizedSchool
        ? (item.schoolName || "").toLowerCase().includes(normalizedSchool)
        : true;

      if (!matchesSchool) return false;

      if (!normalizedName) return true;

      const nameHaystack = [
        item.title,
        item.groupName,
        item.personName,
        ...(item.members || []),
      ]
        .filter(Boolean)
        .map((entry) => String(entry).toLowerCase());

      return nameHaystack.some((value) => value.includes(normalizedName));
    });
  }, [items, activeFilters]);

  const displayItems = useMemo(() => filteredBySearch, [filteredBySearch]);

  return (
    <div className="flex flex-col gap-6">
      <SearchBar
        schools={availableSchools}
        value={formFilters}
        onChange={setFormFilters}
        onSubmit={handleSearch}
        loading={loading && !loadingMore}
      />

      {appliedFiltersLabel ? (
        <div className="text-sm text-foreground/60">
          Showing results for {appliedFiltersLabel}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-3xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <Gallery
        items={displayItems}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        rawTotal={serverTotal}
        rawHasMore={serverHasMore}
        onLoadMore={loadMore}
      />
    </div>
  );
}
