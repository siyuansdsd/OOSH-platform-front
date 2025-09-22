import { type NextRequest, NextResponse } from "next/server";

const SUPPORTED_METHODS = new Set(["GET", "PUT", "PATCH", "DELETE"]);

export async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ resource: string; id: string }> },
) {
  const { resource, id } = await params;
  if (!SUPPORTED_METHODS.has(req.method)) {
    return NextResponse.json(
      { message: "Method Not Allowed" },
      { status: 405 },
    );
  }

  const base = process.env.NEXT_PUBLIC_API_BASE ?? process.env.API_BASE;
  if (!base) {
      return NextResponse.json(
        { message: "Server not configured (API_BASE)" },
        { status: 500 },
      );
  }

  try {
    const target = new URL(`/api/admin/${resource}/${encodeURIComponent(id)}`, base);
    const authHeader = req.headers.get("authorization") || undefined;
    const init: RequestInit = {
      method: req.method,
      headers: {
        "content-type": req.headers.get("content-type") ?? "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      cache: "no-store",
    };
    if (req.method !== "GET") {
      const body = await req.text();
      init.body = body;
    }

    const res = await fetch(target, init);
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Proxy failed" },
      { status: 500 },
    );
  }
}

export { handler as GET, handler as PUT, handler as PATCH, handler as DELETE };
