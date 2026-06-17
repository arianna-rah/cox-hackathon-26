// Server-side proxy for the Google Solar dataLayers API. Returns the GeoTIFF
// layer URLs (DSM height model, RGB aerial imagery, building mask) for a point.
// GOOGLE_SOLAR_KEY is read here only and never exposed to the browser.

export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  // Tile half-size in meters. ~30m keeps the target building centred and the
  // raster small (~120px at 0.5 m/px) while still capturing the whole footprint.
  const radius = searchParams.get("radius") ?? "30";
  const key = process.env.GOOGLE_SOLAR_KEY;

  if (!key) {
    return Response.json(
      { error: "GOOGLE_SOLAR_KEY not configured" },
      { status: 501 },
    );
  }
  if (!lat || !lng) {
    return Response.json(
      { error: "lat and lng query params are required" },
      { status: 400 },
    );
  }

  const url =
    `https://solar.googleapis.com/v1/dataLayers:get` +
    `?location.latitude=${lat}&location.longitude=${lng}` +
    `&radiusMeters=${radius}` +
    `&view=FULL_LAYERS&requiredQuality=LOW&pixelSizeMeters=0.5&key=${key}`;

  try {
    const upstream = await fetch(url);
    const data = await upstream.text();
    return new Response(data, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
