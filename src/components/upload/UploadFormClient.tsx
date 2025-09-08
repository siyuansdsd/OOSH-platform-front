"use client";

import React, { useMemo, useState } from "react";
import UploadTypeSelector from "./UploadTypeSelector";
import FileDropzone from "./FileDropzone";
import UrlUploader from "./UrlUploader";
import { Spinner } from "../ui/Spinner";
import {
  UploadContext,
  type ValidationErrors,
  type UploadMode,
} from "./UploadContext";

const EN_NAME = /^[A-Za-z ]+$/;

export default function UploadFormClient() {
  const [mode, setMode] = useState<UploadMode>("file");
  const [files, setFiles] = useState<File[]>([]);
  const [urls, setUrls] = useState<string[]>([""]);

  const [schoolName, setSchoolName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [is_team, setIsTeam] = useState(false);
  const [members, setMembers] = useState<string[]>([""]);
  const [person_name, setPersonName] = useState("");

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

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
      errors,
      files,
      groupName,
      is_team,
      members,
      mode,
      person_name,
      schoolName,
      submitting,
      urls,
    ]
  );

  const validate = (): boolean => {
    const e: ValidationErrors = {};
    const check = (key: string, val: string, label: string) => {
      if (!val) {
        e[key] = `${label} is required`;
      } else if (!EN_NAME.test(val)) {
        e[key] = `${label} must be English letters and spaces only`;
      }
    };
    check("schoolName", schoolName, "School Name");
    // Require at least one content entry
    if (mode === "file") {
      if (!files.length) {
        e.files = "Please add at least one image or video";
      }
    } else {
      const cleaned = urls.map((u) => u.trim()).filter(Boolean);
      if (!cleaned.length) {
        e.urls = "Please add at least one URL";
      }
    }
    if (is_team) {
      check("groupName", groupName, "Team Name");
      members.forEach((m, idx) => {
        if (!m) {
          e[`members_${idx}`] = `Member ${idx + 1} is required`;
        } else if (!EN_NAME.test(m)) {
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
      // Build multipart form data per backend contract
      const form = new FormData();
      if (schoolName) form.append("schoolName", schoolName.trim());
      if (is_team && groupName) form.append("groupName", groupName.trim());
      if (is_team) {
        members.forEach((m) => {
          const v = m.trim();
          if (v) form.append("members[]", v);
        });
      } else if (person_name.trim()) {
        // Optional: include person_name for backend to use or ignore
        form.append("person_name", person_name.trim());
      }

      if (mode === "file") {
        files.forEach((f) => form.append("files", f, f.name));
      } else {
        urls
          .map((u) => u.trim())
          .filter(Boolean)
          .forEach((u) => form.append("urls[]", u));
      }

      const res = await fetch("/api/uploads/create-and-presign", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = text || `HTTP ${res.status}`;
        try {
          const obj = JSON.parse(text);
          msg = obj?.message || obj?.error || msg;
        } catch {}
        throw new Error(msg);
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
        <div className="rounded-3xl border border-foreground/10 bg-white/5 p-6 backdrop-blur-md">
          <h2 className="text-xl font-semibold mb-4">Content Upload</h2>

          {/* Selector */}
          <div className="mb-6">
            <UploadTypeSelector />
          </div>

          {/* Conditional UIs */}
          {mode === "file" ? (
            <div className="mb-6">
              <FileDropzone />
            </div>
          ) : (
            <div className="mb-6">
              <UrlUploader />
            </div>
          )}

          {/* Content errors */}
          {errors.files && (
            <p className="-mt-4 mb-4 text-xs text-red-500">{errors.files}</p>
          )}
          {errors.urls && (
            <p className="-mt-4 mb-4 text-xs text-red-500">{errors.urls}</p>
          )}

          {/* Traditional Fields */}
          <TraditionalFields />

          {/* Error Banner */}
          {serverError ? (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-600">
              {serverError}
            </div>
          ) : null}

          {/* Submit */}
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-white font-medium shadow-lg shadow-blue-600/20 transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
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
        <div className="mb-1 text-sm text-foreground/80">School Name</div>
        <input
          value={schoolName}
          onChange={(e) => setSchoolName(e.target.value)}
          onBlur={(e) => setSchoolName(e.target.value.trim())}
          disabled={disabled}
          className={baseInput}
          placeholder="Enter school name (English only)"
        />
        {errors.schoolName && (
          <p className="mt-1 text-xs text-red-500">{errors.schoolName}</p>
        )}
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
            {errors.groupName && (
              <p className="mt-1 text-xs text-red-500">{errors.groupName}</p>
            )}
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
              {members.map((_, idx) =>
                errors[`members_${idx}`] ? (
                  <p key={idx} className="text-xs text-red-500">
                    {errors[`members_${idx}`]}
                  </p>
                ) : null
              )}
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
          {errors.person_name && (
            <p className="mt-1 text-xs text-red-500">{errors.person_name}</p>
          )}
        </label>
      )}
    </div>
  );
}
