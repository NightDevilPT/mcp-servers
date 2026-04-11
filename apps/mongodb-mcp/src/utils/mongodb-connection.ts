import { MongoClient, Db } from "mongodb";

export interface MongoConnectionResult {
	client: MongoClient;
	db: Db;
}

export async function connectToMongoDB(database?: string): Promise<MongoConnectionResult> {
	const uri = process.env.MONGODB_URI;
	if (!uri) {
		throw new Error("MONGODB_URI environment variable is not set");
	}

	const client = new MongoClient(uri);
	await client.connect();
	
	const db = database ? client.db(database) : client.db();
	
	return { client, db };
}

export async function closeConnection(client: MongoClient): Promise<void> {
	if (client) {
		await client.close();
	}
}

export async function withMongoConnection<T>(
	database: string,
	operation: (client: MongoClient, db: Db) => Promise<T>
): Promise<T> {
	const { client, db } = await connectToMongoDB(database);
	
	try {
		return await operation(client, db);
	} finally {
		await closeConnection(client);
	}
}
