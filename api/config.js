// Vercel Edge Function — serves runtime AI config
// Edge runtime reads env vars directly (no import.meta.env)
export const config = { runtime: "edge" };

export default async function handler(req) {
  // In Vercel Edge Runtime, env vars are accessed via process.env
  // The var name must match EXACTLY what's set in Vercel Project Settings
  const key = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || "";

  return new Response(
    JSON.stringify({ groqKey: key }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
