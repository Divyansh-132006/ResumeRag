import mongoose, { Schema } from "mongoose";

const jobDescriptionSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    text: { type: String, required: true, maxlength: 50000 },
    analysis: { type: Schema.Types.Mixed, required: true },
}, { timestamps: true });

jobDescriptionSchema.index({ userId: 1, createdAt: -1 });
export const JobDescription = mongoose.models.JobDescription ?? mongoose.model("JobDescription", jobDescriptionSchema);