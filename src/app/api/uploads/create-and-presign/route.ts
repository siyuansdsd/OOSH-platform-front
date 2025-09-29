import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE ?? process.env.API_BASE;
    if (!base) {
      return NextResponse.json(
        { message: "Server not configured (API_BASE)" },
        { status: 500 },
      );
    }
    const contentType = req.headers.get("content-type") || "";
    const authHeader = req.headers.get("authorization") || undefined;
    let res: Response;
    if (contentType.includes("application/json")) {
      // Presign flow: forward JSON as-is
      const json = await req.json().catch(() => ({}));
      res = await fetch(`${base}/api/uploads/create-and-presign`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify(json),
      });
    } else {
      // File mode: forward multipart/form-data as-is
      const uploadInit: RequestInit & { duplex: "half" } = {
        method: "POST",
        headers: contentType
          ? {
              "content-type": contentType,
              ...(authHeader ? { Authorization: authHeader } : {}),
            }
          : authHeader
            ? { Authorization: authHeader }
            : undefined,
        body: req.body,
        duplex: "half",
      };
      res = await fetch(`${base}/api/uploads/create-and-presign`, uploadInit);
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
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return new NextResponse(text, {
        status: res.status,
        headers: { "content-type": ctype || "application/json" },
      });
    }

    const pickFirst = <T>(
      ...vals: Array<T | null | undefined>
    ): T | undefined =>
      vals.find((value) => value !== undefined && value !== null);

    type UnknownRecord = Record<string, unknown>;
    const asRecord = (value: unknown): UnknownRecord | null =>
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as UnknownRecord)
        : null;

    const roots: unknown[] = [];
    const addRoot = (value: unknown) => {
      if (value !== undefined && value !== null) roots.push(value);
    };

    addRoot(data);
    const extract = (value: unknown, key: string): unknown => {
      const record = asRecord(value);
      if (!record) return undefined;
      return record[key];
    };

    addRoot(extract(data, "data"));
    addRoot(extract(data, "result"));
    addRoot(extract(data, "payload"));

    const getFromRoots = (key: string): unknown =>
      pickFirst(...roots.map((root) => extract(root, key)));

    const homeworkObj = asRecord(getFromRoots("homework"));
    const homeworkId = pickFirst(
      getFromRoots("homeworkId"),
      getFromRoots("homework_id"),
      extract(homeworkObj, "id"),
      getFromRoots("id"),
    );

    const looksLikePresign = (value: unknown): value is UnknownRecord =>
      !!value &&
      typeof value === "object" &&
      [
        "uploadUrl",
        "presignedUrl",
        "presigned_url",
        "fileUrl",
        "publicUrl",
        "location",
        "filename",
        "contentType",
      ].some((key) => key in (value as UnknownRecord));

    const toArray = (input: unknown): unknown[] => {
      if (!input) return [];
      if (Array.isArray(input)) return input;
      if (typeof input === "object") return Object.values(input);
      return [input];
    };

    const presigns = pickFirst(
      getFromRoots("presigns"),
      getFromRoots("presign"),
      getFromRoots("signed"),
      getFromRoots("signedUrls"),
      getFromRoots("signed_urls"),
      getFromRoots("files"),
      getFromRoots("file"),
      getFromRoots("items"),
    );
    let presignsArr = toArray(presigns);
    if (presignsArr.length === 0) {
      // data itself may be the presign object
      const d = getFromRoots("data");
      if (looksLikePresign(d)) presignsArr = [d];
    }
    if (presignsArr.length === 0) {
      const candidate = roots.find((value) => looksLikePresign(value));
      if (candidate) presignsArr = [candidate];
    }
    if (presignsArr.length === 0) {
      const arrayRoot = roots.find((value) => Array.isArray(value)) as
        | unknown[]
        | undefined;
      if (arrayRoot?.some((item) => looksLikePresign(item))) {
        presignsArr = arrayRoot.filter((item) => looksLikePresign(item));
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
      { status: res.status },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Proxy failed";
    return NextResponse.json({ message }, { status: 500 });
  }
}
