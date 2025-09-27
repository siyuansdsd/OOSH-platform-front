import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error ?? "");

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE ?? process.env.API_BASE;
    if (!base) {
      return NextResponse.json(
        { message: "Server not configured (API_BASE)" },
        { status: 500 }
      );
    }
    const { id } = await params;
    const json = await req.json().catch(() => ({}));
    const authHeader = req.headers.get("authorization") || undefined;
    const res = await fetch(`${base}/api/homeworks/${encodeURIComponent(id)}`, {
      method: "PUT",
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
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE ?? process.env.API_BASE;
    if (!base) {
      return NextResponse.json(
        { message: "Server not configured (API_BASE)" },
        { status: 500 }
      );
    }
    const { id } = await params;
    const authHeader = req.headers.get("authorization") || undefined;
    const res = await fetch(`${base}/api/homeworks/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    // If the backend returned No Content (204) or empty body, don't call text()/json()
    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    // Try to read text body safely; if none, forward status only
    const contentType = res.headers.get("content-type");
    const text = await res.text().catch(() => "");
    if (!text) {
      return new NextResponse(null, { status: res.status });
    }

    return new NextResponse(text, {
      status: res.status,
      headers: {
        "content-type": contentType ?? "application/json",
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : String(error ?? "") || "Proxy failed",
      },
      { status: 500 }
    );
  }
}
