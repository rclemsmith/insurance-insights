/**
 * Cloudflare Pages Function: /api/status
 * Returns whether CLARITY_API_TOKEN is set in Cloudflare Environment Variables.
 */

export async function onRequestGet(context) {
  const isSet = Boolean(context.env.CLARITY_API_TOKEN);
  return new Response(
    JSON.stringify({ tokenConfigured: isSet }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    }
  );
}
