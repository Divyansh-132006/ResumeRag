import crypto from "node:crypto";
import { ensureQdrantCollection, upsertQdrantPoints } from "../../config/qdrant.js";
import { embedTexts } from "./embedding.service.js";
import { chunkResumeSections } from "../resume/chunking.service.js";
import { detectSections } from "../resume/section-detector.service.js";

export const ingestResume = async (userId: string, resumeId: string, text: string): Promise<number> => {
    const chunks = chunkResumeSections(resumeId, detectSections(text));
    if (chunks.length === 0) return 0;
    const embeddings = await embedTexts(chunks.map((chunk) => chunk.text));
    await ensureQdrantCollection();
    await upsertQdrantPoints(chunks.map((chunk, index) => ({
        id: crypto.randomUUID(),
        vector: embeddings[index],
        payload: { userId, resumeId, section: chunk.section, sourceId: chunk.id, text: chunk.text, chunkIndex: chunk.index },
    })));
    return chunks.length;
};
