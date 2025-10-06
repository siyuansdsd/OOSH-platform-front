"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import UrlUploader from "@/components/upload/UrlUploader";
import { APPROVED_SCHOOLS, type ApprovedSchool } from "@/constants/schools";
import { Spinner } from "../ui/Spinner";
import FileDropzone from "./FileDropzone";
import {
  UploadContext,
  type UploadMode,
  type ValidationErrors,
} from "./UploadContext";
import UploadTypeSelector from "./UploadTypeSelector";

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
  const [schoolName, setSchoolName] = useState<ApprovedSchool | "">("");
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
      errors,
      setErrors,
      disabled: submitting,
    }),
    [mode, files, urls, schoolName, errors, submitting],
  );

  const validate = (): boolean => {
    const e: ValidationErrors = {};
    if (!schoolName) {
      e.schoolName = "Select a school from the list";
    }

    if (mode === "file") {
      if (!files.length) e.files = "Please add at least one image or video";
    } else {
      const cleaned = urls.map((u) => u.trim()).filter(Boolean);
      if (!cleaned.length) e.urls = "Please add at least one URL";
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
        if (!accessToken) throw new Error("Not authenticated");

        const presignRes = await fetch("/api/uploads/create-and-presign", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            files: files.map((f) => ({
              filename: f.name,
              contentType: f.type,
            })),
            schoolName: schoolName.trim(),
            mode,
          }),
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
        // biome-ignore lint/suspicious/noExplicitAny: backend response shape varies across deployments
        const raw: any = await presignRes.json().catch(() => {
          try {
            return rawText ? JSON.parse(rawText) : {};
          } catch {
            return {};
          }
        });
        // Robust extractor: handles single-object, arrays, maps, and various envelope keys
        // biome-ignore lint/suspicious/noExplicitAny: helper must accept mixed payload structures
        const pickFirst = (...vals: any[]) =>
          vals.find((v) => v !== undefined && v !== null);
        const roots = [raw, raw?.data, raw?.result, raw?.payload];
        const getFromRoots = (key: string) =>
          pickFirst(
            ...roots.map((r) =>
              r && typeof r === "object" ? r[key] : undefined,
            ),
          );
        const homeworkObj = pickFirst(getFromRoots("homework"));
        const homeworkId = pickFirst(
          getFromRoots("homeworkId"),
          getFromRoots("homework_id"),
          homeworkObj?.id,
          getFromRoots("id"),
        );
        // biome-ignore lint/suspicious/noExplicitAny: dynamic API payloads require flexible parsing
        const presignsAny: any = pickFirst(
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
          })(),
        );
        // biome-ignore lint/suspicious/noExplicitAny: casting heterogeneous payloads to arrays
        const toArray = (v: any): any[] => {
          if (!v) return [];
          if (Array.isArray(v)) return v;
          if (typeof v === "object") return Object.values(v);
          return [v];
        };
        let presignsArr = toArray(presignsAny);
        // Helper to recognize presign-ish objects
        // biome-ignore lint/suspicious/noExplicitAny: type guard for unknown presign shapes
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
          if (candidate)
            presignsArr = [
              // biome-ignore lint/suspicious/noExplicitAny: dynamic API payloads
              candidate as any,
            ];
        }
        // Fallback: arrays at root or envelopes
        if (presignsArr.length === 0) {
          const arrayRoot = roots.find((r) => Array.isArray(r)) as
            // biome-ignore lint/suspicious/noExplicitAny: dynamic API payloads
            any[] | undefined;
          if (arrayRoot?.some((it) => looksLikePresign(it))) {
            presignsArr = arrayRoot.filter((it) => looksLikePresign(it));
          }
        }
        if (presignsArr.length === 0) {
          for (const k of ["data", "result", "payload"]) {
            const arr = (raw as Record<string, unknown>)?.[k] as unknown;
            if (
              Array.isArray(arr) &&
              arr.some((it: unknown) => looksLikePresign(it))
            ) {
              presignsArr = arr.filter((it: unknown) => looksLikePresign(it));
              break;
            }
          }
        }
        if (!homeworkId || presignsArr.length === 0) {
          const snippet = (rawText || "").slice(0, 200);
          throw new Error(
            `No presigns returned${snippet ? `: ${snippet}` : ""}`,
          );
        }

        // Upload to S3
        await Promise.all(
          // biome-ignore lint/suspicious/noExplicitAny: presign entries are dynamic objects
          presignsArr.map(async (p: any) => {
            const f = files.find((x) => x.name === p.filename);
            if (!f || !p?.uploadUrl) return;
            const put = await fetch(p.uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": p.contentType || f.type },
              body: f,
            });
            if (!put.ok) throw new Error(`Upload failed for ${p.filename}`);
          }),
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
        // biome-ignore lint/suspicious/noExplicitAny: presign entries are dynamic objects
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
        // biome-ignore lint/suspicious/noExplicitAny: presign entries are dynamic objects
        const pairs = presignsArr.map((p: any, i: number) => {
          const byName = files.find((x) => x.name === p.filename) || null;
          const file = byName ?? files[i] ?? files[0] ?? null;
          const nameForExt = String(p?.filename || file?.name || "");
          const ctype = String(p?.contentType || file?.type || "");
          const img =
            ctype?.startsWith("image/") || imgExt.has(getExt(nameForExt));
          const vid =
            ctype?.startsWith("video/") || vidExt.has(getExt(nameForExt));
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
              school_name: schoolName.trim(),
            }),
          },
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
        const payload = {
          school_name: schoolName.trim(),
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
      setFiles([]);
      setUrls([""]);
      setSchoolName("");
      setErrors({});
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Submit failed");
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
          <h2 className="mb-4 text-xl font-semibold">Content Upload</h2>
          <div className="space-y-6">
            <div>
              <UploadTypeSelector />
            </div>

            <label className="block">
              <div className="mb-1 text-sm text-foreground/80">School Name</div>
              <select
                value={schoolName}
                onChange={(e) =>
                  setSchoolName(e.target.value as ApprovedSchool | "")
                }
                disabled={submitting}
                className="w-full rounded-xl border border-foreground/15 bg-white/70 px-4 py-3 outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:bg-black/20"
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

            {mode === "file" ? (
              <>
                <FileDropzone />
                <FieldError message={errors.files} />
              </>
            ) : (
              <>
                <UrlUploader />
                <FieldError message={errors.urls} />
              </>
            )}

            {serverError ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-600">
                {serverError}
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="btn-gradient rounded-xl px-5 py-2.5 text-sm font-semibold text-foreground transition disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-200/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Submit
              </button>
              {submitting && <Spinner label="Uploading..." />}
            </div>
          </div>
        </div>
      </div>
    </UploadContext.Provider>
  );
}
