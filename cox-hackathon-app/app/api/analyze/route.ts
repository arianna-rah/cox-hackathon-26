// Proxies the FastAPI backend POST /api/analyze (server-side).
// The browser never talks to the backend directly.

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(request: Request) {
  const body = await request.text();
  try {
    const upstream = await fetch(`${API_URL}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await upstream.text();
    return new Response(data, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    // Backend unreachable — client falls back to local scoring.
    return Response.json(
      { error: `Backend unreachable: ${String(e)}` },
      { status: 502 },
    );
  }
}
