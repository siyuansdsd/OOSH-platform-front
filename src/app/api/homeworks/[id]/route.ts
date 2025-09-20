import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error ?? "");

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE ?? process.env.API_BASE;
    if (!base) {
      return NextResponse.json(
        { message: "Server not configured (API_BASE)" },
        { status: 500 },
      );
    }
    const { id } = await params;
    const json = await req.json().catch(() => ({}));
    const res = await fetch(`${base}/api/homeworks/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
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
