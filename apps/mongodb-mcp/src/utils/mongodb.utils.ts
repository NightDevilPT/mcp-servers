import { MongoClient } from "mongodb";
import { MCPError, validateEnvVar } from "./mcp-error.utils";

export class MongoDBUtils {
	private static client: MongoClient | null = null;

	static getMongoURI(): string {
		const uri = process.env.MONGODB_URI;
		validateEnvVar("MONGODB_URI", uri);
		return uri!;
	}

	static async getClient(): Promise<MongoClient> {
		if (this.client) {
			return this.client;
		}

		try {
			this.client = new MongoClient(this.getMongoURI());
			await this.client.connect();
			return this.client;
		} catch (error) {
			throw new MCPError(
				`MongoDB connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				true,
				"MONGODB_CONNECTION_FAILED",
			);
		}
	}

	static async testConnection(): Promise<boolean> {
		try {
			const client = await this.getClient();
			await client.db().admin().ping();
			return true;
		} catch (error) {
			throw new MCPError(
				`Connection test failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				true,
				"CONNECTION_TEST_FAILED",
			);
		}
	}

	static async closeConnection(): Promise<void> {
		if (this.client) {
			await this.client.close();
			this.client = null;
		}
	}
}
