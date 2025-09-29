import { fetchHomeworks, type HomeworkRecord } from "./homeworks";

export type Role = "temporary" | "standard" | "admin" | "employer" | "employee";
export type AdminUserStatus = "active" | "disabled" | "banned";

export type UserItem = {
  id: string;
  username: string;
  display_name?: string;
  email?: string;
  password_hash?: string; // bcrypt hashed
  role: Role;
  blocked?: boolean;
  token_version?: number;
  created_at: string;
  last_login?: string;
  failed_login_attempts?: number;
  last_failed_login_at?: string | null;
  refresh_token_hash?: string | null;
  refresh_token_expires_at?: string | null;
  entityType?: string;
  PK?: string;
  SK?: string;
};

export interface AdminHomeworkRecord {
  id: string;
  title?: string;
  description?: string;
  schoolName?: string;
  groupName?: string;
  personName?: string;
  isTeam?: boolean;
  members?: string[];
  images: string[];
  videos: string[];
  urls: string[];
  status?: string;
  submittedAt?: string;
  createdAt?: string;
  ownerId?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const toTrimmedString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const str = typeof value === "string" ? value : String(value);
  const trimmed = str.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toStringArray = (value: unknown): string[] => {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => toTrimmedString(entry))
      .filter((entry): entry is string => Boolean(entry));
  }
  const single = toTrimmedString(value);
  return single ? [single] : [];
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;

const normalizeHomeworkRecord = (item: any): AdminHomeworkRecord => {
  const raw = asRecord(item?.raw) ?? asRecord(item) ?? {};

  const id =
    toTrimmedString(item?.id) ||
    toTrimmedString(raw.id) ||
    toTrimmedString(raw.uuid) ||
    toTrimmedString(raw.homeworkId) ||
    "";

  const title = toTrimmedString(item?.title) ?? toTrimmedString(raw.title);
  const description =
    toTrimmedString(item?.description) ?? toTrimmedString(raw.description);
  const schoolName =
    toTrimmedString(item?.schoolName) ||
    toTrimmedString(raw.schoolName) ||
    toTrimmedString(raw.school_name) ||
    toTrimmedString(raw.school) ||
    toTrimmedString(raw.schoolname);
  const groupName =
    toTrimmedString(item?.groupName) ||
    toTrimmedString(raw.groupName) ||
    toTrimmedString(raw.group_name) ||
    toTrimmedString(raw.team_name);
  const personName =
    toTrimmedString(item?.personName) ||
    toTrimmedString(raw.personName) ||
    toTrimmedString(raw.person_name) ||
    toTrimmedString(raw.student_name);

  const membersSource = item?.members ?? raw.members;
  const members = Array.isArray(membersSource)
    ? membersSource
        .map((entry: unknown) => toTrimmedString(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];

  const images = toStringArray(item?.images ?? raw.images);
  const videos = toStringArray(item?.videos ?? raw.videos);
  const urls = toStringArray(item?.urls ?? raw.urls);

  const createdAt =
    toTrimmedString(item?.createdAt) ||
    toTrimmedString(raw.createdAt) ||
    toTrimmedString(raw.created_at);

  const submittedAt =
    toTrimmedString(item?.submittedAt) ||
    toTrimmedString(raw.submittedAt) ||
    toTrimmedString(raw.submitted_at);

  const status = toTrimmedString(item?.status) ?? toTrimmedString(raw.status);

  const isTeamValue =
    item?.isTeam ?? raw.isTeam ?? raw.is_team ?? raw.team ?? raw.group ?? false;

  return {
    id,
    title,
    description,
    schoolName,
    groupName,
    personName,
    isTeam: Boolean(isTeamValue),
    members,
    images,
    videos,
    urls,
    status,
    submittedAt,
    createdAt,
  };
};

async function send<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchAdminHomeworks(
  params: Record<string, string | number | undefined> = {},
  token?: string,
) {
  const res = await fetchHomeworks(params, token);
  const items: AdminHomeworkRecord[] = res.items.map((item: HomeworkRecord) => {
    const raw = item.raw as Record<string, any> | undefined;
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      schoolName: item.schoolName,
      groupName: item.groupName,
      personName: item.personName,
      isTeam: item.isTeam,
      members: item.members,
      images: item.images,
      videos: item.videos,
      urls: item.urls,
      status: raw?.status,
      submittedAt: raw?.submittedAt || raw?.createdAt,
      ownerId: raw?.ownerId || raw?.userId,
    };
  });
  return {
    items,
    total: res.total,
    page: res.page,
    pageSize: res.pageSize,
  } satisfies PaginatedResult<AdminHomeworkRecord>;
}

