import { NextResponse } from "next/server";

function toAbsolute(href: string, base: string) {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

function extractPreviewImage(html: string, base: string) {
  const metas = [
    /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image:src["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  ];
  for (const re of metas) {
    const m = html.match(re);
    if (m?.[1]) return toAbsolute(m[1], base);
  }
  const firstImg = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)?.[1];
  if (firstImg) return toAbsolute(firstImg, base);
  return "";
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ image: "" }, { status: 200 });
    }
    const res = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    const contentType = res.headers.get("content-type") || "";
    if (/^image\//i.test(contentType)) {
      return NextResponse.json({ image: url });
    }
    const html = await res.text();
    const image = extractPreviewImage(html, url);
    return NextResponse.json({ image });
  } catch {
    return NextResponse.json({ image: "" }, { status: 200 });
  }
}
