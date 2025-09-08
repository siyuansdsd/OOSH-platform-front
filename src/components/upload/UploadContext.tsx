"use client";

import React, { createContext, useContext } from "react";

export type UploadMode = "file" | "url";

export type ValidationErrors = Record<string, string | undefined>;

export interface UploadContextType {
  mode: UploadMode;
  setMode: (m: UploadMode) => void;
  files: File[];
  setFiles: (f: File[]) => void;
  urls: string[];
  setUrls: (u: string[]) => void;
  schoolName: string;
  setSchoolName: (v: string) => void;
  groupName: string;
  setGroupName: (v: string) => void;
  is_team: boolean;
  setIsTeam: (v: boolean) => void;
  members: string[];
  setMembers: (v: string[]) => void;
  person_name: string;
  setPersonName: (v: string) => void;
  errors: ValidationErrors;
  setErrors: (e: ValidationErrors) => void;
  disabled: boolean;
}

export const UploadContext = createContext<UploadContextType | null>(null);

export function useUploadCtx() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("UploadContext not found");
  return ctx;
}
