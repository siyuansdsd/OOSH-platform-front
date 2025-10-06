"use client";

import { createContext, useContext } from "react";
import type { ApprovedSchool } from "@/constants/schools";

export type UploadMode = "file" | "url";

export type ValidationErrors = Record<string, string | undefined>;

export interface UploadContextType {
  mode: UploadMode;
  setMode: (m: UploadMode) => void;
  files: File[];
  setFiles: (f: File[]) => void;
  urls: string[];
  setUrls: (u: string[]) => void;
  schoolName: ApprovedSchool | "";
  setSchoolName: (v: ApprovedSchool | "") => void;
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
