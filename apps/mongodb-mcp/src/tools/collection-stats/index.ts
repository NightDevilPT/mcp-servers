// src/tools/collection-stats/index.ts
import { z } from "zod";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

export const CollectionStatsTool = {
	name: "collection_stats",
	description:
		"[Database administration] : Get detailed statistics for a MongoDB collection",
	inputSchema: {
		database: z
			.string()
			.describe("Name of the database containing the collection"),
		collection: z
			.string()
			.describe("Name of the collection to get statistics for"),
	},
	execute: async (
		args: {
			uri: string;
			database: string;
			collection: string;
		},
		extra: any, // Contains { server: McpServer }
	) => {
		let client: MongoClient | null = null;

		if (!process.env.MONGODB_URI) {
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

		try {
			// Connect to MongoDB
			client = new MongoClient(process.env.MONGODB_URI);
			await client.connect();

			const db = client.db(args.database);

			// Check if collection exists
			const collections = await db
				.listCollections({ name: args.collection })
				.toArray();
			if (collections.length === 0) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Error: Collection '${args.collection}' does not exist in database '${args.database}'`,
						},
					],
					isError: true,
				};
			}

			// Get collection statistics using admin command
			const admin = client.db().admin();
			const stats = await admin.command({
				collStats: args.collection,
				scale: 1,
			});

			// Get document count for verification
			const docCount = await db
				.collection(args.collection)
				.countDocuments();

			// Get index information
			const indexes = await db
				.collection(args.collection)
				.listIndexes()
				.toArray();

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								success: true,
								database: args.database,
								collection: args.collection,
								stats: {
									// Basic collection info
									ns: stats.ns,
									size: stats.size,
									count: stats.count,
									avgObjSize: stats.avgObjSize,
									storageSize: stats.storageSize,
									totalIndexSize: stats.totalIndexSize,

									// Document information
									documentCount: docCount,

									// Index information
									indexCount: indexes.length,
									indexes: indexes.map((index) => ({
										name: index.name,
										keys: index.key,
										unique: index.unique || false,
										sparse: index.sparse || false,
									})),

									// Additional stats if available
									capped: stats.capped || false,
									wiredTiger: stats.wiredTiger || {},

									// Timestamps
									created: stats.createTime
										? new Date(
												stats.createTime * 1000,
											).toISOString()
										: null,
								},
								message: `Statistics retrieved successfully for collection '${args.collection}' in database '${args.database}'`,
							},
							null,
							2,
						),
					},
				],
				_meta: {
					timestamp: new Date().toISOString(),
					database: args.database,
					collection: args.collection,
					documentCount: docCount,
					indexCount: indexes.length,
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
						text: `Error getting collection statistics: ${error.message}`,
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
