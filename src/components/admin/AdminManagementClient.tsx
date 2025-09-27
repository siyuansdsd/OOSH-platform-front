"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAdminHomeworks,
  fetchAdminUsers,
  type AdminHomeworkRecord,
  type UserItem,
  type Role,
  type AdminUserStatus,
  updateAdminHomework,
  deleteAdminHomeworks,
  updateAdminUser,
  blockAdminUser,
  deleteAdminUser,
  bulkUpdateAdminUsers,
  createTemporaryAccount,
  createEmployerAccounts,
} from "@/lib/api/admin";
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
  const { accessToken } = useAuth();
  const [view, setView] = useState<ViewMode>("homeworks");
  const [homeworks, setHomeworks] = useState<AdminHomeworkRecord[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<EditingItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const [tempAccount, setTempAccount] = useState({
    username: "",
    password: "",
  });
  const [creatingTemp, setCreatingTemp] = useState(false);

  const [employerDrafts, setEmployerDrafts] = useState<EmployeeDraft[]>([
    { display_name: "", email: "", password: "" },
  ]);
  const [creatingEmployers, setCreatingEmployers] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!accessToken) return;
    // Only auto-load when we don't already have data for the selected view.
    // This preserves the resource-saving behavior (no reload on every tab
    // switch) while ensuring the first time you switch to Users/Homeworks we
    // fetch the data if it's empty.
    if (view === "homeworks" && homeworks.length > 0) return;
    if (view === "users" && users.length > 0) return;
    void loadData(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, view]);

  // track which user rows are expanded to show full record details
  const [expandedUserIds, setExpandedUserIds] = useState<string[]>([]);
  const [editingPassword, setEditingPassword] = useState<string>("");
  const [blockingIds, setBlockingIds] = useState<string[]>([]);

  const toggleUserExpanded = (id: string) => {
    setExpandedUserIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  async function loadData(mode: ViewMode) {
    setLoading(true);
    setError(null);
    try {
      if (!accessToken) throw new Error("Not authenticated");
      if (mode === "homeworks") {
        const res = await fetchAdminHomeworks({}, accessToken);
        setHomeworks(res.items);
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

  const activeRecords =
    view === "homeworks"
      ? homeworks
      : users.filter((user) => {
          const role = (user.role || "").toLowerCase();
          return role === "standard" || role === "user";
        });

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return activeRecords;
    if (view === "homeworks") {
      return (activeRecords as AdminHomeworkRecord[]).filter((item) => {
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
  }, [activeRecords, search, view]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const displayed = filteredRecords.map((item) => item.id);
    const displayedSelected = selectedIds.filter((id) =>
      displayed.includes(id)
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
    try {
      if (!accessToken) throw new Error("Not authenticated");
      if (editing.type === "homeworks") {
        await updateAdminHomework(editing.draft.id, editing.draft, accessToken);
        await loadData("homeworks");
      } else {
        const draft = editing.draft as UserItem;

        // Build payload according to role and provided password
        const payload: Record<string, any> = {};
        if (draft.role === "temporary") {
          // temporary: only username and password editable
          payload.username = draft.username;
          if (editingPassword) payload.password = editingPassword;
        } else {
          // employee/employer/standard: allow common fields
          payload.username = draft.username;
          payload.display_name = draft.display_name;
          payload.email = draft.email;
          payload.blocked = draft.blocked;
          if (editingPassword) payload.password = editingPassword;
        }

        await updateAdminUser(draft.id, payload, accessToken);
        await loadData("users");
      }
      setEditing(null);
    } catch (err: any) {
      setError(err?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkAction = async (
    action: "delete" | "disable" | "ban" | "enable"
  ) => {
    if (selectedIds.length === 0) return;
    setBulkActionLoading(action);
    try {
      if (!accessToken) throw new Error("Not authenticated");
      if (view === "homeworks" && action === "delete") {
        await deleteAdminHomeworks(selectedIds, accessToken);
        await loadData("homeworks");
      } else if (view === "users") {
        if (action === "disable" || action === "enable") {
          // Use individual block API calls for block/unblock operations
          await Promise.all(
            selectedIds.map((id) =>
              blockAdminUser(id, action === "disable", accessToken)
            )
          );
        } else if (action === "ban") {
          // Use individual DELETE API calls for permanent deletion
          await Promise.all(
            selectedIds.map((id) => deleteAdminUser(id, accessToken))
          );
        } else {
          // Use bulk API for other operations (if any remain)
          await bulkUpdateAdminUsers({ ids: selectedIds, action }, accessToken);
        }
        await loadData("users");
      }
      setSelectedIds([]);
    } catch (err: any) {
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
        username: draft.email.trim(), // Use email as username
        display_name: draft.display_name.trim(),
        email: draft.email.trim(),
        password: draft.password,
      }))
      .filter((draft) => draft.display_name && draft.email && draft.password);
    if (accounts.length === 0) return;
    setCreatingEmployers(true);
    try {
      if (!accessToken) throw new Error("Not authenticated");
      await createEmployerAccounts({ accounts }, accessToken);
      await loadData("users");
      setEmployerDrafts([{ display_name: "", email: "", password: "" }]);
    } catch (err: any) {
      setError(err?.message || "Batch create failed");
    } finally {
      setCreatingEmployers(false);
    }
  };

  const displayedSelected = selectedIds.filter((id) =>
    filteredRecords.some((record) => record.id === id)
  );

  const temporaryUsers = useMemo(
    () =>
      users.filter((user) => (user.role || "").toLowerCase() === "temporary"),
    [users]
  );

  const employerUsers = useMemo(
    () => users.filter((user) => user.role === "employer"),
    [users]
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
        {record.personName || record.groupName || "—"}
      </td>
      <td className="px-3 py-3 text-sm text-foreground/70">
        {record.members && record.members.length > 0
          ? record.members.join(", ")
          : "—"}
      </td>
      <td className="px-3 py-3 text-sm">
        <div className="flex max-w-xs flex-col gap-1 break-all whitespace-normal">
          {record.videos.map((video) => (
            <a
              key={video}
              href={video}
              className={`${linkClass} break-all`}
              target="_blank"
              rel="noreferrer"
            >
              {video}
            </a>
          ))}
          {record.videos.length === 0 ? "—" : null}
        </div>
      </td>
      <td className="px-3 py-3 text-sm">
        <div className="flex max-w-xs flex-col gap-1 break-all whitespace-normal">
          {record.images.map((image) => (
            <a
              key={image}
              href={image}
              className={`${linkClass} break-all`}
              target="_blank"
              rel="noreferrer"
            >
              {image}
            </a>
          ))}
          {record.images.length === 0 ? "—" : null}
        </div>
      </td>
      <td className="px-3 py-3 text-sm">
        <div className="flex max-w-xs flex-col gap-1 break-all whitespace-normal">
          {record.urls.map((url) => (
            <a
              key={url}
              href={url}
              className={`${linkClass} break-all`}
              target="_blank"
              rel="noreferrer"
            >
              {url}
            </a>
          ))}
          {record.urls.length === 0 ? "—" : null}
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-sm text-foreground/70">
        {record.submittedAt || "—"}
      </td>
      <td className="px-3 py-3 text-sm capitalize text-foreground/70">
        {record.status || "pending"}
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
            onClick={() => void loadData(view)}
            className="rounded-lg border border-foreground/20 px-4 py-2 text-sm hover:bg-foreground/10"
          >
            Refresh
          </button>
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
          ) : (
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
          )}
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
                <th className="px-3 py-3">Select</th>
                <th className="px-3 py-3">Title</th>
                <th className="px-3 py-3">School</th>
                <th className="px-3 py-3">Owner</th>
                <th className="px-3 py-3">Members</th>
                <th className="px-3 py-3">Videos</th>
                <th className="px-3 py-3">Images</th>
                <th className="px-3 py-3">Websites</th>
                <th className="px-3 py-3">Submitted</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            ) : (
              <tr>
                <th className="px-3 py-3">Select</th>
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
            ) : filteredRecords.length === 0 ? (
              <tr>
                <td
                  colSpan={view === "homeworks" ? 10 : 11}
                  className="px-3 py-6 text-center text-foreground/60"
                >
                  No records found.
                </td>
              </tr>
            ) : view === "homeworks" ? (
              (filteredRecords as AdminHomeworkRecord[]).map(renderHomeworkRow)
            ) : (
              // For users, render the main row and optionally a details row
              (filteredRecords as UserItem[]).flatMap((record) => {
                const main = renderUserRow(record);
                if (!expandedUserIds.includes(record.id)) return [main];
                const detailsRow = (
                  <tr key={`${record.id}-details`} className="bg-background/5">
                    <td
                      colSpan={11}
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
                                    record.refresh_token_expires_at
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
                      next[index] = { ...next[index], email: e.target.value };
                      setEmployerDrafts(next);
                    }}
                    className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                    type="email"
                  />
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
                      prev.slice(0, Math.max(1, prev.length - 1))
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
              disabled={creatingEmployers}
              className="inline-flex w-fit items-center justify-center rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingEmployers ? "Processing…" : "Create employee accounts"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-foreground/10 bg-white/5 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Temporary accounts
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadData("users")}
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
                    <th className="px-3 py-2">Password</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">State</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {temporaryUsers.map((user) => (
                    <tr key={user.id} className="border-t border-foreground/10">
                      <td className="px-3 py-2">{user.username}</td>
                      <td className="px-3 py-2">—</td>
                      <td className="px-3 py-2">
                        {String(user.role).charAt(0).toUpperCase() +
                          String(user.role).slice(1)}
                      </td>
                      <td className="px-3 py-2">
                        {user.blocked ? "Blocked" : "Active"}
                      </td>
                      <td className="px-3 py-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            openUserEditor(user);
                            setEditingPassword("");
                          }}
                          className="rounded-lg border border-foreground/20 px-2 py-1 text-xs"
                        >
                          Edit
                        </button>
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
                                accessToken
                              );
                              await loadData("users");
                            } catch (err: any) {
                              setError(err?.message || "Block/Unblock failed");
                            } finally {
                              setBlockingIds((prev) =>
                                prev.filter((id) => id !== user.id)
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
                            if (!window.confirm("Are you sure you want to delete this temporary account?")) return;
                            try {
                              if (!accessToken)
                                throw new Error("Not authenticated");
                              setBlockingIds((prev) => [...prev, user.id]);
                              await deleteAdminUser(user.id, accessToken);
                              await loadData("users");
                            } catch (err: any) {
                              setError(err?.message || "Delete failed");
                            } finally {
                              setBlockingIds((prev) =>
                                prev.filter((id) => id !== user.id)
                              );
                            }
                          }}
                          className="rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs text-red-600 hover:bg-red-500/20"
                        >
                          {blockingIds.includes(user.id) ? "Processing..." : "Delete"}
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
                onClick={() => void loadData("users")}
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
                    <th className="px-3 py-2">Password</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employerUsers.map((user) => (
                    <tr key={user.id} className="border-t border-foreground/10">
                      <td className="px-3 py-2">{user.username}</td>
                      <td className="px-3 py-2">{user.display_name || "—"}</td>
                      <td className="px-3 py-2">{user.email || "—"}</td>
                      <td className="px-3 py-2">—</td>
                      <td className="px-3 py-2">
                        {user.blocked ? "Blocked" : "Active"}
                      </td>
                      <td className="px-3 py-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            openUserEditor(user);
                            setEditingPassword("");
                          }}
                          className="rounded-lg border border-foreground/20 px-2 py-1 text-xs"
                        >
                          Edit
                        </button>
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
                                accessToken
                              );
                              await loadData("users");
                            } catch (err: any) {
                              setError(err?.message || "Block/Unblock failed");
                            } finally {
                              setBlockingIds((prev) =>
                                prev.filter((id) => id !== user.id)
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
                            if (!window.confirm("Are you sure you want to delete this employee account?")) return;
                            try {
                              if (!accessToken)
                                throw new Error("Not authenticated");
                              setBlockingIds((prev) => [...prev, user.id]);
                              await deleteAdminUser(user.id, accessToken);
                              await loadData("users");
                            } catch (err: any) {
                              setError(err?.message || "Delete failed");
                            } finally {
                              setBlockingIds((prev) =>
                                prev.filter((id) => id !== user.id)
                              );
                            }
                          }}
                          className="rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs text-red-600 hover:bg-red-500/20"
                        >
                          {blockingIds.includes(user.id) ? "Processing..." : "Delete"}
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
                          : prev
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
                          : prev
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                    rows={4}
                  />
                </label>
                <label className="text-sm text-foreground/80">
                  School
                  <input
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
                          : prev
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                  />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm text-foreground/80">
                    Group name
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
                            : prev
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                    />
                  </label>
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
                            : prev
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                    />
                  </label>
                </div>
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
                          : prev
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                  />
                </label>

                <MediaEditor
                  label="Images"
                  items={editingHomework.images}
                  onRemove={(url) =>
                    setEditing((prev) =>
                      prev && prev.type === "homeworks"
                        ? {
                            type: "homeworks",
                            original: prev.original,
                            draft: {
                              ...prev.draft,
                              images: prev.draft.images.filter(
                                (item) => item !== url
                              ),
                            },
                          }
                        : prev
                    )
                  }
                />
                <MediaEditor
                  label="Videos"
                  items={editingHomework.videos}
                  onRemove={(url) =>
                    setEditing((prev) =>
                      prev && prev.type === "homeworks"
                        ? {
                            type: "homeworks",
                            original: prev.original,
                            draft: {
                              ...prev.draft,
                              videos: prev.draft.videos.filter(
                                (item) => item !== url
                              ),
                            },
                          }
                        : prev
                    )
                  }
                />
                <MediaEditor
                  label="Websites"
                  items={editingHomework.urls}
                  onRemove={(url) =>
                    setEditing((prev) =>
                      prev && prev.type === "homeworks"
                        ? {
                            type: "homeworks",
                            original: prev.original,
                            draft: {
                              ...prev.draft,
                              urls: prev.draft.urls.filter(
                                (item) => item !== url
                              ),
                            },
                          }
                        : prev
                    )
                  }
                />
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
                              : prev
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
                              : prev
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
                              : prev
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
                ) : editingUser.role === "employer" ? (
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
                              : prev
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
                              : prev
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
                              : prev
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
                              : prev
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
                              : prev
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
                              : prev
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
                              : prev
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
                              : prev
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

function MediaEditor({
  label,
  items,
  onRemove,
}: {
  label: string;
  items: string[];
  onRemove: (url: string) => void;
}) {
  if (!items?.length) {
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-sm text-foreground/60">No entries</div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-foreground">{label}</div>
      <div className="grid gap-2 md:grid-cols-2">
        {items.map((url) => (
          <div
            key={url}
            className="flex items-center gap-2 rounded-xl border border-foreground/15 bg-background/40 p-2"
          >
            {label === "Images" ? (
              <img
                src={url}
                alt="preview"
                className="h-16 w-16 rounded-lg object-cover"
              />
            ) : null}
            <div className="flex-1 break-all text-sm">
              <a
                href={url}
                className={`${linkClass} break-all`}
                target="_blank"
                rel="noreferrer"
              >
                {url}
              </a>
            </div>
            <button
              type="button"
              onClick={() => onRemove(url)}
              className="rounded-lg border border-foreground/20 px-2 py-1 text-xs text-red-500"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
