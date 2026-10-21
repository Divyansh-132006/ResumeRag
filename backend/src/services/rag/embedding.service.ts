import { getEnv } from "../../config/env.js";
import { ProviderError } from "../generation/provider-error.js";

const embeddingRequest = async (endpoint: string, init: RequestInit, provider: string, timeoutMs: number): Promise<Response> => {
    try {
        return await fetch(endpoint, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
        if (error instanceof DOMException && error.name === "TimeoutError") {
            throw new ProviderError(provider, 504, `embedding request timed out after ${timeoutMs}ms`);
        }
        throw error;
    }
};

export const embedTexts = async (
    texts: string[],
    taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_DOCUMENT",
): Promise<number[][]> => {
    const {
        EMBEDDING_API_URL,
        EMBEDDING_API_KEY,
        EMBEDDING_MODEL,
        EMBEDDING_PROVIDER,
        EMBEDDING_DIMENSIONS,
        GEMINI_API_KEY,
        GEMINI_EMBEDDING_MODEL,
        AI_REQUEST_TIMEOUT_MS,
    } = getEnv();
    if (texts.length === 0) return [];
    if (EMBEDDING_PROVIDER === "gemini") {
        if (!GEMINI_API_KEY) throw new Error("Gemini embedding provider is not configured");
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_EMBEDDING_MODEL)}:batchEmbedContents?key=${encodeURIComponent(GEMINI_API_KEY)}`;
        const response = await embeddingRequest(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                requests: texts.map((text) => ({
                    model: `models/${GEMINI_EMBEDDING_MODEL}`,
                    content: { parts: [{ text }] },
                    taskType,
                    outputDimensionality: EMBEDDING_DIMENSIONS,
                })),
            }),
        }, "Gemini", Math.min(AI_REQUEST_TIMEOUT_MS, 60000));
        if (!response.ok) throw new Error(`Gemini embedding provider failed with status ${response.status}`);
        const body = await response.json() as { embeddings?: Array<{ values?: number[] }> };
        const embeddings = body.embeddings?.map((item) => item.values);
        if (!embeddings || embeddings.length !== texts.length || embeddings.some((value) => !value?.length)) {
            throw new Error("Gemini embedding provider returned invalid output");
        }
        return embeddings as number[][];
    }
    if (!EMBEDDING_API_URL || !EMBEDDING_API_KEY) throw new Error("Embedding provider is not configured");
    const response = await embeddingRequest(`${EMBEDDING_API_URL.replace(/\/$/, "")}/embeddings`, {
        method: "POST",
        headers: { authorization: `Bearer ${EMBEDDING_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
    }, "Embedding", Math.min(AI_REQUEST_TIMEOUT_MS, 60000));
    if (!response.ok) throw new Error(`Embedding provider failed with status ${response.status}`);
    const body = await response.json() as { data?: Array<{ embedding?: number[] }> };
    const embeddings = body.data?.map((item) => item.embedding);
    if (!embeddings || embeddings.length !== texts.length || embeddings.some((value) => !value?.length)) throw new Error("Embedding provider returned invalid output");
    return embeddings as number[][];
};
