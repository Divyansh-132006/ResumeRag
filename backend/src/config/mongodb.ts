import mongoose from "mongoose";
import dns from "node:dns";
import { getEnv } from "./env.js";

export const connectMongo = async (): Promise<boolean> => {
  const {
    MONGODB_URI,
    MONGODB_USERNAME,
    MONGODB_PASSWORD,
    MONGODB_DNS_SERVERS,
  } = getEnv();
  if (!MONGODB_URI) return false;
  if (MONGODB_DNS_SERVERS) {
    const servers = MONGODB_DNS_SERVERS.split(",")
      .map((server) => server.trim())
      .filter(Boolean);
    if (servers.length > 0) dns.setServers(servers);
  }
  let connectionUri = MONGODB_URI;
  if (MONGODB_USERNAME && MONGODB_PASSWORD) {
    const match = MONGODB_URI.match(
      /^(mongodb(?:\+srv)?:\/\/)(?:[^@]+@)?(.+)$/,
    );
    if (!match)
      throw new Error("MONGODB_URI must be a valid MongoDB connection string");
    const credentials = `${encodeURIComponent(MONGODB_USERNAME)}:${encodeURIComponent(MONGODB_PASSWORD)}`;
    connectionUri = `${match[1]}${credentials}@${match[2]}`;
  }
  await mongoose.connect(connectionUri, { serverSelectionTimeoutMS: 5000 });
  return true;
};

export const disconnectMongo = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
};
