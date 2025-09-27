"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Gallery } from "@/components/home/Gallery";
import { SearchBar } from "@/components/home/SearchBar";
import { TypeFilter } from "@/components/home/TypeFilter";
import { APPROVED_SCHOOLS } from "@/constants/schools";
import {
  fetchHomeworks,
  type HomeworkCategory,
  type HomeworkRecord,
} from "@/lib/api/homeworks";
import { useAuth } from "@/components/auth/AuthProvider";

const PAGE_SIZE = 12;

type FilterValue = "all" | HomeworkCategory;
const DEFAULT_TYPE: FilterValue = "media";

type Filters = {
  school: string;
  name: string;
};

const defaultFilters: Filters = {
  school: "",
  name: "",
};

export function HomePageClient() {
  const { accessToken } = useAuth();
  const [formFilters, setFormFilters] = useState<Filters>(defaultFilters);
  const [activeFilters, setActiveFilters] = useState<Filters>(defaultFilters);
  const [typeFilter, setTypeFilter] = useState<FilterValue>(DEFAULT_TYPE);
  const [items, setItems] = useState<HomeworkRecord[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [serverHasMore, setServerHasMore] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const appliedFiltersLabel = useMemo(() => {
    const parts: string[] = [];
    if (activeFilters.school) parts.push(activeFilters.school);
    if (activeFilters.name) parts.push(`Name: ${activeFilters.name}`);
    if (typeFilter !== "all" && typeFilter !== DEFAULT_TYPE) {
      parts.push(typeFilter === "media" ? "Media" : "Website");
    }
    return parts.join(" · ");
  }, [activeFilters, typeFilter]);

  const availableSchools = useMemo(() => [...APPROVED_SCHOOLS], []);

  const runFetch = useCallback(
    async (params: {
      filters: Filters;
      type: FilterValue;
      page: number;
      append: boolean;
    }) => {
      if (!accessToken) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setError(null);
      if (params.append) setLoadingMore(true);
      else setLoading(true);
      try {
        const result = await fetchHomeworks(
          {
            page: params.page,
            pageSize: PAGE_SIZE,
            school: params.filters.school || undefined,
            name: params.filters.name || undefined,
            category: params.type === "all" ? undefined : params.type,
            signal: controller.signal,
          },
          accessToken
        );
        if (controller.signal.aborted) return;
        setItems((prev) => {
          if (!params.append) return result.items;
          // Append but avoid duplicates by id while preserving order: existing first, then new unique items
          const existingIds = new Set(prev.map((it) => it.id));
          const uniqueNew = result.items.filter(
            (it) => !existingIds.has(it.id)
          );
          return [...prev, ...uniqueNew];
        });
        setPage(result.page);
        setHasMore(result.hasMore);
        setServerTotal(result.total ?? null);
        setServerHasMore(result.hasMore ?? null);
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        setError(
          error instanceof Error ? error.message : "Failed to load data"
        );
      } finally {
        if (!controller.signal.aborted) {
          if (params.append) setLoadingMore(false);
          else setLoading(false);
        }
      }
    },
    [accessToken]
  );

  const initialisedRef = useRef(false);

  useEffect(() => {
    if (!accessToken) return;
    if (initialisedRef.current) return;
    initialisedRef.current = true;
    runFetch({
      filters: activeFilters,
      type: typeFilter,
      page: 1,
      append: false,
    });
  }, [accessToken, activeFilters, typeFilter, runFetch]);

  const handleSearch = () => {
    setActiveFilters(formFilters);
    runFetch({
      filters: formFilters,
      type: typeFilter,
      page: 1,
      append: false,
    });
  };

  const handleTypeChange = (next: FilterValue) => {
    setTypeFilter(next);
  };

  const handleRefresh = () => {
    runFetch({
      filters: activeFilters,
      type: typeFilter,
      page: 1,
      append: false,
    });
  };

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    runFetch({
      filters: activeFilters,
      type: typeFilter,
      page: page + 1,
      append: true,
    });
  };

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

  const displayItems = useMemo(() => {
    if (typeFilter === "media")
      return filteredBySearch.filter((item) => item.hasMedia);
    if (typeFilter === "website")
      return filteredBySearch.filter((item) => item.hasWebsite);
    return filteredBySearch;
  }, [filteredBySearch, typeFilter]);

  return (
    <div className="flex flex-col gap-6">
      <SearchBar
        schools={availableSchools}
        value={formFilters}
        onChange={setFormFilters}
        onSubmit={handleSearch}
        loading={loading && !loadingMore}
      />

      <TypeFilter
        value={typeFilter}
        onChange={handleTypeChange}
        onRefresh={handleRefresh}
        refreshing={loading && !loadingMore}
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
