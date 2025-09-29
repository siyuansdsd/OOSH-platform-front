"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAllAdminHomeworks,
  fetchAdminUsers,
  type AdminHomeworkRecord,
  type UserItem,
  type Role,
  updateAdminHomework,
  deleteAdminHomeworks,
  updateAdminUser,
  blockAdminUser,
  deleteAdminUser,
  bulkUpdateAdminUsers,
  createTemporaryAccount,
  createEmployerAccount,
} from "@/lib/api/admin";
import { APPROVED_SCHOOLS } from "@/constants/schools";
import { useAuth } from "@/components/auth/AuthProvider";

interface EmployeeDraft {
  display_name: string;
  email: string;
  password: string;
}

type ViewMode = "homeworks" | "users";

type EditingItem =
  | {
      type: "homeworks";
      original: AdminHomeworkRecord;
      draft: AdminHomeworkRecord;
    }
  | { type: "users"; original: UserItem; draft: UserItem };

const linkClass = "font-semibold italic underline";

export function AdminManagementClient() {
  const { accessToken, user } = useAuth();
  const isEmployee = (user?.role || "").toLowerCase() === "employee";
  const [view, setView] = useState<ViewMode>("homeworks");
  const [homeworksCache, setHomeworksCache] = useState<AdminHomeworkRecord[]>(
    [],
  );
  const [homeworksCacheLoaded, setHomeworksCacheLoaded] = useState(false);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<EditingItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // Client-side pagination and sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] =
    useState<keyof AdminHomeworkRecord>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [tempAccount, setTempAccount] = useState({
    username: "",
    password: "",
  });
  const [creatingTemp, setCreatingTemp] = useState(false);

  interface EmployeeDraftInternal extends EmployeeDraft {
    username?: string;
  }
  const [employerDrafts, setEmployerDrafts] = useState<EmployeeDraftInternal[]>(
    [{ display_name: "", email: "", password: "", username: "" }],
  );
  const [creatingEmployers, setCreatingEmployers] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState<string | null>(
    null,
  );

  const schoolOptions = useMemo(
    () => [...APPROVED_SCHOOLS].sort((a, b) => a.localeCompare(b)),
    [],
  );

  useEffect(() => {
    // Redirect employee users away from users view
    if (isEmployee && view === "users") {
      setView("homeworks");
      return;
    }

    if (!accessToken) return;
    // For homeworks: load from cache if available, otherwise fetch all
    if (view === "homeworks" && !homeworksCacheLoaded) {
      void loadData(view);
      return;
    }
    // For users: only auto-load when we don't already have data
    if (view === "users" && users.length === 0) {
      void loadData(view);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, view, isEmployee]);

  // track which user rows are expanded to show full record details
  const [expandedUserIds, setExpandedUserIds] = useState<string[]>([]);
  const [editingPassword, setEditingPassword] = useState<string>("");
  const [blockingIds, setBlockingIds] = useState<string[]>([]);

  const toggleUserExpanded = (id: string) => {
    setExpandedUserIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  async function loadData(mode: ViewMode) {
    setLoading(true);
    setError(null);
    try {
      if (!accessToken) throw new Error("Not authenticated");
      if (mode === "homeworks") {
        // Use new API to fetch all homework items
        const res = await fetchAllAdminHomeworks(accessToken);
        setHomeworksCache(res.items);
        setHomeworksCacheLoaded(true);
        setCurrentPage(1); // Reset to first page when loading new data
      } else {
        const res = await fetchAdminUsers({}, accessToken);
        const list = Array.isArray(res)
          ? res
          : Array.isArray(res.items)
            ? res.items
            : [];
        setUsers(list as UserItem[]);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load data");
    } finally {
      setLoading(false);
      setSelectedIds([]);
    }
  }

  // Function to refresh homework cache
  async function refreshHomeworkCache() {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAllAdminHomeworks(accessToken);
      setHomeworksCache(res.items);
      setHomeworksCacheLoaded(true);
    } catch (err: any) {
      setError(err?.message || "Failed to refresh homework data");
    } finally {
      setLoading(false);
    }
  }

  async function refreshSpecificUsers(userType: "temporary" | "employee") {
    try {
      if (!accessToken) throw new Error("Not authenticated");
      const res = await fetchAdminUsers({}, accessToken);
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res.items)
          ? res.items
          : [];

      // Only update users of the specific type
      const newUsers = list as UserItem[];
      setUsers((prevUsers) => {
        // Keep existing users that are not of the target type
        const keepUsers = prevUsers.filter((user) => {
          if (userType === "temporary") {
            return (user.role || "").toLowerCase() !== "temporary";
          } else if (userType === "employee") {
            const r = (user.role || "").toLowerCase();
            return r !== "employee";
          }
          return true;
        });

        // Add the refreshed users of the target type
        const refreshedUsers = newUsers.filter((user) => {
          if (userType === "temporary") {
            return (user.role || "").toLowerCase() === "temporary";
          } else if (userType === "employee") {
            const r = (user.role || "").toLowerCase();
            return r === "employee";
          }
          return false;
        });

        return [...keepUsers, ...refreshedUsers];
      });
    } catch (err: any) {
      setError(err?.message || "Failed to refresh data");
    }
  }

  // Client-side filtering, sorting, and pagination
  const processedHomeworkRecords = useMemo(() => {
    if (view !== "homeworks") return [];

    let records = [...homeworksCache];

    // Apply search filter
    const term = search.trim().toLowerCase();
    if (term) {
      records = records.filter((item) => {
        const haystack = [
          item.title,
          item.description,
          item.schoolName,
          item.groupName,
          item.personName,
          ...(item.members || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      });
    }

    // Apply sorting
    records.sort((a, b) => {
      const aVal = a[sortField] || "";
      const bVal = b[sortField] || "";

      const comparison = String(aVal).localeCompare(String(bVal));
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return records;
  }, [homeworksCache, search, sortField, sortDirection, view]);

  const activeRecords =
    view === "homeworks"
      ? processedHomeworkRecords
      : users.filter((user) => {
          const role = (user.role || "").toLowerCase();
          return role === "standard" || role === "user";
        });

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (view === "homeworks") {
      return processedHomeworkRecords;
    }

    if (!term) return activeRecords;
    return (activeRecords as UserItem[]).filter((item) => {
      const haystack = [
        item.username,
        item.display_name,
        item.email,
        String(item.role),
        String(item.blocked),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [activeRecords, search, view, processedHomeworkRecords]);

  // Client-side pagination
  const paginatedRecords = useMemo(() => {
    if (view !== "homeworks") return filteredRecords;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredRecords.slice(startIndex, endIndex);
  }, [filteredRecords, currentPage, pageSize, view]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    const displayed = (
      view === "homeworks" ? paginatedRecords : filteredRecords
    ).map((item) => item.id);
    const displayedSelected = selectedIds.filter((id) =>
      displayed.includes(id),
    );
    if (displayedSelected.length === displayed.length) {
      setSelectedIds((prev) => prev.filter((id) => !displayed.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...displayed])));
    }
  };

  const openHomeworkEditor = (record: AdminHomeworkRecord) => {
    setEditing({
      type: "homeworks",
      original: record,
      draft: { ...record, members: [...(record.members || [])] },
    });
  };

  const openUserEditor = (record: UserItem) => {
    setEditing({
      type: "users",
      original: record,
      draft: { ...record },
    });
    setEditingPassword("");
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setSaving(true);

    // Store original values for rollback
    const originalHomeworksCache = [...homeworksCache];
    const originalUsers = [...users];

    try {
      if (!accessToken) throw new Error("Not authenticated");

      if (editing.type === "homeworks") {
        // Optimistic update: immediately update cache
        const updatedCache = homeworksCache.map((item) =>
          item.id === editing.draft.id ? editing.draft : item,
        );
        setHomeworksCache(updatedCache);

        // Call backend
        const updatedRecord = await updateAdminHomework(
          editing.draft.id,
          editing.draft,
          accessToken,
        );

        // Reconcile with backend response
        const reconciledCache = homeworksCache.map((item) =>
          item.id === editing.draft.id ? updatedRecord : item,
        );
        setHomeworksCache(reconciledCache);
      } else {
        const draft = editing.draft as UserItem;

        // Build payload according to role and provided password
        const payload: Record<string, any> = {};
        if (draft.role === "temporary") {
          payload.username = draft.username;
          if (editingPassword) payload.password = editingPassword;
        } else {
          payload.username = draft.username;
          payload.display_name = draft.display_name;
          payload.email = draft.email;
          payload.blocked = draft.blocked;
          if (editingPassword) payload.password = editingPassword;
        }

        // Optimistic update for users
        const updatedUsers = users.map((user) =>
          user.id === draft.id ? { ...user, ...payload } : user,
        );
        setUsers(updatedUsers);

        // Call backend
        const updatedUser = await updateAdminUser(
          draft.id,
          payload,
          accessToken,
        );

        // Reconcile with backend response
        const reconciledUsers = users.map((user) =>
          user.id === draft.id ? updatedUser : user,
        );
        setUsers(reconciledUsers);
      }
      setEditing(null);
    } catch (err: any) {
      // Rollback optimistic updates on error
      if (editing.type === "homeworks") {
        setHomeworksCache(originalHomeworksCache);
      } else {
        setUsers(originalUsers);
      }
      setError(err?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkAction = async (
    action: "delete" | "disable" | "ban" | "enable",
  ) => {
    setBulkActionLoading(action);

    // Store original values for rollback
    const originalHomeworksCache = [...homeworksCache];
    const originalUsers = [...users];

    try {
      if (!accessToken) throw new Error("Not authenticated");

      if (view === "homeworks") {
        if (action === "delete") {
          const idsToDelete = [...selectedIds];
          if (idsToDelete.length === 0) {
            setError(null);
            setSelectedIds([]);
            return;
          }

          const lookup = new Map(
            homeworksCache.map((record) => [record.id, record] as const),
          );
          const { deleted, failures } = await deleteAdminHomeworks(
            idsToDelete,
            accessToken,
          );

          if (deleted.length > 0) {
            setHomeworksCache((prev) =>
              prev.filter((item) => !deleted.includes(item.id)),
            );
          }

          if (failures.length > 0) {
            const failureIds = failures.map((failure) => failure.id);
            setSelectedIds(failureIds);
            const messages = failures.map((failure) => {
              const title = lookup.get(failure.id)?.title?.trim() || "Untitled";
              return `${title}: delete failed (${failure.message})`;
            });
            setError(messages.join(" | "));
          } else {
            setSelectedIds([]);
            setError(null);
          }

          return;
        }
      } else {
        // For users - optimistic updates
        if (action === "disable" || action === "enable") {
          const block = action === "disable";

          // Optimistic update: update blocked status
          const updatedUsers = users.map((user) =>
            selectedIds.includes(user.id) ? { ...user, blocked: block } : user,
          );
          setUsers(updatedUsers);

          // Call backend
          await Promise.all(
            selectedIds.map((id) => blockAdminUser(id, block, accessToken)),
          );
        } else if (action === "ban" || action === "delete") {
          // Optimistic update: remove users
          const updatedUsers = users.filter(
            (user) => !selectedIds.includes(user.id),
          );
          setUsers(updatedUsers);

          // Call backend
          await Promise.all(
            selectedIds.map((id) => deleteAdminUser(id, accessToken)),
          );
        } else {
          // Fallback to bulk API if action supported
          await bulkUpdateAdminUsers({ ids: selectedIds, action }, accessToken);
          // Reload data since we don't know the exact changes
          await loadData("users");
        }
      }

      setSelectedIds([]);
    } catch (err: any) {
      // Rollback optimistic updates on error
      if (view === "homeworks") {
        setHomeworksCache(originalHomeworksCache);
      } else {
        setUsers(originalUsers);
      }
      setError(err?.message || "Action failed");
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleCreateTemporary = async () => {
    if (!tempAccount.username || !tempAccount.password) return;
    setCreatingTemp(true);
    try {
      if (!accessToken) throw new Error("Not authenticated");
      await createTemporaryAccount(tempAccount, accessToken);
      await loadData("users");
      setTempAccount({ username: "", password: "" });
    } catch (err: any) {
      setError(err?.message || "Create failed");
    } finally {
      setCreatingTemp(false);
    }
  };

  const handleCreateEmployers = async () => {
    const accounts = employerDrafts
      .map((draft) => ({
        username: (draft.username || draft.email || "").trim(), // prefer explicit username, fallback to email
        display_name: draft.display_name.trim(),
        email: draft.email.trim(),
        password: draft.password,
      }))
      .filter((draft) => draft.display_name && draft.email && draft.password);
    if (accounts.length === 0) {
      setError(
        "Please provide at least one row with display name, email and password.",
      );
      return;
    }

    // Extra validation: each account must have username and password
    const invalid = accounts.filter((a) => !(a.username && a.password));
    if (invalid.length > 0) {
      console.warn(
        "Invalid employer accounts (missing username/password):",
        invalid,
      );
      setError(
        "One or more accounts are missing username or password. Email will be used as username if provided.",
      );
      return;
    }
    setCreatingEmployers(true);
    try {
      if (!accessToken) throw new Error("Not authenticated");

      // Send accounts one-by-one to backend to surface per-account errors
      for (const acct of accounts) {
        try {
          await createEmployerAccount(acct, accessToken);
        } catch (err: any) {
          const msg = err?.message || "Create failed for an account";
          setError(`Failed to create ${acct.email || acct.username}: ${msg}`);
          throw err;
        }
      }

      await loadData("users");
      setEmployerDrafts([
        { display_name: "", email: "", password: "", username: "" },
      ]);
    } catch (err: any) {
      if (!error) setError(err?.message || "Batch create failed");
    } finally {
      setCreatingEmployers(false);
    }
  };

  const displayedSelected = selectedIds.filter((id) =>
    filteredRecords.some((record) => record.id === id),
  );

  const temporaryUsers = useMemo(
    () =>
      users.filter((user) => (user.role || "").toLowerCase() === "temporary"),
    [users],
  );

  const employerUsers = useMemo(
    () =>
      users.filter((user) => {
        const r = (user.role || "").toLowerCase();
        return r === "employee";
      }),
    [users],
  );

  const renderHomeworkRow = (record: AdminHomeworkRecord) => (
    <tr
      key={record.id}
      className="border-b border-foreground/10 hover:bg-foreground/5"
    >
      <td className="whitespace-nowrap px-3 py-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selectedIds.includes(record.id)}
            onChange={() => toggleSelection(record.id)}
            className="size-4"
          />
          <button
            type="button"
            onClick={() => openHomeworkEditor(record)}
            className="rounded-lg border border-foreground/20 px-2 py-1 text-xs"
          >
            Edit
          </button>
        </div>
      </td>
      <td className="px-3 py-3 text-sm font-medium text-foreground">
        {record.title || "Untitled"}
      </td>
      <td className="px-3 py-3 text-sm text-foreground/70">
        {record.schoolName || "—"}
      </td>
      <td className="px-3 py-3 text-sm text-foreground/70">
        {record.isTeam ? record.groupName || "—" : "—"}
      </td>
      <td className="px-3 py-3 text-sm text-foreground/70">
        {record.isTeam ? "—" : record.personName || "—"}
      </td>
      <td className="px-3 py-3 text-sm text-foreground/70">
        {record.members && record.members.length > 0
          ? record.members.join(", ")
          : "—"}
      </td>
      <td className="px-3 py-3 text-sm">
        <div className="flex max-w-xs flex-col gap-1">
          {record.videos.map((video, index) => (
            <a
              key={video}
              href={video}
              className={linkClass}
              target="_blank"
              rel="noreferrer"
            >
              [video {index + 1}]
            </a>
          ))}
          {record.videos.length === 0 ? "—" : null}
        </div>
      </td>
      <td className="px-3 py-3 text-sm">
        <div className="flex max-w-xs flex-col gap-1">
          {record.images.map((image, index) => (
            <a
              key={image}
              href={image}
              className={linkClass}
              target="_blank"
              rel="noreferrer"
            >
              [image {index + 1}]
            </a>
          ))}
          {record.images.length === 0 ? "—" : null}
        </div>
      </td>
      <td className="px-3 py-3 text-sm">
        <div className="flex max-w-xs flex-col gap-1">
          {record.urls.map((url, index) => (
            <a
              key={url}
              href={url}
              className={linkClass}
              target="_blank"
              rel="noreferrer"
            >
              [link {index + 1}]
            </a>
          ))}
          {record.urls.length === 0 ? "—" : null}
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-sm text-foreground/70">
        {record.createdAt || "—"}
      </td>
    </tr>
  );

  const renderUserRow = (record: UserItem) => (
    <tr
      key={record.id}
      className="border-b border-foreground/10 hover:bg-foreground/5"
    >
      <td className="whitespace-nowrap px-3 py-3">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selectedIds.includes(record.id)}
            onChange={() => toggleSelection(record.id)}
            className="size-4"
          />
          <button
            type="button"
            onClick={() => openUserEditor(record)}
            className="rounded-lg border border-foreground/20 px-2 py-1 text-xs"
          >
            Edit
          </button>
        </div>
      </td>
      <td className="px-3 py-3 text-sm font-medium text-foreground">
        {record.username}
      </td>
      <td className="px-3 py-3 text-sm text-foreground/70">
        {record.display_name || "—"}
      </td>
      <td className="px-3 py-3 text-sm text-foreground/70">
        {record.email ? (
          <a href={`mailto:${record.email}`} className={linkClass}>
            {record.email}
          </a>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-3 text-sm text-foreground">
        {String(record.role).charAt(0).toUpperCase() +
          String(record.role).slice(1)}
      </td>
      <td className="px-3 py-3 text-sm capitalize text-foreground/70">
        {record.blocked ? "Blocked" : "Active"}
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-xs text-foreground/50">
        {record.created_at || "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-xs text-foreground/50">
        {record.last_login || "—"}
      </td>
      <td className="px-3 py-3 text-sm text-foreground/70">
        {record.failed_login_attempts || "0"}
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-xs text-foreground/50">
        {record.last_failed_login_at || "—"}
      </td>
      <td className="px-3 py-3 text-sm text-foreground/70">
        <button
          type="button"
          onClick={() => toggleUserExpanded(record.id)}
          className="rounded-lg border border-foreground/15 px-2 py-1 text-xs"
        >
          {expandedUserIds.includes(record.id) ? "Hide" : "Details"}
        </button>
      </td>
    </tr>
  );

  const editingHomework = editing?.type === "homeworks" ? editing.draft : null;
  const editingUser = editing?.type === "users" ? editing.draft : null;

  if (!accessToken) {
    return (
      <div className="rounded-3xl border border-foreground/10 bg-white/5 p-6 text-sm text-foreground/60">
        Checking authentication…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setView("homeworks")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                view === "homeworks"
                  ? "bg-foreground text-background"
                  : "bg-foreground/10 text-foreground hover:bg-foreground/20"
              }`}
            >
              Homeworks
            </button>
            {!isEmployee && (
              <button
                type="button"
                onClick={() => setView("users")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  view === "users"
                    ? "bg-foreground text-background"
                    : "bg-foreground/10 text-foreground hover:bg-foreground/20"
                }`}
              >
                Users
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by keyword"
            className="rounded-lg border border-foreground/20 bg-background/70 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() =>
              view === "homeworks"
                ? void refreshHomeworkCache()
                : void loadData(view)
            }
            className="rounded-lg border border-foreground/20 px-4 py-2 text-sm hover:bg-foreground/10"
          >
            Refresh
          </button>
          {view === "homeworks" && (
            <>
              <select
                value={sortField}
                onChange={(e) =>
                  setSortField(e.target.value as keyof AdminHomeworkRecord)
                }
                className="rounded-lg border border-foreground/20 bg-background/70 px-3 py-2 text-sm"
              >
                <option value="createdAt">Sort by Created</option>
                <option value="title">Sort by Title</option>
                <option value="groupName">Sort by Team Name</option>
                <option value="schoolName">Sort by School</option>
                <option value="personName">Sort by Owner</option>
              </select>
              <button
                type="button"
                onClick={() =>
                  setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                }
                className="rounded-lg border border-foreground/20 px-3 py-2 text-sm hover:bg-foreground/10"
              >
                {sortDirection === "asc" ? "↑" : "↓"}
              </button>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-foreground/20 bg-background/70 px-3 py-2 text-sm"
              >
                <option value="10">10 per page</option>
                <option value="20">20 per page</option>
                <option value="50">50 per page</option>
                <option value="100">100 per page</option>
              </select>
            </>
          )}
          {view === "homeworks" ? (
            <button
              type="button"
              disabled={
                displayedSelected.length === 0 || bulkActionLoading !== null
              }
              onClick={() => void handleBulkAction("delete")}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 flex items-center gap-2"
            >
              {bulkActionLoading === "delete" && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {bulkActionLoading === "delete"
                ? "Deleting..."
                : "Delete selected"}
            </button>
          ) : !isEmployee ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={
                  displayedSelected.length === 0 || bulkActionLoading !== null
                }
                onClick={() => void handleBulkAction("disable")}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 flex items-center gap-2"
              >
                {bulkActionLoading === "disable" && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {bulkActionLoading === "disable"
                  ? "Blocking..."
                  : "Block selected accounts"}
              </button>
              <button
                type="button"
                disabled={
                  displayedSelected.length === 0 || bulkActionLoading !== null
                }
                onClick={() => void handleBulkAction("ban")}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 flex items-center gap-2"
              >
                {bulkActionLoading === "ban" && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {bulkActionLoading === "ban"
                  ? "Deleting..."
                  : "Forever delete selected"}
              </button>
              <button
                type="button"
                disabled={
                  displayedSelected.length === 0 || bulkActionLoading !== null
                }
                onClick={() => void handleBulkAction("enable")}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 flex items-center gap-2"
              >
                {bulkActionLoading === "enable" && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {bulkActionLoading === "enable"
                  ? "Activating..."
                  : "Unblock selected accounts"}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-3xl border border-foreground/10 bg-white/5">
        <table className="min-w-[1200px] w-full text-left text-sm">
          <thead className="bg-foreground/5 text-xs font-semibold uppercase tracking-wide text-foreground/80">
            {view === "homeworks" ? (
              <tr>
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    onChange={toggleSelectAll}
                    checked={
                      (view === "homeworks"
                        ? paginatedRecords
                        : filteredRecords
                      ).length > 0 &&
                      selectedIds.filter((id) =>
                        (view === "homeworks"
                          ? paginatedRecords
                          : filteredRecords
                        ).some((record) => record.id === id),
                      ).length ===
                        (view === "homeworks"
                          ? paginatedRecords
                          : filteredRecords
                        ).length
                    }
                    className="size-4"
                  />
                </th>
                <th className="px-3 py-3">Title</th>
                <th className="px-3 py-3">School</th>
                <th className="px-3 py-3">Team Name</th>
                <th className="px-3 py-3">Owner</th>
                <th className="px-3 py-3">Members</th>
                <th className="px-3 py-3">Videos</th>
                <th className="px-3 py-3">Images</th>
                <th className="px-3 py-3">Websites</th>
                <th className="px-3 py-3">Created</th>
              </tr>
            ) : (
              <tr>
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    onChange={toggleSelectAll}
                    checked={
                      filteredRecords.length > 0 &&
                      selectedIds.filter((id) =>
                        filteredRecords.some((record) => record.id === id),
                      ).length === filteredRecords.length
                    }
                    className="size-4"
                  />
                </th>
                <th className="px-3 py-3">Username</th>
                <th className="px-3 py-3">Display Name</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Created</th>
                <th className="px-3 py-3">Last Login</th>
                <th className="px-3 py-3">Failed Attempts</th>
                <th className="px-3 py-3">Last Failed Login</th>
                <th className="px-3 py-3">Details</th>
              </tr>
            )}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={view === "homeworks" ? 10 : 11}
                  className="px-3 py-6 text-center text-foreground/60"
                >
                  Loading…
                </td>
              </tr>
            ) : (view === "homeworks" ? paginatedRecords : filteredRecords)
                .length === 0 ? (
              <tr>
                <td
                  colSpan={view === "homeworks" ? 10 : 11}
                  className="px-3 py-6 text-center text-foreground/60"
                >
                  No records found.
                </td>
              </tr>
            ) : view === "homeworks" ? (
              (paginatedRecords as AdminHomeworkRecord[]).map(renderHomeworkRow)
            ) : (
              // For users, render the main row and optionally a details row
              (filteredRecords as UserItem[]).flatMap((record) => {
                const main = renderUserRow(record);
                if (!expandedUserIds.includes(record.id)) return [main];
                const detailsRow = (
                  <tr key={`${record.id}-details`} className="bg-background/5">
                    <td
                      colSpan={10}
                      className="px-3 py-3 text-sm text-foreground/70"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl">
                        <div className="space-y-2">
                          <h4 className="font-semibold text-foreground text-sm">
                            Account Info
                          </h4>
                          <div className="space-y-1 text-xs">
                            <div>
                              <span className="font-medium">Username:</span>{" "}
                              {record.username}
                            </div>
                            <div>
                              <span className="font-medium">Display Name:</span>{" "}
                              {record.display_name || "—"}
                            </div>
                            <div>
                              <span className="font-medium">Email:</span>{" "}
                              {record.email || "—"}
                            </div>
                            <div>
                              <span className="font-medium">Role:</span>{" "}
                              <span className="capitalize">{record.role}</span>
                            </div>
                            <div>
                              <span className="font-medium">Entity Type:</span>{" "}
                              {record.entityType || "—"}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-semibold text-foreground text-sm">
                            Security
                          </h4>
                          <div className="space-y-1 text-xs">
                            <div>
                              <span className="font-medium">Status:</span>
                              <span
                                className={`ml-1 px-2 py-1 rounded text-xs ${
                                  record.blocked
                                    ? "bg-red-100 text-red-800"
                                    : "bg-green-100 text-green-800"
                                }`}
                              >
                                {record.blocked ? "Blocked" : "Active"}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium">
                                Failed Login Attempts:
                              </span>{" "}
                              {record.failed_login_attempts || "0"}
                            </div>
                            <div>
                              <span className="font-medium">
                                Last Failed Login:
                              </span>{" "}
                              {record.last_failed_login_at || "—"}
                            </div>
                            <div>
                              <span className="font-medium">
                                Token Version:
                              </span>{" "}
                              {record.token_version || "—"}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-semibold text-foreground text-sm">
                            Timestamps
                          </h4>
                          <div className="space-y-1 text-xs">
                            <div>
                              <span className="font-medium">Created:</span>{" "}
                              {record.created_at
                                ? new Date(record.created_at).toLocaleString()
                                : "—"}
                            </div>
                            <div>
                              <span className="font-medium">Last Login:</span>{" "}
                              {record.last_login
                                ? new Date(record.last_login).toLocaleString()
                                : "—"}
                            </div>
                            <div>
                              <span className="font-medium">
                                Refresh Token Expires:
                              </span>{" "}
                              {record.refresh_token_expires_at
                                ? new Date(
                                    record.refresh_token_expires_at,
                                  ).toLocaleString()
                                : "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
                return [main, detailsRow];
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls for homeworks */}
      {view === "homeworks" && filteredRecords.length > pageSize && (
        <div className="flex items-center justify-between rounded-xl border border-foreground/10 bg-white/5 px-4 py-3">
          <div className="text-sm text-foreground/70">
            Showing {(currentPage - 1) * pageSize + 1} to{" "}
            {Math.min(currentPage * pageSize, filteredRecords.length)} of{" "}
            {filteredRecords.length} results
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={!hasPrevPage}
              className="rounded-lg border border-foreground/20 px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              First
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={!hasPrevPage}
              className="rounded-lg border border-foreground/20 px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>
            <span className="px-3 py-1 text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={!hasNextPage}
              className="rounded-lg border border-foreground/20 px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={!hasNextPage}
              className="rounded-lg border border-foreground/20 px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Last
            </button>
          </div>
        </div>
      )}

      {view === "users" && !isEmployee && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-foreground/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Temporary accounts
            </h2>
            <p className="mt-1 text-sm text-foreground/60">
              Quickly generate temporary login credentials.
            </p>
            <div className="mt-4 grid gap-3">
              <label className="text-sm text-foreground/80">
                Username
                <input
                  value={tempAccount.username}
                  onChange={(e) =>
                    setTempAccount((prev) => ({
                      ...prev,
                      username: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                />
              </label>
              <label className="text-sm text-foreground/80">
                Password
                <input
                  value={tempAccount.password}
                  onChange={(e) =>
                    setTempAccount((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                  type="password"
                />
              </label>
              <button
                type="button"
                onClick={handleCreateTemporary}
                disabled={creatingTemp}
                className="mt-2 inline-flex w-fit items-center justify-center rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingTemp ? "Creating…" : "Create temporary account"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-foreground/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Employee invitations
            </h2>
            <p className="mt-1 text-sm text-foreground/60">
              Add employee accounts in bulk by display name, email and password.
            </p>
            <div className="mt-4 space-y-3">
              {employerDrafts.map((draft, index) => (
                <div key={index} className="grid gap-3 sm:grid-cols-3">
                  <label className="text-sm text-foreground/80">
                    Display Name
                    <input
                      value={draft.display_name}
                      onChange={(e) => {
                        const next = [...employerDrafts];
                        next[index] = {
                          ...next[index],
                          display_name: e.target.value,
                        };
                        setEmployerDrafts(next);
                      }}
                      className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                    />
                  </label>
                  <label className="text-sm text-foreground/80">
                    Email
                    <input
                      value={draft.email}
                      onChange={(e) => {
                        const next = [...employerDrafts];
                        const emailVal = e.target.value;
                        next[index] = {
                          ...next[index],
                          email: emailVal,
                          username: emailVal,
                        };
                        setEmployerDrafts(next);
                      }}
                      className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                      type="email"
                    />
                    <div className="mt-1 text-xs text-foreground/60">
                      Email will be used as the username
                    </div>
                  </label>
                  <label className="text-sm text-foreground/80">
                    Password
                    <input
                      value={draft.password}
                      onChange={(e) => {
                        const next = [...employerDrafts];
                        next[index] = {
                          ...next[index],
                          password: e.target.value,
                        };
                        setEmployerDrafts(next);
                      }}
                      className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                      type="password"
                    />
                  </label>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setEmployerDrafts((prev) => [
                      ...prev,
                      { display_name: "", email: "", password: "" },
                    ])
                  }
                  className="rounded-lg border border-foreground/20 px-3 py-1 text-xs font-medium"
                >
                  + Add row
                </button>
                {employerDrafts.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setEmployerDrafts((prev) =>
                        prev.slice(0, Math.max(1, prev.length - 1)),
                      )
                    }
                    className="rounded-lg border border-foreground/20 px-3 py-1 text-xs font-medium"
                  >
                    Remove last
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={handleCreateEmployers}
                disabled={
                  creatingEmployers ||
                  !employerDrafts.some(
                    (d) =>
                      d.display_name.trim() && d.email.trim() && d.password,
                  )
                }
                className="inline-flex w-fit items-center justify-center rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingEmployers ? "Processing…" : "Create employee accounts"}
              </button>
            </div>
          </div>
        </section>
      )}

      {!isEmployee && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-foreground/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Temporary accounts
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void refreshSpecificUsers("temporary")}
                  className="rounded-lg border border-foreground/20 px-3 py-1 text-xs hover:bg-foreground/10"
                >
                  Refresh
                </button>
              </div>
            </div>
            {temporaryUsers.length === 0 ? (
              <p className="mt-2 text-sm text-foreground/60">
                No temporary accounts created yet.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs font-semibold text-foreground/80">
                    <tr>
                      <th className="px-3 py-2">Username</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Created At</th>
                      <th className="px-3 py-2">State</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {temporaryUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="border-t border-foreground/10"
                      >
                        <td className="px-3 py-2">{user.username}</td>
                        <td className="px-3 py-2">
                          {String(user.role).charAt(0).toUpperCase() +
                            String(user.role).slice(1)}
                        </td>
                        <td className="px-3 py-2">
                          {user.created_at
                            ? new Date(user.created_at).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {user.blocked ? "Blocked" : "Active"}
                        </td>
                        <td className="px-3 py-2 flex items-center gap-2">
                          <button
                            type="button"
                            disabled={blockingIds.includes(user.id)}
                            onClick={async () => {
                              try {
                                if (!accessToken)
                                  throw new Error("Not authenticated");
                                setBlockingIds((prev) => [...prev, user.id]);
                                // toggle block state
                                await blockAdminUser(
                                  user.id,
                                  !user.blocked,
                                  accessToken,
                                );
                                await refreshSpecificUsers("temporary");
                              } catch (err: any) {
                                setError(
                                  err?.message || "Block/Unblock failed",
                                );
                              } finally {
                                setBlockingIds((prev) =>
                                  prev.filter((id) => id !== user.id),
                                );
                              }
                            }}
                            className="rounded-lg border border-foreground/20 px-2 py-1 text-xs"
                          >
                            {blockingIds.includes(user.id)
                              ? "Processing..."
                              : user.blocked
                                ? "Unblock"
                                : "Block"}
                          </button>
                          <button
                            type="button"
                            disabled={blockingIds.includes(user.id)}
                            onClick={async () => {
                              if (
                                !window.confirm(
                                  "Are you sure you want to delete this temporary account?",
                                )
                              )
                                return;
                              try {
                                if (!accessToken)
                                  throw new Error("Not authenticated");
                                setBlockingIds((prev) => [...prev, user.id]);
                                await deleteAdminUser(user.id, accessToken);
                                await refreshSpecificUsers("temporary");
                              } catch (err: any) {
                                setError(err?.message || "Delete failed");
                              } finally {
                                setBlockingIds((prev) =>
                                  prev.filter((id) => id !== user.id),
                                );
                              }
                            }}
                            className="rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs text-red-600 hover:bg-red-500/20"
                          >
                            {blockingIds.includes(user.id)
                              ? "Processing..."
                              : "Delete"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-foreground/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Employee accounts
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void refreshSpecificUsers("employee")}
                  className="rounded-lg border border-foreground/20 px-3 py-1 text-xs hover:bg-foreground/10"
                >
                  Refresh
                </button>
              </div>
            </div>
            {employerUsers.length === 0 ? (
              <p className="mt-2 text-sm text-foreground/60">
                No employee accounts found.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs font-semibold text-foreground/80">
                    <tr>
                      <th className="px-3 py-2">Username</th>
                      <th className="px-3 py-2">Display name</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employerUsers.map((user) => (
                      <tr
                        key={user.id}
                        className="border-t border-foreground/10"
                      >
                        <td className="px-3 py-2">{user.username}</td>
                        <td className="px-3 py-2">
                          {user.display_name || "—"}
                        </td>
                        <td className="px-3 py-2">{user.email || "—"}</td>
                        <td className="px-3 py-2">
                          {user.blocked ? "Blocked" : "Active"}
                        </td>
                        <td className="px-3 py-2 flex items-center gap-2">
                          <button
                            type="button"
                            disabled={blockingIds.includes(user.id)}
                            onClick={async () => {
                              try {
                                if (!accessToken)
                                  throw new Error("Not authenticated");
                                setBlockingIds((prev) => [...prev, user.id]);
                                await blockAdminUser(
                                  user.id,
                                  !user.blocked,
                                  accessToken,
                                );
                                await refreshSpecificUsers("employee");
                              } catch (err: any) {
                                setError(
                                  err?.message || "Block/Unblock failed",
                                );
                              } finally {
                                setBlockingIds((prev) =>
                                  prev.filter((id) => id !== user.id),
                                );
                              }
                            }}
                            className="rounded-lg border border-foreground/20 px-2 py-1 text-xs"
                          >
                            {blockingIds.includes(user.id)
                              ? "Processing..."
                              : user.blocked
                                ? "Unblock"
                                : "Block"}
                          </button>
                          <button
                            type="button"
                            disabled={blockingIds.includes(user.id)}
                            onClick={async () => {
                              if (
                                !window.confirm(
                                  "Are you sure you want to delete this employee account?",
                                )
                              )
                                return;
                              try {
                                if (!accessToken)
                                  throw new Error("Not authenticated");
                                setBlockingIds((prev) => [...prev, user.id]);
                                await deleteAdminUser(user.id, accessToken);
                                await refreshSpecificUsers("employee");
                              } catch (err: any) {
                                setError(err?.message || "Delete failed");
                              } finally {
                                setBlockingIds((prev) =>
                                  prev.filter((id) => id !== user.id),
                                );
                              }
                            }}
                            className="rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs text-red-600 hover:bg-red-500/20"
                          >
                            {blockingIds.includes(user.id)
                              ? "Processing..."
                              : "Delete"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-background p-6 text-foreground shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Edit {editing.type === "homeworks" ? "Homework" : "User"}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-full bg-foreground/10 px-3 py-1 text-sm"
              >
                Close
              </button>
            </div>
            {editingHomework ? (
              <div className="mt-4 space-y-4">
                <label className="text-sm text-foreground/80">
                  Title
                  <input
                    value={editingHomework.title || ""}
                    onChange={(e) =>
                      setEditing((prev) =>
                        prev && prev.type === "homeworks"
                          ? {
                              type: "homeworks",
                              original: prev.original,
                              draft: { ...prev.draft, title: e.target.value },
                            }
                          : prev,
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                  />
                </label>
                <label className="text-sm text-foreground/80">
                  Description
                  <textarea
                    value={editingHomework.description || ""}
                    onChange={(e) =>
                      setEditing((prev) =>
                        prev && prev.type === "homeworks"
                          ? {
                              type: "homeworks",
                              original: prev.original,
                              draft: {
                                ...prev.draft,
                                description: e.target.value,
                              },
                            }
                          : prev,
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                    rows={4}
                  />
                </label>
                <label className="text-sm text-foreground/80">
                  School
                  <select
                    value={editingHomework.schoolName || ""}
                    onChange={(e) =>
                      setEditing((prev) =>
                        prev && prev.type === "homeworks"
                          ? {
                              type: "homeworks",
                              original: prev.original,
                              draft: {
                                ...prev.draft,
                                schoolName: e.target.value,
                              },
                            }
                          : prev,
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                  >
                    <option value="">Select a school</option>
                    {schoolOptions.map((school) => (
                      <option key={school} value={school}>
                        {school}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(editingHomework.isTeam)}
                      onChange={(e) =>
                        setEditing((prev) => {
                          if (!prev || prev.type !== "homeworks") return prev;
                          const checked = e.target.checked;
                          return {
                            type: "homeworks",
                            original: prev.original,
                            draft: {
                              ...prev.draft,
                              isTeam: checked,
                              members: checked
                                ? prev.draft.members &&
                                  prev.draft.members.length > 0
                                  ? prev.draft.members
                                  : []
                                : [],
                              personName: checked
                                ? ""
                                : prev.draft.personName || "",
                            },
                          };
                        })
                      }
                      className="size-4 rounded border-foreground/30 accent-blue-600"
                    />
                    <span className="text-sm">Team submission</span>
                  </label>
                </div>

                {editingHomework.isTeam ? (
                  <>
                    <label className="text-sm text-foreground/80">
                      Team name
                      <input
                        value={editingHomework.groupName || ""}
                        onChange={(e) =>
                          setEditing((prev) =>
                            prev && prev.type === "homeworks"
                              ? {
                                  type: "homeworks",
                                  original: prev.original,
                                  draft: {
                                    ...prev.draft,
                                    groupName: e.target.value,
                                  },
                                }
                              : prev,
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                        placeholder="Enter team name"
                      />
                    </label>
                    <label className="text-sm text-foreground/80">
                      Members (comma separated)
                      <input
                        value={(editingHomework.members || []).join(", ")}
                        onChange={(e) =>
                          setEditing((prev) =>
                            prev && prev.type === "homeworks"
                              ? {
                                  type: "homeworks",
                                  original: prev.original,
                                  draft: {
                                    ...prev.draft,
                                    members: e.target.value
                                      .split(",")
                                      .map((part) => part.trim())
                                      .filter(Boolean),
                                  },
                                }
                              : prev,
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                        placeholder="Member names (comma separated)"
                      />
                    </label>
                  </>
                ) : (
                  <label className="text-sm text-foreground/80">
                    Person name
                    <input
                      value={editingHomework.personName || ""}
                      onChange={(e) =>
                        setEditing((prev) =>
                          prev && prev.type === "homeworks"
                            ? {
                                type: "homeworks",
                                original: prev.original,
                                draft: {
                                  ...prev.draft,
                                  personName: e.target.value,
                                },
                              }
                            : prev,
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                    />
                  </label>
                )}
              </div>
            ) : null}

            {editingUser ? (
              <div className="mt-4 space-y-3">
                {editingUser.role === "temporary" ? (
                  // Temporary user: username, password, role, state
                  <>
                    <label className="text-sm text-foreground/80">
                      Username
                      <input
                        value={editingUser.username || ""}
                        onChange={(e) =>
                          setEditing((prev) =>
                            prev && prev.type === "users"
                              ? {
                                  type: "users",
                                  original: prev.original,
                                  draft: {
                                    ...prev.draft,
                                    username: e.target.value,
                                  },
                                }
                              : prev,
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-foreground/80">
                      Role
                      <select
                        value={editingUser.role}
                        onChange={(e) =>
                          setEditing((prev) =>
                            prev && prev.type === "users"
                              ? {
                                  type: "users",
                                  original: prev.original,
                                  draft: {
                                    ...prev.draft,
                                    role: e.target.value as Role,
                                  },
                                }
                              : prev,
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                      >
                        <option value="temporary">Temporary</option>
                        <option value="standard">Standard</option>
                        <option value="admin">Admin</option>
                        <option value="employer">Employer</option>
                      </select>
                    </label>
                    <label className="text-sm text-foreground/80 flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!editingUser.blocked}
                        onChange={(e) =>
                          setEditing((prev) =>
                            prev && prev.type === "users"
                              ? {
                                  type: "users",
                                  original: prev.original,
                                  draft: {
                                    ...prev.draft,
                                    blocked: e.target.checked,
                                  },
                                }
                              : prev,
                          )
                        }
                      />
                      Blocked State
                    </label>
                    <label className="text-sm text-foreground/80">
                      Password (leave blank to keep existing)
                      <input
                        value={editingPassword}
                        onChange={(e) => setEditingPassword(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                        type="password"
                      />
                    </label>
                  </>
                ) : (editingUser.role || "").toLowerCase() === "employer" ||
                  (editingUser.role || "").toLowerCase() === "employee" ? (
                  // Employer user: display_name, email, password
                  <>
                    <label className="text-sm text-foreground/80">
                      Display Name
                      <input
                        value={editingUser.display_name || ""}
                        onChange={(e) =>
                          setEditing((prev) =>
                            prev && prev.type === "users"
                              ? {
                                  type: "users",
                                  original: prev.original,
                                  draft: {
                                    ...prev.draft,
                                    display_name: e.target.value,
                                  },
                                }
                              : prev,
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-foreground/80">
                      Email
                      <input
                        value={editingUser.email || ""}
                        onChange={(e) =>
                          setEditing((prev) =>
                            prev && prev.type === "users"
                              ? {
                                  type: "users",
                                  original: prev.original,
                                  draft: {
                                    ...prev.draft,
                                    email: e.target.value,
                                  },
                                }
                              : prev,
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-foreground/80 flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!editingUser.blocked}
                        onChange={(e) =>
                          setEditing((prev) =>
                            prev && prev.type === "users"
                              ? {
                                  type: "users",
                                  original: prev.original,
                                  draft: {
                                    ...prev.draft,
                                    blocked: e.target.checked,
                                  },
                                }
                              : prev,
                          )
                        }
                      />
                      Block account
                    </label>
                    <label className="text-sm text-foreground/80">
                      Password (leave blank to keep existing)
                      <input
                        value={editingPassword}
                        onChange={(e) => setEditingPassword(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                        type="password"
                      />
                    </label>
                  </>
                ) : (
                  // Standard user: all fields
                  <>
                    <label className="text-sm text-foreground/80">
                      Username
                      <input
                        value={editingUser.username || ""}
                        onChange={(e) =>
                          setEditing((prev) =>
                            prev && prev.type === "users"
                              ? {
                                  type: "users",
                                  original: prev.original,
                                  draft: {
                                    ...prev.draft,
                                    username: e.target.value,
                                  },
                                }
                              : prev,
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-foreground/80">
                      Email
                      <input
                        value={editingUser.email || ""}
                        onChange={(e) =>
                          setEditing((prev) =>
                            prev && prev.type === "users"
                              ? {
                                  type: "users",
                                  original: prev.original,
                                  draft: {
                                    ...prev.draft,
                                    email: e.target.value,
                                  },
                                }
                              : prev,
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-foreground/80">
                      Role
                      <select
                        value={editingUser.role}
                        onChange={(e) =>
                          setEditing((prev) =>
                            prev && prev.type === "users"
                              ? {
                                  type: "users",
                                  original: prev.original,
                                  draft: {
                                    ...prev.draft,
                                    role: e.target.value as Role,
                                  },
                                }
                              : prev,
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                      >
                        <option value="temporary">Temporary</option>
                        <option value="standard">Standard</option>
                        <option value="admin">Admin</option>
                        <option value="employer">Employer</option>
                      </select>
                    </label>
                    <label className="text-sm text-foreground/80 flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!editingUser.blocked}
                        onChange={(e) =>
                          setEditing((prev) =>
                            prev && prev.type === "users"
                              ? {
                                  type: "users",
                                  original: prev.original,
                                  draft: {
                                    ...prev.draft,
                                    blocked: e.target.checked,
                                  },
                                }
                              : prev,
                          )
                        }
                      />
                      Block account
                    </label>
                    <label className="text-sm text-foreground/80">
                      Display Name
                      <input
                        value={editingUser.display_name || ""}
                        onChange={(e) =>
                          setEditing((prev) =>
                            prev && prev.type === "users"
                              ? {
                                  type: "users",
                                  original: prev.original,
                                  draft: {
                                    ...prev.draft,
                                    display_name: e.target.value,
                                  },
                                }
                              : prev,
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-foreground/80">
                      Password (leave blank to keep existing)
                      <input
                        value={editingPassword}
                        onChange={(e) => setEditingPassword(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                        type="password"
                      />
                    </label>
                  </>
                )}
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-foreground/20 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                disabled={saving}
                className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Updating…" : "Update"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
