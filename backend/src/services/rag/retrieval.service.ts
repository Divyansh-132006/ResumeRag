import { searchQdrant } from "../../config/qdrant.js";
import { embedTexts } from "./embedding.service.js";

export interface RetrievedEvidence {
    text: string;
    section: string;
    sourceId: string;
    score: number;
}

export const retrieveEvidence = async (userId: string, resumeId: string, query: string): Promise<RetrievedEvidence[]> => {
    const [vector] = await embedTexts([query], "RETRIEVAL_QUERY");
    const points = await searchQdrant(vector, { must: [{ key: "userId", match: { value: userId } }, { key: "resumeId", match: { value: resumeId } }] });
    return points.map((point) => ({
        text: String(point.payload.text ?? ""),
        section: String(point.payload.section ?? "additional"),
        sourceId: String(point.payload.sourceId ?? point.id),
        score: point.score,
    }));
};