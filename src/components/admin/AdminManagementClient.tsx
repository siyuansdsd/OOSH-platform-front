"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAdminHomeworks,
  fetchAdminUsers,
  type AdminHomeworkRecord,
  type AdminUserRecord,
  type AdminUserRole,
  type AdminUserStatus,
  updateAdminHomework,
  deleteAdminHomeworks,
  updateAdminUser,
  bulkUpdateAdminUsers,
  createTemporaryAccount,
  createEmployerAccounts,
} from "@/lib/api/admin";
import { useAuth } from "@/components/auth/AuthProvider";

interface EmployerDraft {
  email: string;
  password: string;
}

type ViewMode = "homeworks" | "users";

type EditingItem =
  | { type: "homeworks"; original: AdminHomeworkRecord; draft: AdminHomeworkRecord }
  | { type: "users"; original: AdminUserRecord; draft: AdminUserRecord };

const linkClass = "font-semibold italic underline";

export function AdminManagementClient() {
  const { accessToken } = useAuth();
  const [view, setView] = useState<ViewMode>("homeworks");
  const [homeworks, setHomeworks] = useState<AdminHomeworkRecord[]>([]);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<EditingItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const [tempAccount, setTempAccount] = useState({ username: "", password: "" });
  const [creatingTemp, setCreatingTemp] = useState(false);

  const [employerDrafts, setEmployerDrafts] = useState<EmployerDraft[]>([
    { email: "", password: "" },
  ]);
  const [creatingEmployers, setCreatingEmployers] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    void loadData(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, accessToken]);

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
        setUsers(list as AdminUserRecord[]);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load data");
    } finally {
      setLoading(false);
      setSelectedIds([]);
    }
  }

  const activeRecords = view === "homeworks" ? homeworks : users;

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
    return (activeRecords as AdminUserRecord[]).filter((item) => {
      const haystack = [
        item.username,
        item.email,
        item.role,
        item.status,
        item.notes,
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
    const displayedSelected = selectedIds.filter((id) => displayed.includes(id));
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

  const openUserEditor = (record: AdminUserRecord) => {
    setEditing({
      type: "users",
      original: record,
      draft: { ...record },
    });
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
        const payload = {
          email: editing.draft.email,
          role: editing.draft.role,
          status: editing.draft.status,
          notes: editing.draft.notes,
        };
        await updateAdminUser(editing.draft.id, payload, accessToken);
        await loadData("users");
      }
      setEditing(null);
    } catch (err: any) {
      setError(err?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkAction = async (action: "delete" | "disable" | "ban" | "enable") => {
    if (selectedIds.length === 0) return;
    try {
      if (!accessToken) throw new Error("Not authenticated");
      if (view === "homeworks" && action === "delete") {
        await deleteAdminHomeworks(selectedIds, accessToken);
        await loadData("homeworks");
      } else if (view === "users") {
        await bulkUpdateAdminUsers({ ids: selectedIds, action }, accessToken);
        await loadData("users");
      }
      setSelectedIds([]);
    } catch (err: any) {
      setError(err?.message || "Action failed");
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
      .map((draft) => ({ email: draft.email.trim(), password: draft.password }))
      .filter((draft) => draft.email && draft.password);
    if (accounts.length === 0) return;
    setCreatingEmployers(true);
    try {
      if (!accessToken) throw new Error("Not authenticated");
      await createEmployerAccounts({ accounts }, accessToken);
      await loadData("users");
      setEmployerDrafts([{ email: "", password: "" }]);
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
    () => users.filter((user) => (user.role || "").toLowerCase() === "temporary"),
    [users]
  );

  const editorUsers = useMemo(
    () =>
      users.filter((user) => {
        const role = (user.role || "").toLowerCase();
        const scopeValue = (user.scope || "").toLowerCase();
        return role === "editor" || scopeValue === "admin";
      }),
    [users]
  );

  const renderHomeworkRow = (record: AdminHomeworkRecord) => (
    <tr key={record.id} className="border-b border-foreground/10 hover:bg-foreground/5">
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
      <td className="px-3 py-3 text-sm font-medium text-foreground">{record.title || "Untitled"}</td>
      <td className="px-3 py-3 text-sm text-foreground/70">{record.schoolName || "—"}</td>
      <td className="px-3 py-3 text-sm text-foreground/70">
        {record.personName || record.groupName || "—"}
      </td>
      <td className="px-3 py-3 text-sm text-foreground/70">
        {record.members && record.members.length > 0 ? record.members.join(", ") : "—"}
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

  const renderUserRow = (record: AdminUserRecord) => (
    <tr key={record.id} className="border-b border-foreground/10 hover:bg-foreground/5">
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
      <td className="px-3 py-3 text-sm font-medium text-foreground">{record.username}</td>
      <td className="px-3 py-3 text-sm text-foreground/70">
        {record.email ? (
          <a href={`mailto:${record.email}`} className={linkClass}>
            {record.email}
          </a>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-3 text-sm capitalize text-foreground">{record.role}</td>
      <td className="px-3 py-3 text-sm capitalize text-foreground/70">{record.status}</td>
      <td className="whitespace-nowrap px-3 py-3 text-xs text-foreground/50">
        {record.createdAt || "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-xs text-foreground/50">
        {record.lastLoginAt || "—"}
      </td>
      <td className="px-3 py-3 text-sm text-foreground/70">{record.notes || "—"}</td>
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
              disabled={displayedSelected.length === 0}
              onClick={() => void handleBulkAction("delete")}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete selected
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={displayedSelected.length === 0}
                onClick={() => void handleBulkAction("disable")}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Disable selected
              </button>
              <button
                type="button"
                disabled={displayedSelected.length === 0}
                onClick={() => void handleBulkAction("ban")}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Ban selected
              </button>
              <button
                type="button"
                disabled={displayedSelected.length === 0}
                onClick={() => void handleBulkAction("enable")}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Enable selected
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
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Created</th>
                <th className="px-3 py-3">Last Login</th>
                <th className="px-3 py-3">Notes</th>
              </tr>
            )}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={view === "homeworks" ? 10 : 8} className="px-3 py-6 text-center text-foreground/60">
                  Loading…
                </td>
              </tr>
            ) : filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={view === "homeworks" ? 10 : 8} className="px-3 py-6 text-center text-foreground/60">
                  No records found.
                </td>
              </tr>
            ) : view === "homeworks" ? (
              (filteredRecords as AdminHomeworkRecord[]).map(renderHomeworkRow)
            ) : (
              (filteredRecords as AdminUserRecord[]).map(renderUserRow)
            )}
          </tbody>
        </table>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-foreground/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-foreground">Temporary accounts</h2>
          <p className="mt-1 text-sm text-foreground/60">
            Quickly generate temporary login credentials.
          </p>
          <div className="mt-4 grid gap-3">
            <label className="text-sm text-foreground/80">
              Username
              <input
                value={tempAccount.username}
                onChange={(e) => setTempAccount((prev) => ({ ...prev, username: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
              />
            </label>
            <label className="text-sm text-foreground/80">
              Password
              <input
                value={tempAccount.password}
                onChange={(e) => setTempAccount((prev) => ({ ...prev, password: e.target.value }))}
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
          <h2 className="text-lg font-semibold text-foreground">Employer invitations</h2>
          <p className="mt-1 text-sm text-foreground/60">
            Add employer accounts in bulk by email and password.
          </p>
          <div className="mt-4 space-y-3">
            {employerDrafts.map((draft, index) => (
              <div key={index} className="grid gap-3 sm:grid-cols-2">
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
                      next[index] = { ...next[index], password: e.target.value };
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
                onClick={() => setEmployerDrafts((prev) => [...prev, { email: "", password: "" }])}
                className="rounded-lg border border-foreground/20 px-3 py-1 text-xs font-medium"
              >
                + Add row
              </button>
              {employerDrafts.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setEmployerDrafts((prev) => prev.slice(0, Math.max(1, prev.length - 1)))
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
              {creatingEmployers ? "Processing…" : "Create employer accounts"}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-foreground/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-foreground">Temporary accounts</h2>
          {temporaryUsers.length === 0 ? (
            <p className="mt-2 text-sm text-foreground/60">No temporary accounts created yet.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm text-foreground/80">
              {temporaryUsers.map((user) => (
                <li key={user.id} className="truncate">
                  <span className="font-medium">{user.username}</span>
                  {user.email ? <span className="text-foreground/60"> · {user.email}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-3xl border border-foreground/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-foreground">Editor / Admin accounts</h2>
          {editorUsers.length === 0 ? (
            <p className="mt-2 text-sm text-foreground/60">No editor accounts found.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm text-foreground/80">
              {editorUsers.map((user) => (
                <li key={user.id} className="truncate">
                  <span className="font-medium">{user.username}</span>
                  {user.email ? <span className="text-foreground/60"> · {user.email}</span> : null}
                  <span className="text-foreground/50"> · {user.role}</span>
                </li>
              ))}
            </ul>
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
                              draft: { ...prev.draft, description: e.target.value },
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
                              draft: { ...prev.draft, schoolName: e.target.value },
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
                                draft: { ...prev.draft, groupName: e.target.value },
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
                                draft: { ...prev.draft, personName: e.target.value },
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
                              images: prev.draft.images.filter((item) => item !== url),
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
                              videos: prev.draft.videos.filter((item) => item !== url),
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
                              urls: prev.draft.urls.filter((item) => item !== url),
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
                              draft: { ...prev.draft, email: e.target.value },
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
                                role: e.target.value as AdminUserRole,
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
                <label className="text-sm text-foreground/80">
                  Status
                  <select
                    value={editingUser.status}
                    onChange={(e) =>
                      setEditing((prev) =>
                        prev && prev.type === "users"
                          ? {
                              type: "users",
                              original: prev.original,
                              draft: {
                                ...prev.draft,
                                status: e.target.value as AdminUserStatus,
                              },
                            }
                          : prev
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                    <option value="banned">Banned</option>
                  </select>
                </label>
                <label className="text-sm text-foreground/80">
                  Notes
                  <textarea
                    value={editingUser.notes || ""}
                    onChange={(e) =>
                      setEditing((prev) =>
                        prev && prev.type === "users"
                          ? {
                              type: "users",
                              original: prev.original,
                              draft: { ...prev.draft, notes: e.target.value },
                            }
                          : prev
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-foreground/15 bg-background/60 px-3 py-2"
                    rows={3}
                  />
                </label>
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
              <img src={url} alt="preview" className="h-16 w-16 rounded-lg object-cover" />
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
