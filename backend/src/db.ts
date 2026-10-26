import { MongoClient, type Db } from "mongodb";

const url = process.env.MONGO_URL || "mongodb://127.0.0.1:27017";
const dbName = process.env.MONGO_DB || "weekly_dpu";

let client: MongoClient | null = null;

export async function getDb(): Promise<Db> {
  if (!client) {
    client = new MongoClient(url);
    await client.connect();
  }
  return client.db(dbName);
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
  }
}
