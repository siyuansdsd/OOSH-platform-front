import { NextResponse } from "next/server";

const ALLOWED_ACTIONS = new Set([
  "register",
  "login",
  "admin-login",
  "refresh",
  "logout",
  "hubspot-login",
]);

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error ?? "");

export async function POST(
  req: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ message: "Not Found" }, { status: 404 });
  }

  const base = process.env.NEXT_PUBLIC_API_BASE ?? process.env.API_BASE;
  if (!base) {
    return NextResponse.json(
      { message: "Server not configured (API_BASE)" },
      { status: 500 },
    );
  }

  try {
    const target = new URL(`/api/users/${action}`, base);
    const headers: Record<string, string> = {};
    const contentType = req.headers.get("content-type");
    if (contentType) headers["content-type"] = contentType;
    const auth = req.headers.get("authorization");
    if (auth) headers.Authorization = auth;

    const init: RequestInit = {
      method: "POST",
      headers,
      cache: "no-store",
      body: await req.text(),
    };

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
      { message: errorMessage(error) || "Proxy failed" },
      { status: 500 },
    );
  }
}
