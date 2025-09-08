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
      // URL mode: transform URLs into files on the server side
      const data = await req.json().catch(() => ({} as any));
      const form = new FormData();
      if (data.schoolName) form.append("schoolName", String(data.schoolName));
      if (data.groupName) form.append("groupName", String(data.groupName));
      if (Array.isArray(data.members)) {
        for (const m of data.members) form.append("members[]", String(m));
      }
      if (data.person_name)
        form.append("person_name", String(data.person_name));
      const urls: string[] = Array.isArray(data.urls) ? data.urls : [];
      // Fetch each URL and append as a file
      await Promise.all(
        urls.map(async (u, i) => {
          try {
            const r = await fetch(u);
            const ct =
              r.headers.get("content-type") || "application/octet-stream";
            const blob = await r.blob();
            const ext = ct.split("/")[1] || "bin";
            const fname = `url_${i + 1}.${ext}`;
            form.append("files", new File([blob], fname, { type: ct }), fname);
          } catch {
            // Ignore failed URL; backend will handle if no files
          }
        })
      );
      res = await fetch(`${base}/api/uploads/create-and-presign`, {
        method: "POST",
        body: form,
      });
    } else {
      // File mode: forward multipart/form-data as-is
      res = await fetch(`${base}/api/uploads/create-and-presign`, {
        method: "POST",
        headers: contentType ? { "content-type": contentType } : undefined,
        body: req.body,
      });
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