export async function fetchAllAdminHomeworks(token: string) {
  const res = await send<{ items: any[]; total: number; limit: number }>(
    `/api/homeworks/admin/all`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  // Transform the raw data to AdminHomeworkRecord format (same as fetchAdminHomeworks)
  const items: AdminHomeworkRecord[] = res.items.map(normalizeHomeworkRecord);

  return {
    items,
    total: res.total,
    limit: res.limit,
  };
}

export async function fetchAdminUsers(
  params: Record<string, string | number | undefined> = {},
  token?: string,
): Promise<PaginatedResult<UserItem> | UserItem[]> {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  return send<PaginatedResult<UserItem> | UserItem[]>(
    `/api/users${search.toString() ? `?${search}` : ""}`,
    token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : undefined,
  );
}

export async function updateAdminHomework(
  id: string,
  payload: AdminHomeworkRecord,
  token: string,
) {
  const body: Record<string, unknown> = {
    title: payload.title,
    description: payload.description,
    school_name: payload.schoolName,
    is_team: payload.isTeam,
    images: payload.images,
    videos: payload.videos,
    urls: payload.urls,
  };

  if (payload.isTeam) {
    if (payload.groupName) body.group_name = payload.groupName;
    body.members = payload.members ?? [];
    // ensure personal fields cleared on backend if necessary
    body.person_name = undefined;
  } else {
    if (payload.personName) body.person_name = payload.personName;
    body.group_name = undefined;
    body.members = [];
  }

  const res = await fetch(`/api/homeworks/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const json = await res.json().catch(() => null);
  return json ? normalizeHomeworkRecord(json) : payload;
}

export async function deleteAdminHomeworks(
  ids: string[],
  token: string,
): Promise<{
  deleted: string[];
  failures: Array<{ id: string; message: string }>;
}> {
  const deleted: string[] = [];
  const failures: Array<{ id: string; message: string }> = [];

  for (const id of ids) {
    try {
      const res = await fetch(`/api/homeworks/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      deleted.push(id);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error ?? "Unknown error");
      failures.push({ id, message });
    }
  }

  return { deleted, failures };
}

export async function updateAdminUser(
  id: string,
  payload: Partial<UserItem>,
  token: string,
) {
  return send<UserItem>(`/api/admin/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function blockAdminUser(
  id: string,
  blocked: boolean,
  token: string,
) {
  return send<UserItem>(`/api/admin/users/${id}/block`, {
    method: "POST",
    body: JSON.stringify({ block: blocked }),
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function deleteAdminUser(id: string, token: string) {
  return send<{ ok: boolean }>(`/api/admin/users/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function bulkUpdateAdminUsers(
  payload: {
    ids: string[];
    action: "delete" | "disable" | "enable" | "ban";
  },
  token: string,
) {
  return send<{ updated: string[] }>(`/api/users`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export interface CreateTemporaryAccountInput {
  username: string;
  password: string;
}

export async function createTemporaryAccount(
  input: CreateTemporaryAccountInput,
  token: string,
) {
  return send<UserItem>(`/api/users`, {
    method: "POST",
    // include role explicitly to ensure backend creates a temporary user
    body: JSON.stringify({
      action: "createTemporary",
      role: "temporary",
      ...input,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export interface CreateEmployerAccountsInput {
  accounts: Array<{
    username: string;
    display_name: string;
    email: string;
    password: string;
  }>;
}

export async function createEmployerAccounts(
  input: CreateEmployerAccountsInput,
  token: string,
) {
  return send<{ created: string[] }>(`/api/users`, {
    method: "POST",
    body: JSON.stringify({
      action: "createEmployerBatch",
      role: "employee",
      ...input,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function updateCurrentUser(
  payload: { password?: string },
  token: string,
) {
  try {
    return await send<UserItem>(`/api/users/me`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error: any) {
    // If we get a 403, it might be due to scope/permission issues
    // The backend might be expecting a different request format or scope
    console.error("updateCurrentUser failed:", error);
    throw error;
  }
}

export async function createEmployerAccount(
  input: {
    username: string;
    display_name: string;
    email: string;
    password: string;
  },
  token: string,
) {
  // Post a single employer account to the proxy. Backend may accept a single-create action.
  return send<UserItem>(`/api/users`, {
    method: "POST",
    body: JSON.stringify({
      action: "createEmployer",
      role: "employee",
      ...input,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
