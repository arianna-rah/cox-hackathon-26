// Server-side proxy for the Google Solar API. GOOGLE_SOLAR_KEY is read here
// only and never exposed to the browser (no NEXT_PUBLIC_ prefix).

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
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
    `https://solar.googleapis.com/v1/buildingInsights:findClosest` +
    `?location.latitude=${lat}&location.longitude=${lng}` +
    `&requiredQuality=LOW&key=${key}`;

  try {
    const upstream = await fetch(url);
    const data = await upstream.text();
    return new Response(data, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
