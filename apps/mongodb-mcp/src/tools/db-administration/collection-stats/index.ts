// src/tools/collection-stats/index.ts
import { z } from "zod";
import { MongoClient } from "mongodb";
import {
	withMongoConnection,
	validateCollectionExists,
	createMongoDBUriError,
	handleMongoError,
	createCollectionResponse,
	createCollectionNotFoundError,
} from "../../../utils";

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
			database: string;
			collection: string;
		},
		extra: any, // Contains { server: McpServer }
	) => {
		try {
			return await withMongoConnection(args.database, async (client, db) => {
				// Check if collection exists
				const collectionExists = await validateCollectionExists(db, args.collection);
				if (!collectionExists) {
					return createCollectionNotFoundError(args.collection, args.database);
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

				const statsData = {
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
						? new Date(stats.createTime * 1000).toISOString()
						: null,
				};

				return createCollectionResponse(
					args.database,
					args.collection,
					`Statistics retrieved successfully for collection '${args.collection}' in database '${args.database}'`,
					{ stats: statsData }
				);
			});
		} catch (error: any) {
			const handledError = handleMongoError(error, args.database, args.collection);
			if (handledError) {
				return handledError;
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
		}
	},
};
