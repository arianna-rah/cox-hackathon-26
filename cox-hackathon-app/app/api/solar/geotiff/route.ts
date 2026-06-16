// Server-side proxy that downloads a Google Solar GeoTIFF layer with the
// server key attached. The browser can't fetch these URLs directly (the key
// must stay private), so it passes the layer URL here and we stream the bytes
// back same-origin. Host is allow-listed to prevent SSRF / key exfiltration.

export const dynamic = "force-dynamic";

const ALLOWED_HOST = "solar.googleapis.com";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("url");
  const key = process.env.GOOGLE_SOLAR_KEY;

  if (!key) {
    return Response.json({ error: "GOOGLE_SOLAR_KEY not configured" }, { status: 501 });
  }
  if (!raw) {
    return Response.json({ error: "url query param is required" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return Response.json({ error: "invalid url" }, { status: 400 });
  }
  if (target.host !== ALLOWED_HOST) {
    return Response.json({ error: "host not allowed" }, { status: 403 });
  }

  target.searchParams.set("key", key);

  try {
    const upstream = await fetch(target.toString());
    if (!upstream.ok) {
      return Response.json({ error: `upstream ${upstream.status}` }, { status: upstream.status });
    }
    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "image/tiff",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
