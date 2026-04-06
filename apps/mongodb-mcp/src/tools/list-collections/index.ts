// src/tools/list-collections/index.ts
import { z } from "zod";
import { MongoClient } from "mongodb";

export const ListCollectionsTool = {
	name: "list_collections",
	description: "[Database administration] : List all collections in a MongoDB database",
	inputSchema: {
		database: z
			.string()
			.describe("Name of the database to list collections from"),
	},
	execute: async (
		args: {
			database: string;
		},
		extra: any, // Contains { server: McpServer }
	) => {
		let client: MongoClient | null = null;

		try {
			// Get MongoDB URI from environment variable
			const uri = process.env.MONGODB_URI;
			if (!uri) {
				return {
					content: [
						{
							type: "text" as const,
							text: "Error: MONGODB_URI environment variable is not set",
						},
					],
					isError: true,
				};
			}

			// Connect to MongoDB
			client = new MongoClient(uri);
			await client.connect();

			const db = client.db(args.database);

			// Get list of collections
			const collections = await db.listCollections().toArray();

			// Extract collection names and basic info
			const collectionInfo = collections.map(collection => ({
				name: collection.name,
				type: collection.type || 'collection',
				options: (collection as any).options || {},
				info: (collection as any).info || {}
			}));

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								success: true,
								database: args.database,
								collections: collectionInfo,
								totalCollections: collectionInfo.length,
								message: `Found ${collectionInfo.length} collections in database '${args.database}'`,
							},
							null,
							2,
						),
					},
				],
				_meta: {
					timestamp: new Date().toISOString(),
					database: args.database,
					collectionCount: collectionInfo.length,
				},
			};
		} catch (error: any) {
			// Handle MongoDB connection errors
			if (error.code === 18) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Error: Authentication failed for database '${args.database}'. Check URI credentials.`,
						},
					],
					isError: true,
				};
			}

			// Handle database not found errors
			if (error.code === 26) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Error: Database '${args.database}' not found.`,
						},
					],
					isError: true,
				};
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `Error listing collections: ${error.message}`,
					},
				],
				isError: true,
			};
		} finally {
			// Always close the connection
			if (client) {
				await client.close();
			}
		}
	},
};
