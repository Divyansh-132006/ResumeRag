import { Schema, model, models } from "mongoose";

const generationSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    resumeId: { type: Schema.Types.ObjectId, required: true, index: true },
    jobDescriptionId: { type: Schema.Types.ObjectId, required: true, index: true },
    output: { type: Schema.Types.Mixed, required: true },
    evidence: { type: [Schema.Types.Mixed], required: true },
}, { timestamps: true });

export const Generation = models.Generation ?? model("Generation", generationSchema);
