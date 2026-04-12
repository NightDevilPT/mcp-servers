// apps/mongodb-mcp/src/tools/data-administration/collection-stats/index.ts

import { z } from "zod";
import {
	createErrorResponse,
	createSuccessResponse,
} from "../../../utils/mcp-error.utils";
import { MongoDBUtils } from "../../../utils/mongodb.utils";
import { SchemaValidator } from "../../../utils/schema-validation";

export const CollectionStatsTool = {
	name: "collection_stats",
	description: `[Database Administration] Get detailed statistics for a specific collection.

RETURNS:
- Document count, size, average document size
- Storage size, index size, total size
- Index details and names
- Capped collection info (if applicable)
- Validation schema (if exists)

EXAMPLE:
{
  "databaseName": "myapp",
  "collectionName": "users",
  "includeIndexDetails": true,
  "includeValidationSchema": true
}

OPTIONS:
- includeIndexDetails: Get detailed index information
- includeValidationSchema: Get the JSON schema validator if exists`,

	inputSchema: {
		databaseName: z.string().describe("Existing database name"),
		collectionName: z.string().describe("Collection name to get stats for"),
		includeIndexDetails: z
			.boolean()
			.optional()
			.default(false)
			.describe("Include detailed index information"),
		includeValidationSchema: z
			.boolean()
			.optional()
			.default(false)
			.describe("Include validation schema if exists"),
	},

	execute: async (
		args: {
			databaseName: string;
			collectionName: string;
			includeIndexDetails?: boolean;
			includeValidationSchema?: boolean;
		},
		extra: any,
	) => {
		try {
			const {
				databaseName,
				collectionName,
				includeIndexDetails = false,
				includeValidationSchema = false,
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

			// Validate collection name
			const collectionValidation =
				SchemaValidator.validateCollectionName(collectionName);
			if (!collectionValidation.isValid) {
				return createErrorResponse(
					`Invalid collection name: ${collectionValidation.errors.join(", ")}`,
					"INVALID_COLLECTION_NAME",
				);
			}

			// Test connection
			await MongoDBUtils.testConnection();
			const client = await MongoDBUtils.getClient();

			// Check if database exists
			const admin = client.db().admin();
			const dbList = await admin.listDatabases();
			const databaseExists = dbList.databases.some(
				(dbInfo: any) => dbInfo.name === databaseName,
			);

			if (!databaseExists) {
				return createErrorResponse(
					`Database '${databaseName}' not found.`,
					"DATABASE_NOT_FOUND",
				);
			}

			const db = client.db(databaseName);

			// Check if collection exists using listCollections
			const collections = await db
				.listCollections({ name: collectionName }, { nameOnly: false })
				.toArray();

			if (collections.length === 0) {
				return createErrorResponse(
					`Collection '${collectionName}' not found in database '${databaseName}'.`,
					"COLLECTION_NOT_FOUND",
				);
			}

			const collection = db.collection(collectionName);

			// Get collection stats using collStats command
			const stats = await db.command({ collStats: collectionName });

			// Build response
			const response: any = {
				databaseName,
				collectionName,
				stats: {
					documentCount: stats.count || 0,
					sizeBytes: stats.size || 0,
					sizeHuman: formatBytes(stats.size || 0),
					avgDocumentSizeBytes: stats.avgObjSize || 0,
					avgDocumentSizeHuman: formatBytes(stats.avgObjSize || 0),
					storageSizeBytes: stats.storageSize || 0,
					storageSizeHuman: formatBytes(stats.storageSize || 0),
					totalIndexSizeBytes: stats.totalIndexSize || 0,
					totalIndexSizeHuman: formatBytes(stats.totalIndexSize || 0),
					indexCount: stats.nindexes || 0,
					isCapped: stats.capped || false,
				},
			};

			if (stats.capped) {
				response.stats.cappedMaxDocuments = stats.max;
				response.stats.cappedMaxSizeBytes = stats.maxSize;
				response.stats.cappedMaxSizeHuman = formatBytes(stats.maxSize);
			}

			// Include index details if requested
			if (includeIndexDetails) {
				const indexes = await collection.indexes();
				response.indexes = indexes.map((idx: any) => ({
					name: idx.name,
					key: idx.key,
					unique: idx.unique || false,
					sparse: idx.sparse || false,
					ttl: idx.expireAfterSeconds,
				}));
			}

			// Include validation schema if requested (from collection options)
			if (includeValidationSchema && collections[0].options) {
				const options = collections[0].options;
				if (options.validator) {
					response.validationSchema = {
						validator: options.validator,
						validationLevel: options.validationLevel || "strict",
						validationAction: options.validationAction || "error",
					};
				}
			}

			const message = `Collection '${collectionName}' has ${stats.count.toLocaleString()} document(s), ${formatBytes(stats.size)} size, ${stats.nindexes} index(es)`;

			return createSuccessResponse(response, message);
		} catch (error) {
			return createErrorResponse(
				error instanceof Error
					? error.message
					: "Failed to get collection statistics",
				"COLLECTION_STATS_FAILED",
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
