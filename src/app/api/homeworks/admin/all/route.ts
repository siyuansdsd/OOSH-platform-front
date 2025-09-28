import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error ?? "");

export async function GET(req: NextRequest) {
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE ?? process.env.API_BASE;
    if (!base) {
      return NextResponse.json(
        { message: "Server not configured (API_BASE)" },
        { status: 500 },
      );
    }

    // Build the backend URL for /api/homeworks/admin/all
    const remoteUrl = new URL("/api/homeworks/admin/all", base);

    const authHeader = req.headers.get("authorization") || undefined;
    const res = await fetch(remoteUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      cache: "no-store",
    });

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { message: errorMessage(error) || "Proxy failed" },
      { status: 500 },
    );
  }
}