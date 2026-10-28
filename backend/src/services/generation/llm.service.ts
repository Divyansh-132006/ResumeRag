import { getEnv } from "../../config/env.js";
import { ProviderError } from "./provider-error.js";

const transientStatuses = new Set([429, 500, 502, 503, 504]);

const providerResponseMessage = async (response: Response): Promise<string> => {
  const fallback =
    response.statusText || "The AI provider is temporarily unavailable";
  try {
    const body = (await response.clone().json()) as {
      error?: { message?: string; status?: string };
    };
    const message = body.error?.message?.trim();
    const status = body.error?.status?.trim();
    if (message && status) return `${status}: ${message}`;
    if (message) return message;
  } catch {
    // Some provider failures return a non-JSON body.
  }
  return fallback;
};

const fetchWithRetry = async (
  url: string,
  init: RequestInit,
  provider: string,
  timeoutMs: number,
): Promise<Response> => {
  let lastStatus = 503;
  let lastMessage = "The AI provider is temporarily unavailable";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (response.ok) return response;
      lastStatus = response.status;
      lastMessage = await providerResponseMessage(response);
      if (!transientStatuses.has(response.status) || attempt === 2) break;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ProviderError(
          provider,
          504,
          `request timed out after ${timeoutMs}ms`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
  throw new ProviderError(provider, lastStatus, lastMessage);
};

const providerRequest = async (
  system: string,
  user: string,
  responseFormat?: { type: "json_object" },
): Promise<string> => {
  const {
    LLM_API_URL,
    LLM_API_KEY,
    LLM_MODEL,
    LLM_PROVIDER,
    GEMINI_API_KEY,
    GEMINI_MODEL,
    AI_REQUEST_TIMEOUT_MS,
  } = getEnv();
  if (LLM_PROVIDER === "gemini") {
    if (!GEMINI_API_KEY) throw new Error("Gemini provider is not configured");
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const response = await fetchWithRetry(
      endpoint,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0,
            ...(responseFormat
              ? { responseMimeType: "application/json" }
              : {}),
          },
        }),
      },
      "Gemini",
      AI_REQUEST_TIMEOUT_MS,
    );
    const body = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const content = body.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!content) throw new Error("Gemini provider returned empty output");
    return content;
  }
  if (!LLM_API_URL || !LLM_API_KEY)
    throw new Error("LLM provider is not configured");
  const response = await fetchWithRetry(
    `${LLM_API_URL.replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${LLM_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        temperature: 0,
        ...(responseFormat ? { response_format: responseFormat } : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    },
    "LLM",
    AI_REQUEST_TIMEOUT_MS,
  );
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("LLM provider returned empty output");
  return content;
};

export const completeJson = async (
  system: string,
  user: string,
): Promise<unknown> => {
  const content = await providerRequest(system, user, { type: "json_object" });
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("LLM provider returned invalid JSON");
  }
};

export const completeText = async (
  system: string,
  user: string,
): Promise<string> => providerRequest(system, user);
