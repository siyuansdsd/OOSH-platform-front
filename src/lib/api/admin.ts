export type AdminUserRole = "temporary" | "standard" | "admin" | "employer";
export type AdminUserStatus = "active" | "disabled" | "banned";

export interface AdminUserRecord {
  id: string;
  username: string;
  email?: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  createdAt?: string;
  lastLoginAt?: string;
  notes?: string;
}

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
  ownerId?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

async function send<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
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
  params: Record<string, string | number | undefined> = {}
) {
  const res = await fetchHomeworks(params);
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

export async function fetchAdminUsers(params: Record<string, string | number | undefined> = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  return send<PaginatedResult<AdminUserRecord>>(
    `/api/admin/users${search.toString() ? `?${search}` : ""}`
  );
}

export async function updateAdminHomework(id: string, payload: AdminHomeworkRecord) {
  const res = await fetch(`/api/homeworks/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: payload.title,
      description: payload.description,
      school_name: payload.schoolName,
      group_name: payload.groupName,
      person_name: payload.personName,
      is_team: payload.isTeam,
      members: payload.members,
      images: payload.images,
      videos: payload.videos,
      urls: payload.urls,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as AdminHomeworkRecord;
}

export async function deleteAdminHomeworks(ids: string[]) {
  await Promise.all(
    ids.map(async (id) => {
      const res = await fetch(`/api/homeworks/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
    })
  );
  return { deleted: ids };
}

export async function updateAdminUser(id: string, payload: Partial<AdminUserRecord>) {
  return send<AdminUserRecord>(`/api/admin/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function bulkUpdateAdminUsers(payload: {
  ids: string[];
  action: "delete" | "disable" | "enable" | "ban";
}) {
  return send<{ updated: string[] }>(`/api/admin/users`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface CreateTemporaryAccountInput {
  username: string;
  password: string;
}

export async function createTemporaryAccount(input: CreateTemporaryAccountInput) {
  return send<AdminUserRecord>(`/api/admin/users`, {
    method: "POST",
    body: JSON.stringify({ action: "createTemporary", ...input }),
  });
}

export interface CreateEmployerAccountsInput {
  accounts: Array<{ email: string; password: string }>;
}

export async function createEmployerAccounts(input: CreateEmployerAccountsInput) {
  return send<{ created: string[] }>(`/api/admin/users`, {
    method: "POST",
    body: JSON.stringify({ action: "createEmployerBatch", ...input }),
  });
}
import { fetchHomeworks, type HomeworkRecord } from "./homeworks";
