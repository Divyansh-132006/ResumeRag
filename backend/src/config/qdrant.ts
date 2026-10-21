import { getEnv } from "./env.js";

const qdrantRequest = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const { QDRANT_URL, QDRANT_API_KEY } = getEnv();
    if (!QDRANT_URL) throw new Error("Qdrant is not configured");
    const headers = new Headers(init.headers);
    headers.set("content-type", "application/json");
    if (QDRANT_API_KEY) headers.set("api-key", QDRANT_API_KEY);
    const response = await fetch(`${QDRANT_URL.replace(/\/$/, "")}${path}`, { ...init, headers, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Qdrant request failed with status ${response.status}`);
    return response.json() as Promise<T>;
};

export const ensureQdrantCollection = async (): Promise<void> => {
    const { QDRANT_COLLECTION, EMBEDDING_DIMENSIONS } = getEnv();
    try {
        await qdrantRequest(`/collections/${encodeURIComponent(QDRANT_COLLECTION)}`);
    } catch {
        await qdrantRequest(`/collections/${encodeURIComponent(QDRANT_COLLECTION)}`, {
            method: "PUT",
            body: JSON.stringify({ vectors: { size: EMBEDDING_DIMENSIONS, distance: "Cosine" } }),
        });
    }
    for (const field of ["userId", "resumeId", "section"]) {
        await qdrantRequest(`/collections/${encodeURIComponent(QDRANT_COLLECTION)}/index`, {
            method: "PUT",
            body: JSON.stringify({ field_name: field, field_schema: "keyword" }),
        });
    }
};

export const upsertQdrantPoints = async (points: Array<{ id: string; vector: number[]; payload: Record<string, unknown> }>): Promise<void> => {
    const { QDRANT_COLLECTION } = getEnv();
    await qdrantRequest(`/collections/${encodeURIComponent(QDRANT_COLLECTION)}/points?wait=true`, {
        method: "PUT",
        body: JSON.stringify({ points }),
    });
};

export const searchQdrant = async (vector: number[], filter: Record<string, unknown>, limit = 8): Promise<Array<{ id: string; score: number; payload: Record<string, unknown> }>> => {
    const { QDRANT_COLLECTION } = getEnv();
    const result = await qdrantRequest<{ result: Array<{ id: string; score: number; payload: Record<string, unknown> }> }>(`/collections/${encodeURIComponent(QDRANT_COLLECTION)}/points/search`, {
        method: "POST",
        body: JSON.stringify({ vector, limit, with_payload: true, filter }),
    });
    return result.result;
};

export const deleteQdrantResumePoints = async (userId: string, resumeId: string): Promise<void> => {
    const { QDRANT_COLLECTION } = getEnv();
    await qdrantRequest(`/collections/${encodeURIComponent(QDRANT_COLLECTION)}/points/delete?wait=true`, {
        method: "POST",
        body: JSON.stringify({ filter: { must: [{ key: "userId", match: { value: userId } }, { key: "resumeId", match: { value: resumeId } }] } }),
    });
};

export const deleteQdrantUserPoints = async (userId: string): Promise<void> => {
    const { QDRANT_COLLECTION } = getEnv();
    await qdrantRequest(`/collections/${encodeURIComponent(QDRANT_COLLECTION)}/points/delete?wait=true`, {
        method: "POST",
        body: JSON.stringify({ filter: { must: [{ key: "userId", match: { value: userId } }] } }),
    });
};
