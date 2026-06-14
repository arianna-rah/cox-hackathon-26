// Proxies the FastAPI backend SSE stream GET /api/analyze/stream (server-side).
// Passes the upstream event-stream body straight through to the browser.

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET(request: Request) {
  const { search } = new URL(request.url);
  try {
    const upstream = await fetch(`${API_URL}/api/analyze/stream${search}`, {
      headers: { Accept: "text/event-stream" },
    });
    if (!upstream.ok || !upstream.body) {
      return new Response("upstream error", { status: 502 });
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    // Backend down — client falls back to hardcoded timed messages.
    return new Response(`backend unreachable: ${String(e)}`, { status: 502 });
  }
}
