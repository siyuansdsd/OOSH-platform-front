import { NextResponse } from "next/server";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error ?? "");

export async function GET(req: Request) {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? process.env.API_BASE;
  if (!base) {
    return NextResponse.json(
      { message: "Server not configured (API_BASE)" },
      { status: 500 }
    );
  }

  try {
    const url = new URL(req.url);
    const remote = new URL("/api/users", base);
    url.searchParams.forEach((value, key) => {
      if (value !== undefined && value !== null) {
        remote.searchParams.append(key, value);
      }
    });
    const auth = req.headers.get("authorization") ?? undefined;
    const res = await fetch(remote, {
      method: "GET",
      headers: {
        accept: "application/json",
        ...(auth ? { Authorization: auth } : {}),
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
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? process.env.API_BASE;
  if (!base) {
    return NextResponse.json(
      { message: "Server not configured (API_BASE)" },
      { status: 500 }
    );
  }

  try {
    const remote = new URL("/api/users", base);
    const auth = req.headers.get("authorization") ?? undefined;
    const contentType = req.headers.get("content-type");

    const res = await fetch(remote, {
      method: "POST",
      headers: {
        accept: "application/json",
        ...(contentType ? { "content-type": contentType } : {}),
        ...(auth ? { Authorization: auth } : {}),
      },
      body: await req.text(),
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
      { status: 500 }
    );
  }
}
