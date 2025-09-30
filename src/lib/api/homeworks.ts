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
  members: string[];
  hasMedia: boolean;
  hasWebsite: boolean;
  raw?: unknown;
}

export interface HomeworkListParams {
  cursor?: string;
  pageSize?: number;
  school?: string;
  name?: string;
  category?: HomeworkCategory | "all";
  signal?: AbortSignal;
}

export interface HomeworkListResult {
  items: HomeworkRecord[];
  total?: number;
  nextCursor?: string | null;
  pageSize: number;
  hasMore: boolean;
  raw?: unknown;
}

const pick = <T>(...vals: Array<T | undefined | null>): T | undefined =>
  vals.find((v) => v !== undefined && v !== null);

const pickFromSources = (
  sources: Array<Record<string, unknown> | undefined>,
  keys: string[],
) =>
  pick(
    ...sources.flatMap((source) =>
      source ? keys.map((key) => source[key]) : [],
    ),
  );

const toTrimmedString = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const toUnknownArray = (input: unknown): unknown[] => {
  if (input === null || input === undefined) return [];
  if (Array.isArray(input)) return input;
  return [input];
};

const looksLikeUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^(https?:)?\/\//i.test(trimmed)) return true;
  if (/^data:/i.test(trimmed)) return true;
  if (/^s3:\/\//i.test(trimmed)) return true;
  if (trimmed.startsWith("/")) return true;
  return false;
};

const findUrl = (value: unknown, depth = 0): string | undefined => {
  if (typeof value === "string") {
    return looksLikeUrl(value) ? value.trim() : undefined;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const url = findUrl(entry, depth + 1);
      if (url) return url;
    }
    return undefined;
  }
  if (isRecord(value) && depth < 5) {
    const direct = pickFromSources(
      [value],
      [
        "url",
        "href",
        "src",
        "link",
        "linkUrl",
        "link_url",
        "fileUrl",
        "file_url",
        "publicUrl",
        "public_url",
        "downloadUrl",
        "download_url",
        "videoUrl",
        "video_url",
        "signedUrl",
        "signed_url",
        "assetUrl",
        "asset_url",
        "path",
      ],
    );
    if (typeof direct === "string" && looksLikeUrl(direct)) {
      return direct.trim();
    }
    for (const entry of Object.values(value)) {
      const nested = findUrl(entry, depth + 1);
      if (nested) return nested;
    }
  }
  return undefined;
};

const toStringArray = (value: unknown) => {
  const results: string[] = [];
  for (const entry of toUnknownArray(value)) {
    const url = findUrl(entry);
    if (url) {
      results.push(url);
    }
  }
  return results;
};

const toPlainStringArray = (value: unknown) =>
  toUnknownArray(value)
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (isRecord(entry)) {
        const candidate = pickFromSources(
          [entry],
          ["name", "value", "label", "text"],
        );
        if (typeof candidate === "string") return candidate.trim();
      }
      return "";
    })
    .filter(Boolean);

const getFromRecord = (
  record: Record<string, unknown>,
  keys: string[],
): unknown => pick(...keys.map((key) => record[key]));

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
  const id = toTrimmedString(idRaw);
  if (!id) return null;

  const schoolRaw = getFromRecord(item, [
    "schoolName",
    "school_name",
    "school",
    "schoolname",
    "school_name_en",
  ]);
  const schoolName = toTrimmedString(schoolRaw) || "Unknown school";

  const groupNameRaw = getFromRecord(item, [
    "groupName",
    "group_name",
    "team_name",
  ]);
  const personNameRaw = getFromRecord(item, [
    "personName",
    "person_name",
    "student_name",
  ]);
  const descriptionRaw = getFromRecord(item, [
    "description",
    "desc",
    "summary",
    "details",
  ]);
  const titleRaw = getFromRecord(item, [
    "title",
    "name",
    "projectTitle",
    "project_title",
  ]);
  const createdAtRaw = getFromRecord(item, [
    "createdAt",
    "created_at",
    "createdOn",
  ]);
  const groupName = toTrimmedString(groupNameRaw);
  const personName = toTrimmedString(personNameRaw);
  const description = toTrimmedString(descriptionRaw);
  const title = toTrimmedString(titleRaw);
  const createdAt = toTrimmedString(createdAtRaw);

  const images = toStringArray(
    getFromRecord(item, ["images", "image_urls", "photos"]),
  );
  const videos = toStringArray(
    getFromRecord(item, ["videos", "video_urls", "media", "video"]),
  );
  const urls = toStringArray(
    getFromRecord(item, ["urls", "links", "website", "websites"]),
  );
  const members = toPlainStringArray(
    getFromRecord(item, [
      "members",
      "teamMembers",
      "team_members",
      "memberNames",
      "member_names",
    ]),
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
    groupName: groupName || undefined,
    personName: personName || undefined,
    isTeam: typeof isTeamRaw === "boolean" ? isTeamRaw : Boolean(isTeamRaw),
    description: description || undefined,
    title: title || undefined,
    createdAt: createdAt || undefined,
    images,
    videos,
    urls,
    members,
    hasMedia,
    hasWebsite,
    raw: item,
  };
};

const extractList = (
  payload: unknown,
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

const fetchHomeworksFromEndpoint = async (
  endpoint: string,
  params: HomeworkListParams = {},
  token?: string,
) => {
  const searchParams = new URLSearchParams();
  if (params.cursor)
    searchParams.set("cursor", params.cursor);
  if (params.pageSize && params.pageSize > 0) {
    // Primary param name
    searchParams.set("pageSize", String(params.pageSize));
    // Also send common aliases for compatibility with backends that expect different names
    searchParams.set("per_page", String(params.pageSize));
    searchParams.set("limit", String(params.pageSize));
  }
  if (params.school) searchParams.set("school", params.school);
  if (params.name) searchParams.set("name", params.name);
  if (params.category && params.category !== "all")
    searchParams.set("type", params.category);

  const qs = searchParams.toString();
  const res = await fetch(`${endpoint}${qs ? `?${qs}` : ""}`, {
    method: "GET",
    cache: "no-store",
    signal: params.signal,
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });
  if (!res.ok) {
    const message = await res.text().catch(() => `HTTP ${res.status}`);
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

  const nextCursorRaw = pickFromSources(metaSources, [
    "nextCursor",
    "next_cursor",
    "cursor",
  ]);
  const nextCursor = typeof nextCursorRaw === "string" ? nextCursorRaw : null;

  const pageSizeRaw = pickFromSources(metaSources, [
    "pageSize",
    "limit",
    "size",
  ]);
  const pageSize =
    toFiniteNumber(pageSizeRaw) ?? params.pageSize ?? items.length;

  const safeTotal = total < 0 ? undefined : total;
  const safePageSize = pageSize < 1 ? Math.max(items.length, 1) : pageSize;
  const hasMore = nextCursor !== null || (items.length > 0 && items.length === safePageSize);

  return {
    items,
    total: safeTotal,
    nextCursor,
    pageSize: safePageSize,
    hasMore,
    raw: parsed,
  } satisfies HomeworkListResult;
};

export const fetchHomeworks = async (
  params: HomeworkListParams = {},
  token?: string,
) => fetchHomeworksFromEndpoint("/api/homeworks", params, token);
