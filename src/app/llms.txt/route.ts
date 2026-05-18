import { getPublicLlmsTxtContent } from "@/lib/seo/llms";

const CACHE_CONTROL_VALUE = "public, max-age=300, stale-while-revalidate=86400";

export async function GET() {
  try {
    const content = await getPublicLlmsTxtContent();

    if (content === null) {
      return new Response("Not Found", {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": CACHE_CONTROL_VALUE,
        },
      });
    }

    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": CACHE_CONTROL_VALUE,
      },
    });
  } catch (error) {
    console.error("[llms.txt GET]", error);
    return new Response("Internal Server Error", {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": CACHE_CONTROL_VALUE,
      },
    });
  }
}
