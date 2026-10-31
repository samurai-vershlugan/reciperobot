// web-search: returns Google search results for Recipe Robot's Discover screen.
// Uses Serper (https://serper.dev), which serves Google results over a simple API.
// Setup: set the secret SERPER_API_KEY, then deploy this function as "web-search".
//
// Request:  POST { "query": "quick easy chicken Mediterranean dinner recipe", "num": 10 }
// Response: { "results": [ { title, url, site, snippet, image } ] }

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const key = Deno.env.get("SERPER_API_KEY");
  if (!key) return json({ error: "SERPER_API_KEY is not set" }, 500);

  let query = "";
  let num = 10;
  try {
    const body = await req.json();
    query = String(body.query || "").trim();
    if (body.num) num = Math.min(Math.max(Number(body.num) || 10, 1), 20);
  } catch (_) {
    return json({ error: "Body must be JSON: { query }" }, 400);
  }
  if (!query) return json({ error: "query is required" }, 400);

  const resp = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num, gl: "us", hl: "en" }),
  });
  if (!resp.ok) {
    return json({ error: `Search provider error ${resp.status}: ${await resp.text()}` }, 502);
  }
  const data = await resp.json();

  const results = (data.organic || [])
    .filter((r: any) => r && r.link)
    .map((r: any) => {
      let site = "";
      try { site = new URL(r.link).hostname.replace(/^www\./, ""); } catch (_) {}
      return {
        title: r.title || "",
        url: r.link,
        site,
        snippet: r.snippet || "",
        image: r.imageUrl || "",
      };
    });

  return json({ query, results });
});
