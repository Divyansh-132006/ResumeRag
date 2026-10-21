import { z } from "zod";

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    FRONTEND_ORIGIN: z.string().url().optional(),
    MONGODB_URI: z.string().min(1).optional(),
    MONGODB_USERNAME: z.string().min(1).optional(),
    MONGODB_PASSWORD: z.string().min(1).optional(),
    MONGODB_DNS_SERVERS: z.string().optional(),
    JWT_SECRET: z.string().min(32).optional(),
    UPLOAD_DIR: z.string().min(1).default("upload"),
    MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
    QDRANT_URL: z.string().url().optional(),
    QDRANT_API_KEY: z.string().min(1).optional(),
    QDRANT_COLLECTION: z.string().min(1).default("resume_chunks"),
    EMBEDDING_API_URL: z.string().url().optional(),
    EMBEDDING_API_KEY: z.string().min(1).optional(),
    EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
    EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
    EMBEDDING_PROVIDER: z.enum(["openai-compatible", "gemini"]).default("openai-compatible"),
    GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
    LLM_API_URL: z.string().url().optional(),
    LLM_API_KEY: z.string().min(1).optional(),
    LLM_MODEL: z.string().default("gpt-4o-mini"),
    LLM_PROVIDER: z.enum(["openai-compatible", "gemini"]).default("openai-compatible"),
    GEMINI_API_KEY: z.string().min(1).optional(),
    GEMINI_MODEL: z.string().default("gemini-2.0-flash"),
    AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(180000).default(120000),
});

export type AppEnv = z.infer<typeof envSchema>;
let cachedEnv: AppEnv | undefined;

export const getEnv = (): AppEnv => {
    if (!cachedEnv) {
        const result = envSchema.safeParse(process.env);
        if (!result.success) {
            throw new Error(`Invalid environment configuration: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
        }
        cachedEnv = result.data;
    }
    return cachedEnv;
};