import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE ?? process.env.API_BASE;
    if (!base) {
      return NextResponse.json(
        { message: "Server not configured (API_BASE)" },
        { status: 500 }
      );
    }
    // Forward multipart/form-data as-is
    const contentType = req.headers.get("content-type") || undefined;
    const res = await fetch(`${base}/api/uploads/create-and-presign`, {
      method: "POST",
      headers: contentType ? { "content-type": contentType } : undefined,
      body: req.body,
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message || "Proxy failed" },
      { status: 500 }
    );
  }
}
