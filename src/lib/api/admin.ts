import { fetchHomeworks, type HomeworkRecord } from "./homeworks";

export type Role = "temporary" | "standard" | "admin" | "employer";
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
  ownerId?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

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
  token?: string
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

export async function fetchAdminUsers(
  params: Record<string, string | number | undefined> = {},
  token?: string
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
      : undefined
  );
}

export async function updateAdminHomework(
  id: string,
  payload: AdminHomeworkRecord,
  token: string
) {
  const res = await fetch(`/api/homeworks/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${token}`,
    },
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

export async function deleteAdminHomeworks(ids: string[], token: string) {
  await Promise.all(
    ids.map(async (id) => {
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
    })
  );
  return { deleted: ids };
}

export async function updateAdminUser(
  id: string,
  payload: Partial<UserItem>,
  token: string
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
  token: string
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
  token: string
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
  token: string
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
  token: string
) {
  return send<{ created: string[] }>(`/api/users`, {
    method: "POST",
    body: JSON.stringify({ action: "createEmployerBatch", ...input }),
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function createEmployerAccount(
  input: {
    username: string;
    display_name: string;
    email: string;
    password: string;
  },
  token: string
) {
  // Post a single employer account to the proxy. Backend may accept a single-create action.
  return send<UserItem>(`/api/users`, {
    method: "POST",
    body: JSON.stringify({ action: "createEmployer", ...input }),
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
