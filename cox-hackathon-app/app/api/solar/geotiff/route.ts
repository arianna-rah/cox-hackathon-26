// Server-side proxy that streams a Google Solar GeoTIFF layer back to the
// browser with the server key attached. Streaming (not buffering) is critical:
// buffering the full raster into memory before responding easily exceeds
// Vercel's serverless timeout for three parallel downloads.
// Public CDN caching means the second request for the same tile is instant.

// Allow up to 60 s on Vercel Pro; no-op on Hobby (still 10 s there).
export const maxDuration = 60;

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
    // Stream upstream.body directly — never buffer the full raster.
    // The CDN caches this for 24 h (s-maxage) so identical tile requests
    // are served from the edge without touching the serverless function.
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "image/tiff",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
