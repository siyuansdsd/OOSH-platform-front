"use client";

import React, { useMemo, useState } from "react";
import UploadTypeSelector from "./UploadTypeSelector";
import FileDropzone from "./FileDropzone";
import UrlUploader from "@/components/upload/UrlUploader";
import { Spinner } from "../ui/Spinner";
import {
  UploadContext,
  type ValidationErrors,
  type UploadMode,
} from "./UploadContext";
import { useAuth } from "@/components/auth/AuthProvider";
import { APPROVED_SCHOOLS, type ApprovedSchool } from "@/constants/schools";

const EN_NAME = /^[A-Za-z ]+$/;

function FieldError({
  message,
  className = "",
}: {
  message?: string;
  className?: string;
}) {
  const hasMessage = Boolean(message);
  const content = hasMessage ? message : "\u00a0";
  return (
    <p
      className={`text-xs ${
        hasMessage ? "text-red-500" : "text-transparent"
      } ${className}`}
      style={{ minHeight: "1rem" }}
    >
      {content}
    </p>
  );
}

export default function UploadFormClient() {
  const { accessToken } = useAuth();
  const [mode, setMode] = useState<UploadMode>("file");
  const [files, setFiles] = useState<File[]>([]);
  const [urls, setUrls] = useState<string[]>([""]);
  const [schoolName, setSchoolName] = useState<ApprovedSchool | "">
    ("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [groupName, setGroupName] = useState("");
  const [is_team, setIsTeam] = useState(false);
  const [members, setMembers] = useState<string[]>([""]);
  const [person_name, setPersonName] = useState("");
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const ctxValue = useMemo(
    () => ({
      mode,
      setMode,
      files,
      setFiles,
      urls,
      setUrls,
      schoolName,
      setSchoolName,
      title,
      setTitle,
      description,
      setDescription,
      groupName,
      setGroupName,
      is_team,
      setIsTeam,
      members,
      setMembers,
      person_name,
      setPersonName,
      errors,
      setErrors,
      disabled: submitting,
    }),
    [
      mode,
      files,
      urls,
      schoolName,
      title,
      description,
      groupName,
      is_team,
      members,
      person_name,
      errors,
      submitting,
    ]
  );

  const validate = (): boolean => {
    const e: ValidationErrors = {};
    const check = (key: string, val: string, label: string) => {
      const trimmed = val.trim();
      if (!trimmed) e[key] = `${label} is required`;
      else if (!EN_NAME.test(trimmed))
        e[key] = `${label} must be English letters and spaces only`;
    };
    if (!schoolName) {
      e.schoolName = "Select a school from the list";
    }
    if (!title.trim()) e.title = "Title is required";
    if (!description.trim()) e.description = "Description is required";

    if (mode === "file") {
      if (!files.length) e.files = "Please add at least one image or video";
    } else {
      const cleaned = urls.map((u) => u.trim()).filter(Boolean);
      if (!cleaned.length) e.urls = "Please add at least one URL";
    }

    if (is_team) {
      check("groupName", groupName, "Team Name");
      const trimmedMembers = members.map((m) => m.trim());
      const filledMembers = trimmedMembers.filter(Boolean);
      if (filledMembers.length === 0) {
        e.members = "Please provide at least one team member name";
      }
      trimmedMembers.forEach((m, idx) => {
        if (m && !EN_NAME.test(m)) {
          e[`members_${idx}`] = `Member ${
            idx + 1
          } must be English letters and spaces only`;
        }
      });
    } else {
      check("person_name", person_name, "Person Name");
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    setServerError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (mode === "file") {
        // Presign JSON flow: request presigns -> PUT to S3 -> write-back
        const trimmedMembers = members.map((m) => m.trim()).filter(Boolean);
        const presignReq = {
          files: files.map((f) => ({ filename: f.name, contentType: f.type })),
          schoolName: schoolName.trim(),
          title: title.trim(),
          description: description.trim(),
          groupName: is_team ? groupName.trim() : undefined,
          is_team,
          members: is_team ? trimmedMembers : undefined,
          person_name: !is_team ? person_name.trim() : undefined,
          mode,
        } as const;

        if (!accessToken) throw new Error("Not authenticated");

        const presignRes = await fetch("/api/uploads/create-and-presign", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(presignReq),
        });
        if (!presignRes.ok) {
          const text = await presignRes.text();
          let msg = text || `HTTP ${presignRes.status}`;
          try {
            const obj = JSON.parse(text);
            msg = obj?.message || obj?.error || msg;
          } catch {}
          throw new Error(msg);
        }
        const rawText = await presignRes
          .clone()
          .text()
          .catch(() => "");
        const raw: any = await presignRes.json().catch(() => {
          try {
            return rawText ? JSON.parse(rawText) : {};
          } catch {
            return {};
          }
        });
        // Robust extractor: handles single-object, arrays, maps, and various envelope keys
        const pickFirst = (...vals: any[]) =>
          vals.find((v) => v !== undefined && v !== null);
        const roots = [raw, raw?.data, raw?.result, raw?.payload];
        const getFromRoots = (key: string) =>
          pickFirst(
            ...roots.map((r) =>
              r && typeof r === "object" ? r[key] : undefined
            )
          );
        const homeworkObj = pickFirst(getFromRoots("homework"));
        const homeworkId = pickFirst(
          getFromRoots("homeworkId"),
          getFromRoots("homework_id"),
          homeworkObj?.id,
          getFromRoots("id")
        );
        let presignsAny: any = pickFirst(
          getFromRoots("presigns"),
          getFromRoots("presign"),
          getFromRoots("signed"),
          getFromRoots("signedUrls"),
          getFromRoots("signed_urls"),
          getFromRoots("files"),
          getFromRoots("file"),
          getFromRoots("items"),
          // Some backends embed the single presign directly in data
          (() => {
            const d = getFromRoots("data");
            if (d && typeof d === "object") {
              const hasPresignHints = [
                "uploadUrl",
                "presignedUrl",
                "presigned_url",
                "fileUrl",
                "publicUrl",
                "location",
                "filename",
                "contentType",
              ].some((k) => k in d);
              return hasPresignHints ? d : undefined;
            }
            return undefined;
          })()
        );
        const toArray = (v: any): any[] => {
          if (!v) return [];
          if (Array.isArray(v)) return v;
          if (typeof v === "object") return Object.values(v);
          return [v];
        };
        let presignsArr = toArray(presignsAny);
        // Helper to recognize presign-ish objects
        const looksLikePresign = (o: any) =>
          o &&
          typeof o === "object" &&
          [
            "uploadUrl",
            "presignedUrl",
            "presigned_url",
            "fileUrl",
            "publicUrl",
            "location",
            "filename",
          ].some((k) => k in o);
        // Fallback: scan roots for a single-object
        if (presignsArr.length === 0) {
          const candidate = roots.find((r) => looksLikePresign(r));
          if (candidate) presignsArr = [candidate as any];
        }
        // Fallback: arrays at root or envelopes
        if (presignsArr.length === 0) {
          const arrayRoot = roots.find((r) => Array.isArray(r)) as
            | any[]
            | undefined;
          if (arrayRoot && arrayRoot.some((it) => looksLikePresign(it))) {
            presignsArr = arrayRoot.filter((it) => looksLikePresign(it));
          }
        }
        if (presignsArr.length === 0) {
          for (const k of ["data", "result", "payload"]) {
            const arr = (raw as any)?.[k];
            if (
              Array.isArray(arr) &&
              arr.some((it: any) => looksLikePresign(it))
            ) {
              presignsArr = arr.filter((it: any) => looksLikePresign(it));
              break;
            }
          }
        }
        if (!homeworkId || presignsArr.length === 0) {
          const snippet = (rawText || "").slice(0, 200);
          throw new Error(
            `No presigns returned${snippet ? `: ${snippet}` : ""}`
          );
        }

        // Upload to S3
        await Promise.all(
          presignsArr.map(async (p: any) => {
            const f = files.find((x) => x.name === p.filename);
            if (!f || !p?.uploadUrl) return;
            const put = await fetch(p.uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": p.contentType || f.type },
              body: f,
            });
            if (!put.ok) throw new Error(`Upload failed for ${p.filename}`);
          })
        );

        // Classify images/videos and write back (robust to single-file + varying keys)
        const imgExt = new Set([
          "jpg",
          "jpeg",
          "png",
          "gif",
          "webp",
          "bmp",
          "svg",
          "heic",
          "heif",
          "tiff",
        ]);
        const vidExt = new Set([
          "mp4",
          "mov",
          "webm",
          "avi",
          "mkv",
          "m4v",
          "3gp",
        ]);
        const getExt = (name: string) =>
          (name.split(".").pop() || "").toLowerCase();
        const urlOf = (p: any) => {
          const direct =
            p?.fileUrl ||
            p?.publicUrl ||
            p?.location ||
            p?.url ||
            p?.href ||
            "";
          if (direct) return direct as string;
          const up = p?.uploadUrl || p?.signedUrl || p?.presignedUrl || "";
          if (typeof up === "string" && up) {
            try {
              const u = new URL(up);
              return `${u.origin}${u.pathname}`; // strip query to form GET url
            } catch {}
          }
          return "";
        };

        // Pair presigns to original files (by name, else index)
        const pairs = presignsArr.map((p: any, i: number) => {
          const byName = files.find((x) => x.name === p.filename) || null;
          const file = byName ?? files[i] ?? files[0] ?? null;
          const nameForExt = String(p?.filename || file?.name || "");
          const ctype = String(p?.contentType || file?.type || "");
          const img =
            (ctype && ctype.startsWith("image/")) ||
            imgExt.has(getExt(nameForExt));
          const vid =
            (ctype && ctype.startsWith("video/")) ||
            vidExt.has(getExt(nameForExt));
          const finalUrl = urlOf(p);
          return { p, file, img, vid, url: finalUrl };
        });

        let images = pairs
          .filter((it) => it.img)
          .map((it) => it.url)
          .filter(Boolean);
        let videos = pairs
          .filter((it) => it.vid)
          .map((it) => it.url)
          .filter(Boolean);
        // Last-resort fallback: single-file scenario
        if (images.length === 0 && videos.length === 0 && pairs.length === 1) {
          const only = pairs[0];
          const url = only.url;
          if (url) {
            if (only.file?.type?.startsWith("image/")) images = [url];
            else if (only.file?.type?.startsWith("video/")) videos = [url];
            else if (imgExt.has(getExt(only.file?.name || ""))) images = [url];
            else if (vidExt.has(getExt(only.file?.name || ""))) videos = [url];
          }
        }

        const writeRes = await fetch(
          `/api/homeworks/${encodeURIComponent(homeworkId)}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              images,
              videos,
              title: title.trim(),
              description: description.trim(),
              school_name: schoolName.trim(),
              group_name: is_team ? groupName.trim() : undefined,
              person_name: !is_team ? person_name.trim() : undefined,
              is_team,
              members: is_team ? trimmedMembers : undefined,
            }),
          }
        );
        if (!writeRes.ok) {
          const text = await writeRes.text().catch(() => "");
          console.error("Homework update failed", {
            status: writeRes.status,
            body: text,
          });
          throw new Error(`HTTP ${writeRes.status}`);
        }
      } else {
        // URL-only flow: direct POST
        const cleaned = urls.map((u) => u.trim()).filter(Boolean);
        const trimmedMembers = members.map((m) => m.trim()).filter(Boolean);
        const payload = {
          school_name: schoolName.trim(),
          is_team,
          title: title.trim(),
          description: description.trim(),
          person_name: !is_team ? person_name.trim() : undefined,
          group_name: is_team ? groupName.trim() : undefined,
          members: is_team ? trimmedMembers : undefined,
          urls: cleaned,
        };
        const res = await fetch("/api/homeworks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error("Homework create failed", {
            status: res.status,
            body: text,
          });
          throw new Error(`HTTP ${res.status}`);
        }
      }

      setSuccess(true);
    } catch (err: any) {
      setServerError(err?.message || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-emerald-700">
        <div className="flex items-center gap-3">
          <span className="text-xl">✅</span>
          <div className="font-medium">Upload succeeded</div>
        </div>
        <div className="mt-2 text-sm text-emerald-700/80">
          Thanks for your submission.
        </div>
      </div>
    );
  }

  return (
    <UploadContext.Provider value={ctxValue}>
      <div className="mx-auto w-full max-w-3xl">
        <div className="glass-panel rounded-3xl p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Content Upload</h2>

          <div className="mb-6">
            <UploadTypeSelector />
          </div>

          {mode === "file" ? (
            <div className="mb-6">
              <FileDropzone />
            </div>
          ) : (
            <div className="mb-6">
              <UrlUploader />
            </div>
          )}

          <FieldError
            message={errors.files}
            className="-mt-4 mb-4"
          />
          <FieldError
            message={errors.urls}
            className="-mt-4 mb-4"
          />

          <TraditionalFields />

        {serverError ? (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-600">
            {serverError}
          </div>
        ) : null}

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="btn-gradient rounded-xl px-5 py-2.5 text-sm font-semibold text-foreground transition disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Submit
            </button>
            {submitting && <Spinner label="uploading..." />}
          </div>
        </div>
      </div>
    </UploadContext.Provider>
  );
}

function TraditionalFields() {
  const {
    schoolName,
    setSchoolName,
    title,
    setTitle,
    description,
    setDescription,
    groupName,
    setGroupName,
    is_team,
    setIsTeam,
    members,
    setMembers,
    person_name,
    setPersonName,
    errors,
    disabled,
  } = React.useContext(UploadContext)!;

  const baseInput =
    "w-full rounded-xl border border-foreground/15 bg-white/70 dark:bg-black/20 px-4 py-3 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:shadow-[0_0_0_4px_rgba(59,130,246,0.12)]";

  return (
    <div className="grid grid-cols-1 gap-4">
      <label className="block">
        <div className="mb-1 text-sm text-foreground/80">Project Title</div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={(e) => setTitle(e.target.value.trim())}
          disabled={disabled}
          className={baseInput}
          placeholder="Enter project title"
        />
        <FieldError message={errors.title} className="mt-1" />
      </label>

      <label className="block">
        <div className="mb-1 text-sm text-foreground/80">Project Description</div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={(e) => setDescription(e.target.value.trim())}
          disabled={disabled}
          className={`${baseInput} min-h-[120px] resize-y`}
          placeholder="Describe the project"
        />
        <FieldError message={errors.description} className="mt-1" />
      </label>

      <label className="block">
        <div className="mb-1 text-sm text-foreground/80">School Name</div>
        <select
          value={schoolName}
          onChange={(e) =>
            setSchoolName(e.target.value as ApprovedSchool | "")
          }
          disabled={disabled}
          className={`${baseInput} bg-white/80 dark:bg-black/40`}
        >
          <option value="">Select a school</option>
          {APPROVED_SCHOOLS.map((school) => (
            <option key={school} value={school}>
              {school}
            </option>
          ))}
        </select>
        <FieldError message={errors.schoolName} className="mt-1" />
      </label>

      <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-2 select-none">
          <input
            type="checkbox"
            checked={is_team}
            onChange={(e) => setIsTeam(e.target.checked)}
            disabled={disabled}
            className="size-4 rounded border-foreground/30 accent-blue-600"
          />
          <span className="text-sm">Team submission</span>
        </label>
      </div>

      {is_team ? (
        <>
          <label className="block">
            <div className="mb-1 text-sm text-foreground/80">Team Name</div>
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            onBlur={(e) => setGroupName(e.target.value.trim())}
            disabled={disabled}
            className={baseInput}
            placeholder="Enter team name (English only)"
          />
          <FieldError message={errors.groupName} className="mt-1" />
        </label>
          <div>
            <div className="mb-1 text-sm text-foreground/80">Members</div>
            <div className="flex flex-col gap-2">
              {members.map((m, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    value={m}
                    onChange={(e) => {
                      const next = members.slice();
                      next[idx] = e.target.value;
                      setMembers(next);
                    }}
                    onBlur={(e) => {
                      const next = members.slice();
                      next[idx] = e.target.value.trim();
                      setMembers(next);
                    }}
                    disabled={disabled}
                    className={baseInput}
                    placeholder={`Member ${idx + 1} (English only)`}
                  />
                  {members.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = members.slice();
                        next.splice(idx, 1);
                        setMembers(next.length ? next : [""]);
                      }}
                      className="h-10 rounded-xl border border-foreground/15 px-3 text-sm hover:bg-white/10"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
             <button
               type="button"
               onClick={() => setMembers([...members, ""])}
               className="h-10 w-fit rounded-xl bg-blue-600 px-4 text-white text-sm font-medium shadow-lg shadow-blue-600/20"
             >
               + Add member
             </button>
              <FieldError message={errors.members} className="mt-1" />
              {members.map((_, idx) => (
                <FieldError
                  key={idx}
                  message={errors[`members_${idx}`]}
                  className="mt-1"
                />
              ))}
            </div>
          </div>
        </>
      ) : (
        <label className="block">
          <div className="mb-1 text-sm text-foreground/80">Person Name</div>
          <input
            value={person_name}
            onChange={(e) => setPersonName(e.target.value)}
            onBlur={(e) => setPersonName(e.target.value.trim())}
            disabled={disabled}
            className={baseInput}
            placeholder="Enter name (English only)"
          />
          <FieldError message={errors.person_name} className="mt-1" />
        </label>
      )}
    </div>
  );
}
