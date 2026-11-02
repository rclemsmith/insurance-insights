/**
 * Cloudflare Pages Function: /api/insights
 * Proxies Clarity API requests securely using Cloudflare Environment Variables.
 */

export async function onRequestGet(context) {
  const token = context.env.CLARITY_API_TOKEN;
  if (!token) {
    return new Response(
      JSON.stringify({ error: "CLARITY_API_TOKEN environment variable is not configured in Cloudflare Pages." }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }

  const { search } = new URL(context.request.url);
  const targetUrl = `https://www.clarity.ms/export-data/api/v1/project-live-insights${search}`;

  try {
    const res = await fetch(targetUrl, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "Emerson-Insurance-Dashboard/1.0"
      }
    });

    const data = await res.text();
    return new Response(data, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
}
