// Vercel Edge Function — injects runtime config into index.html
// This runs on every request, replacing the placeholder with the real key
export const config = { runtime: "edge" };

export default async function handler(req) {
  const key = process.env.VITE_GROQ_API_KEY || "";
  return new Response(
    JSON.stringify({ groqKey: key }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }
  );
}
