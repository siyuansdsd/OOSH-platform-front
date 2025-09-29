import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error ?? "");

function buildRemoteUrl(req: NextRequest, base: string) {
  const incoming = new URL(req.url);
  const target = new URL("/api/homeworks/has/urls", base);
  incoming.searchParams.forEach((value, key) => {
    if (value !== undefined && value !== null) {
      target.searchParams.append(key, value);
    }
  });
  return target;
}

export async function GET(req: NextRequest) {
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE ?? process.env.API_BASE;
    if (!base) {
      return NextResponse.json(
        { message: "Server not configured (API_BASE)" },
        { status: 500 },
      );
    }

    const remoteUrl = buildRemoteUrl(req, base);
    const authHeader = req.headers.get("authorization") ?? undefined;
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

export async function POST(req: Request) {
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE ?? process.env.API_BASE;
    if (!base) {
      return NextResponse.json(
        { message: "Server not configured (API_BASE)" },
        { status: 500 },
      );
    }
    const authHeader = req.headers.get("authorization") ?? undefined;
    const json = await req.json().catch(() => ({}));
    const res = await fetch(`${base}/api/homeworks/has/urls`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(json),
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
