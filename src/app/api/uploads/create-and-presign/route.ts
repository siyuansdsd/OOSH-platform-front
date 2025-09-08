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
    const contentType = req.headers.get("content-type") || "";
    let res: Response;
    if (contentType.includes("application/json")) {
      // Presign flow: forward JSON as-is
      const json = await req.json().catch(() => ({}));
      res = await fetch(`${base}/api/uploads/create-and-presign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(json),
      });
    } else {
      // File mode: forward multipart/form-data as-is
      res = await fetch(
        `${base}/api/uploads/create-and-presign`,
        {
          method: "POST",
          headers: contentType ? { "content-type": contentType } : undefined,
          body: req.body,
          // req.body is a ReadableStream; undici requires duplex: 'half'
          duplex: "half" as any,
        } as any
      );
    }
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
