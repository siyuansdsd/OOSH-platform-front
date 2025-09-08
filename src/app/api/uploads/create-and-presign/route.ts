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
      res = await fetch(`${base}/api/uploads/create-and-presign`, {
        method: "POST",
        headers: contentType ? { "content-type": contentType } : undefined,
        body: req.body,
        // req.body is a ReadableStream; undici requires duplex: 'half'
        duplex: "half" as any,
      } as any);
    }
    const text = await res.text();
    const ctype = res.headers.get("content-type") || "";
    // If upstream isn't JSON or not OK, just pass through
    if (!res.ok || !/application\/json/i.test(ctype)) {
      return new NextResponse(text, {
        status: res.status,
        headers: { "content-type": ctype || "application/json" },
      });
    }
    // Try to normalize to a stable shape: { homeworkId, presigns: [...] }
    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return new NextResponse(text, {
        status: res.status,
        headers: { "content-type": ctype || "application/json" },
      });
    }

    const pickFirst = (...vals: any[]) => vals.find((v) => v !== undefined && v !== null);
    const roots = [data, data?.data, data?.result, data?.payload];
    const getFromRoots = (key: string) =>
      pickFirst(
        ...roots.map((r) => (r && typeof r === "object" ? (r as any)[key] : undefined))
      );

    const homeworkObj = pickFirst(getFromRoots("homework"));
    const homeworkId = pickFirst(
      getFromRoots("homeworkId"),
      getFromRoots("homework_id"),
      homeworkObj?.id,
      getFromRoots("id")
    );

    const looksLikePresign = (o: any) =>
      o &&
      typeof o === "object" &&
      [
        "uploadUrl",
        "presignedUrl",
        "presigned_url",
        "fileUrl",
        "publicUrl",
        "location",
        "filename",
        "contentType",
      ].some((k) => k in o);

    const toArray = (v: any): any[] => {
      if (!v) return [];
      if (Array.isArray(v)) return v;
      if (typeof v === "object") return Object.values(v);
      return [v];
    };

    let presigns: any = pickFirst(
      getFromRoots("presigns"),
      getFromRoots("presign"),
      getFromRoots("signed"),
      getFromRoots("signedUrls"),
      getFromRoots("signed_urls"),
      getFromRoots("files"),
      getFromRoots("file"),
      getFromRoots("items")
    );
    let presignsArr = toArray(presigns);
    if (presignsArr.length === 0) {
      // data itself may be the presign object
      const d = getFromRoots("data");
      if (looksLikePresign(d)) presignsArr = [d];
    }
    if (presignsArr.length === 0) {
      const candidate = roots.find((r) => looksLikePresign(r));
      if (candidate) presignsArr = [candidate as any];
    }
    if (presignsArr.length === 0) {
      const arrayRoot = roots.find((r) => Array.isArray(r)) as any[] | undefined;
      if (arrayRoot && arrayRoot.some((it) => looksLikePresign(it))) {
        presignsArr = arrayRoot.filter((it) => looksLikePresign(it));
      }
    }

    // If normalization failed, pass original upstream response
    if (!homeworkId || presignsArr.length === 0) {
      return new NextResponse(text, {
        status: res.status,
        headers: { "content-type": ctype || "application/json" },
      });
    }

    return NextResponse.json(
      {
        homeworkId,
        presigns: presignsArr,
      },
      { status: res.status }
    );
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message || "Proxy failed" },
      { status: 500 }
    );
  }
}
