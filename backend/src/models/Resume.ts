import mongoose, { Schema, type InferSchemaType } from "mongoose";

const resumeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    originalName: { type: String, required: true, maxlength: 255 },
    filename: { type: String, required: true, unique: true },
    // Keep the source PDF with the resume so exports survive ephemeral hosts.
    pdfData: { type: Buffer, select: false },
    pageCount: { type: Number, required: true, min: 1 },
    text: { type: String, required: true, maxlength: 200000 },
    structuredResume: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["review", "approved"],
      default: "review",
      index: true,
    },
    ingestionStatus: {
      type: String,
      enum: ["pending", "indexed", "failed"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true },
);

resumeSchema.index({ userId: 1, createdAt: -1 });
export type ResumeDocument = InferSchemaType<typeof resumeSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Resume =
  mongoose.models.Resume ?? mongoose.model("Resume", resumeSchema);
