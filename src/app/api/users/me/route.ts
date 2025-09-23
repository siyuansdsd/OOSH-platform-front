import { NextResponse } from "next/server";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error ?? "");

export async function PATCH(req: Request) {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? process.env.API_BASE;
  if (!base) {
    return NextResponse.json(
      { message: "Server not configured (API_BASE)" },
      { status: 500 }
    );
  }

  try {
    const auth = req.headers.get("authorization") ?? undefined;
    const body = await req.text();
    const res = await fetch(`${base}/api/users/me`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...(auth ? { Authorization: auth } : {}),
      },
      cache: "no-store",
      body,
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
      { status: 500 }
    );
  }
}
