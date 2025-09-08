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
  const [members, setMembers] = useState("");
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
        e[key] = `${label} 是必填项`;
      } else if (!EN_NAME.test(val)) {
        e[key] = `${label} 仅允许英文与空格，不允许标点`;
      }
    };
    check("schoolName", schoolName, "学校名称");
    if (is_team) {
      check("groupName", groupName, "队伍名称");
      check("members", members, "队伍成员");
    } else {
      check("person_name", person_name, "个人姓名");
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    setServerError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      // Prepare payload: send metadata only; backend may return presigned URLs
      const payload = {
        schoolName,
        groupName: is_team ? groupName : undefined,
        is_team,
        members: is_team ? members : undefined,
        person_name: !is_team ? person_name : undefined,
        mode,
        fileMetas:
          mode === "file"
            ? files.map((f) => ({
                filename: f.name,
                contentType: f.type,
                size: f.size,
              }))
            : [],
        urls: mode === "url" ? urls.filter((u) => u.trim()) : [],
      };

      const res = await fetch("/api/uploads/create-and-presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      setSuccess(true);
    } catch (err: any) {
      setServerError(err?.message || "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-emerald-700">
        <div className="flex items-center gap-3">
          <span className="text-xl">✅</span>
          <div className="font-medium">上传成功</div>
        </div>
        <div className="mt-2 text-sm text-emerald-700/80">
          感谢提交，我们已收到您的内容。
        </div>
      </div>
    );
  }

  return (
    <UploadContext.Provider value={ctxValue}>
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-3xl border border-foreground/10 bg-white/5 p-6 backdrop-blur-md">
          <h2 className="text-xl font-semibold mb-4">内容上传</h2>

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
              提交
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
        <div className="mb-1 text-sm text-foreground/80">学校名称</div>
        <input
          value={schoolName}
          onChange={(e) => setSchoolName(e.target.value)}
          disabled={disabled}
          className={baseInput}
          placeholder="请输入学校英文名"
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
          <span className="text-sm">团队提交</span>
        </label>
      </div>

      {is_team ? (
        <>
          <label className="block">
            <div className="mb-1 text-sm text-foreground/80">队伍名称</div>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              disabled={disabled}
              className={baseInput}
              placeholder="请输入队伍英文名"
            />
            {errors.groupName && (
              <p className="mt-1 text-xs text-red-500">{errors.groupName}</p>
            )}
          </label>
          <label className="block">
            <div className="mb-1 text-sm text-foreground/80">成员</div>
            <input
              value={members}
              onChange={(e) => setMembers(e.target.value)}
              disabled={disabled}
              className={baseInput}
              placeholder="请输入成员英文名（可用空格分隔）"
            />
            {errors.members && (
              <p className="mt-1 text-xs text-red-500">{errors.members}</p>
            )}
          </label>
        </>
      ) : (
        <label className="block">
          <div className="mb-1 text-sm text-foreground/80">个人姓名</div>
          <input
            value={person_name}
            onChange={(e) => setPersonName(e.target.value)}
            disabled={disabled}
            className={baseInput}
            placeholder="请输入英文名"
          />
          {errors.person_name && (
            <p className="mt-1 text-xs text-red-500">{errors.person_name}</p>
          )}
        </label>
      )}
    </div>
  );
}
