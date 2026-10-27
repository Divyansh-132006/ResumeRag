import "dotenv/config";
import app from "./app.js";
import { connectMongo, disconnectMongo } from "./config/mongodb.js";
import { getEnv } from "./config/env.js";

const start = async (): Promise<void> => {
  const env = getEnv();
  const connected = await connectMongo();
  if (!connected)
    console.warn(
      "MONGODB_URI is not configured; persistence APIs are unavailable",
    );
  const server = app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);
  });
  const shutdown = async (): Promise<void> => {
    server.close();
    await disconnectMongo();
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
};

void start().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Server failed to start",
  );
  process.exitCode = 1;
});
