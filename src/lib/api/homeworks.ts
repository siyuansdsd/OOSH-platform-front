export type HomeworkCategory = "media" | "website";

export interface HomeworkRecord {
  id: string;
  schoolName: string;
  groupName?: string;
  personName?: string;
  isTeam?: boolean;
  description?: string;
  title?: string;
  createdAt?: string;
  images: string[];
  videos: string[];
  urls: string[];
  hasMedia: boolean;
  hasWebsite: boolean;
  raw?: unknown;
}

export interface HomeworkListParams {
  page?: number;
  pageSize?: number;
  school?: string;
  name?: string;
  category?: HomeworkCategory | "all";
  signal?: AbortSignal;
}

export interface HomeworkListResult {
  items: HomeworkRecord[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  raw?: unknown;
}

const pick = <T,>(...vals: Array<T | undefined | null>): T | undefined =>
  vals.find((v) => v !== undefined && v !== null);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const toUnknownArray = (input: unknown): unknown[] => {
  if (input === null || input === undefined) return [];
  if (Array.isArray(input)) return input;
  if (isRecord(input)) return Object.values(input);
  return [input];
};

const toStringArray = (value: unknown) =>
  toUnknownArray(value)
    .map((v) => String(v).trim())
    .filter(Boolean);

const getFromRecord = (
  record: Record<string, unknown>,
  keys: string[]
): unknown => pick(...keys.map((key) => record[key]));

const pickFromSources = (
  sources: Array<Record<string, unknown> | undefined>,
  keys: string[]
) =>
  pick(
    ...sources.flatMap((source) =>
      source ? keys.map((key) => source[key]) : []
    )
  );

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const normalizeItem = (item: unknown): HomeworkRecord | null => {
  if (!isRecord(item)) return null;
  const idRaw = getFromRecord(item, [
    "id",
    "_id",
    "uuid",
    "homeworkId",
    "homework_id",
    "slug",
  ]);
  const id = String(idRaw ?? "").trim();
  if (!id) return null;

  const schoolRaw = getFromRecord(item, [
    "schoolName",
    "school_name",
    "school",
    "schoolname",
    "school_name_en",
  ]);
  const schoolName = String(schoolRaw ?? "").trim() || "Unknown school";

  const groupName = getFromRecord(item, ["groupName", "group_name", "team_name"]);
  const personName = getFromRecord(item, [
    "personName",
    "person_name",
    "student_name",
  ]);
  const description = getFromRecord(item, [
    "description",
    "desc",
    "summary",
    "details",
  ]);
  const title = getFromRecord(item, [
    "title",
    "name",
    "projectTitle",
    "project_title",
  ]);
  const createdAt = getFromRecord(item, ["createdAt", "created_at", "createdOn"]);
  const images = toStringArray(
    getFromRecord(item, ["images", "image_urls", "photos"])
  );
  const videos = toStringArray(
    getFromRecord(item, ["videos", "video_urls", "media"])
  );
  const urls = toStringArray(
    getFromRecord(item, ["urls", "links", "website", "websites"])
  );

  const hasMedia = images.length > 0 || videos.length > 0;
  const hasWebsite = urls.length > 0;

  const isTeamRaw = getFromRecord(item, [
    "is_team",
    "isTeam",
    "team",
    "isTeamProject",
  ]);

  return {
    id,
    schoolName,
    groupName: groupName ? String(groupName) : undefined,
    personName: personName ? String(personName) : undefined,
    isTeam: typeof isTeamRaw === "boolean" ? isTeamRaw : Boolean(isTeamRaw),
    description: description ? String(description) : undefined,
    title: title ? String(title) : undefined,
    createdAt: createdAt ? String(createdAt) : undefined,
    images,
    videos,
    urls,
    hasMedia,
    hasWebsite,
    raw: item,
  };
};

const extractList = (
  payload: unknown
): { items: unknown[]; meta: Record<string, unknown> } => {
  if (Array.isArray(payload)) return { items: payload, meta: {} };
  if (!isRecord(payload)) return { items: toUnknownArray(payload), meta: {} };

  const envelopes: unknown[] = [payload];
  for (const key of ["data", "result", "payload"]) {
    if (payload[key] !== undefined) envelopes.push(payload[key]);
  }

  for (const entry of envelopes) {
    if (Array.isArray(entry)) return { items: entry, meta: payload };
    if (!isRecord(entry)) continue;
    const items = getFromRecord(entry, [
      "items",
      "results",
      "data",
      "records",
      "rows",
    ]);
    if (Array.isArray(items)) return { items, meta: entry };
    if (isRecord(items)) return { items: Object.values(items), meta: entry };
  }

  return { items: toUnknownArray(payload), meta: payload };
};

export const fetchHomeworks = async (params: HomeworkListParams = {}) => {
  const searchParams = new URLSearchParams();
  if (params.page && params.page > 0) searchParams.set("page", String(params.page));
  if (params.pageSize && params.pageSize > 0)
    searchParams.set("pageSize", String(params.pageSize));
  if (params.school) searchParams.set("school", params.school);
  if (params.name) searchParams.set("name", params.name);
  if (params.category && params.category !== "all")
    searchParams.set("type", params.category);

  const qs = searchParams.toString();
  const res = await fetch(`/api/homeworks${qs ? `?${qs}` : ""}`, {
    method: "GET",
    cache: "no-store",
    signal: params.signal,
  });
  if (!res.ok) {
    const message = await res
      .text()
      .catch(() => `HTTP ${res.status}`);
    const error = new Error(message || `HTTP ${res.status}`);
    Object.assign(error, { status: res.status });
    throw error;
  }
  const rawText = await res.text();
  let parsed: unknown = {};
  try {
    parsed = rawText ? JSON.parse(rawText) : {};
  } catch {
    parsed = {};
  }
  const parsedRecord = isRecord(parsed) ? parsed : undefined;
  const { items: rawItems, meta } = extractList(parsed);
  const items = rawItems
    .map((item) => normalizeItem(item))
    .filter((item): item is HomeworkRecord => Boolean(item));

  const metaSources = [meta, parsedRecord];

  const totalRaw = pickFromSources(metaSources, [
    "total",
    "totalCount",
    "count",
    "totalElements",
  ]);
  const total = toFiniteNumber(totalRaw) ?? rawItems.length;

  const pageRaw = pickFromSources(metaSources, [
    "page",
    "pageNumber",
    "currentPage",
  ]);
  const page = toFiniteNumber(pageRaw) ?? params.page ?? 1;

  const pageSizeRaw = pickFromSources(metaSources, [
    "pageSize",
    "limit",
    "size",
  ]);
  const pageSize = toFiniteNumber(pageSizeRaw) ?? params.pageSize ?? items.length;

  const safeTotal = total < 0 ? rawItems.length : total;
  const safePage = page < 1 ? 1 : page;
  const safePageSize = pageSize < 1 ? Math.max(items.length, 1) : pageSize;
  const hasMore =
    items.length > 0 && safePage * safePageSize < (safeTotal || items.length);

  return {
    items,
    total: safeTotal || items.length,
    page: safePage,
    pageSize: safePageSize,
    hasMore,
    raw: parsed,
  } satisfies HomeworkListResult;
};
