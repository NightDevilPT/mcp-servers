// apps/mongodb-mcp/src/tools/data-administration/database-stats/index.ts

import { z } from "zod";
import {
	createErrorResponse,
	createSuccessResponse,
} from "../../../utils/mcp-error.utils";
import { MongoDBUtils } from "../../../utils/mongodb.utils";
import { SchemaValidator } from "../../../utils/schema-validation";

export const DatabaseStatsTool = {
	name: "database_stats",
	description: `[Database Administration] Get detailed statistics for a specific database.

RETURNS:
- Database size, storage size, index size
- Collection count, document count
- Average document size
- List of collections with their sizes
- Top 5 largest collections

EXAMPLE:
{
  "databaseName": "myapp",
  "includeCollectionDetails": true,
  "topCollections": 5
}

OPTIONS:
- includeCollectionDetails: Get stats for each collection
- topCollections: Number of largest collections to show (default 5)`,

	inputSchema: {
		databaseName: z.string().describe("Database name to get stats for"),
		includeCollectionDetails: z
			.boolean()
			.optional()
			.default(true)
			.describe("Include statistics for each collection"),
		topCollections: z
			.number()
			.min(1)
			.max(20)
			.optional()
			.default(5)
			.describe("Number of largest collections to show"),
	},

	execute: async (
		args: {
			databaseName: string;
			includeCollectionDetails?: boolean;
			topCollections?: number;
		},
		extra: any,
	) => {
		try {
			const {
				databaseName,
				includeCollectionDetails = true,
				topCollections = 5,
			} = args;

			// Validate database name
			const dbNameValidation =
				SchemaValidator.validateDatabaseName(databaseName);
			if (!dbNameValidation.isValid) {
				return createErrorResponse(
					`Invalid database name: ${dbNameValidation.errors.join(", ")}`,
					"INVALID_DATABASE_NAME",
				);
			}

			// Test connection
			await MongoDBUtils.testConnection();
			const client = await MongoDBUtils.getClient();

			// Check if database exists
			const admin = client.db().admin();
			const dbList = await admin.listDatabases();
			const databaseInfo = dbList.databases.find(
				(dbInfo: any) => dbInfo.name === databaseName,
			);

			if (!databaseInfo) {
				return createErrorResponse(
					`Database '${databaseName}' not found.`,
					"DATABASE_NOT_FOUND",
				);
			}

			const db = client.db(databaseName);

			// Get database stats
			const dbStats = await db.command({ dbStats: 1 });

			// Get all collections
			const collections = await db.listCollections().toArray();
			const collectionStats: any[] = [];

			let totalDocuments = 0;
			let totalStorageSize = 0;

			// Get stats for each collection
			for (const collection of collections) {
				try {
					const stats = await db.command({
						collStats: collection.name,
					});

					const collectionStat = {
						name: collection.name,
						documentCount: stats.count || 0,
						sizeBytes: stats.size || 0,
						sizeHuman: formatBytes(stats.size || 0),
						storageSizeBytes: stats.storageSize || 0,
						storageSizeHuman: formatBytes(stats.storageSize || 0),
						indexCount: stats.nindexes || 0,
						indexSizeBytes: stats.totalIndexSize || 0,
						indexSizeHuman: formatBytes(stats.totalIndexSize || 0),
						isCapped: stats.capped || false,
					};

					collectionStats.push(collectionStat);
					totalDocuments += stats.count || 0;
					totalStorageSize += stats.storageSize || 0;
				} catch (error) {
					// Skip collections that can't be accessed
					collectionStats.push({
						name: collection.name,
						error: "Failed to get statistics",
					});
				}
			}

			// Sort collections by size
			const sortedCollections = [...collectionStats].sort(
				(a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0),
			);
			const topLargest = sortedCollections.slice(0, topCollections);

			// Build response
			const response: any = {
				databaseName,
				summary: {
					sizeBytes: dbStats.dataSize || 0,
					sizeHuman: formatBytes(dbStats.dataSize || 0),
					storageSizeBytes: dbStats.storageSize || 0,
					storageSizeHuman: formatBytes(dbStats.storageSize || 0),
					indexSizeBytes: dbStats.indexSize || 0,
					indexSizeHuman: formatBytes(dbStats.indexSize || 0),
					collectionCount: dbStats.collections || 0,
					documentCount: totalDocuments,
					avgDocumentSizeBytes: dbStats.avgObjSize || 0,
					avgDocumentSizeHuman: formatBytes(dbStats.avgObjSize || 0),
				},
			};

			if (includeCollectionDetails) {
				response.collections = collectionStats;
				response.topLargestCollections = topLargest;
				response.summary.totalStorageSizeBytes = totalStorageSize;
				response.summary.totalStorageSizeHuman =
					formatBytes(totalStorageSize);
			}

			const message = `Database '${databaseName}' has ${dbStats.collections} collection(s), ${totalDocuments.toLocaleString()} document(s), ${formatBytes(dbStats.dataSize)} size`;

			return createSuccessResponse(response, message);
		} catch (error) {
			return createErrorResponse(
				error instanceof Error
					? error.message
					: "Failed to get database statistics",
				"DATABASE_STATS_FAILED",
			);
		}
	},
};

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
