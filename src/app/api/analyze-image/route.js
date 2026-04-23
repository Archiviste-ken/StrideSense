const ASSISTIVE_PROMPT = `You are an assistive AI for visually impaired users.

Describe the scene in a way that helps safe navigation.

Focus on:

* obstacles in front of the user
* important nearby objects
* readable text
* actionable guidance

Avoid unnecessary details.

Respond EXACTLY in this format:

Environment: ...
Objects: ...
Hazards: ...
Text detected: ...
Action guidance: ...

Keep responses short, clear, and practical.`;

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const FALLBACK_RESULT = "Unable to analyze the image at the moment.";
const IMAGE_TOO_LARGE_RESULT = "Image too large. Please try again.";
const MAX_IMAGE_LENGTH = 2_000_000;
const FETCH_TIMEOUT_MS = 8000;

function toImageDataUrl(image) {
  if (!image || typeof image !== "string") return null;
  if (image.startsWith("data:image/")) return image;
  return `data:image/jpeg;base64,${image}`;
}

export async function POST(request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === "your_api_key_here") {
      return Response.json({ result: FALLBACK_RESULT });
    }

    const body = await request.json();
    const image = body?.image;
    if (typeof image !== "string") {
      return Response.json({ result: FALLBACK_RESULT });
    }

    if (image.length > MAX_IMAGE_LENGTH) {
      return Response.json({ result: IMAGE_TOO_LARGE_RESULT });
    }

    const imageUrl = toImageDataUrl(image);
    if (!imageUrl || !imageUrl.startsWith("data:image/")) {
      return Response.json({ result: FALLBACK_RESULT });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let groqResponse;
    try {
      groqResponse = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: GROQ_VISION_MODEL,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: ASSISTIVE_PROMPT,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imageUrl,
                  },
                },
              ],
            },
          ],
          temperature: 0.2,
          max_completion_tokens: 500,
        }),
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!groqResponse.ok) {
      console.error("Groq error:", await groqResponse.text());
      return Response.json({ result: FALLBACK_RESULT });
    }

    const data = await groqResponse.json();
    let result = data?.choices?.[0]?.message?.content?.trim();
    if (!result || result.length < 20) {
      result = FALLBACK_RESULT;
    }

    return Response.json({ result });
  } catch {
    return Response.json({ result: FALLBACK_RESULT });
  }
}
