import { NextRequest, NextResponse } from "next/server";

const SUPPORTED_METHODS = new Set(["GET", "POST"]);

function buildRemoteUrl(req: NextRequest, base: string, resource: string) {
  const incoming = new URL(req.url);
  const target = new URL(`/api/admin/${resource}`, base);
  incoming.searchParams.forEach((value, key) => {
    if (value !== undefined && value !== null) {
      target.searchParams.append(key, value);
    }
  });
  return target;
}

export async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ resource: string }> }
) {
  const { resource } = await params;
  if (!SUPPORTED_METHODS.has(req.method)) {
    return NextResponse.json({ message: "Method Not Allowed" }, { status: 405 });
  }

  const base = process.env.NEXT_PUBLIC_API_BASE ?? process.env.API_BASE;
  if (!base) {
    return NextResponse.json(
      { message: "Server not configured (API_BASE)" },
      { status: 500 }
    );
  }

  try {
    const target = buildRemoteUrl(req, base, resource);
    const init: RequestInit = {
      method: req.method,
      headers: { "content-type": req.headers.get("content-type") ?? "application/json" },
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
      { status: 500 }
    );
  }
}

export { handler as GET, handler as POST };
