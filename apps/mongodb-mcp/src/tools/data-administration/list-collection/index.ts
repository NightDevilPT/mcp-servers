// apps/mongodb-mcp/src/tools/data-administration/list-collections/index.ts

import { z } from "zod";
import {
	createErrorResponse,
	createSuccessResponse,
} from "../../../utils/mcp-error.utils";
import { MongoDBUtils } from "../../../utils/mongodb.utils";
import { SchemaValidator } from "../../../utils/schema-validation";

export const ListCollectionsTool = {
	name: "list_collections",
	description: `[Database Administration] List all collections in a database with detailed information.

Returns:
- Collection name and type
- Document count, size, storage size, index size
- Average document size, index count
- Capped collection info (max docs, max size)

Options:
- includeStats: Get full statistics (docs, size, indexes)
- includeSystemCollections: Show system.* collections
- namePattern: Filter by regex (e.g., "^user")
- sortBy: Order by name, size, or docs
- sortOrder: asc/desc

Example: {"databaseName": "ecommerce", "includeStats": true}`,

	inputSchema: {
		databaseName: z.string().describe("Database name"),
		includeStats: z
			.boolean()
			.optional()
			.default(false)
			.describe("Get full collection statistics"),
		includeSystemCollections: z
			.boolean()
			.optional()
			.default(false)
			.describe("Include system collections"),
		namePattern: z
			.string()
			.optional()
			.describe("Regex filter for collection names"),
		sortBy: z
			.enum(["name", "size", "docs"])
			.optional()
			.default("name")
			.describe("Sort by name, size, or document count"),
		sortOrder: z
			.enum(["asc", "desc"])
			.optional()
			.default("asc")
			.describe("ascending or descending"),
	},

	execute: async (
		args: {
			databaseName: string;
			includeStats?: boolean;
			includeSystemCollections?: boolean;
			namePattern?: string;
			sortBy?: "name" | "size" | "docs";
			sortOrder?: "asc" | "desc";
		},
		extra: any,
	) => {
		try {
			const {
				databaseName,
				includeStats = false,
				includeSystemCollections = false,
				namePattern,
				sortBy = "name",
				sortOrder = "asc",
			} = args;

			// Validate database name
			const dbNameValidation =
				SchemaValidator.validateDatabaseName(databaseName);
			if (!dbNameValidation.isValid) {
				return createErrorResponse(
					`Invalid db name: ${dbNameValidation.errors.join(", ")}`,
					"INVALID_DATABASE_NAME",
				);
			}

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
					`Database '${databaseName}' not found`,
					"DATABASE_NOT_FOUND",
				);
			}

			const db = client.db(databaseName);
			const collections = await db
				.listCollections({}, { nameOnly: false })
				.toArray();

			// Filter collections
			let filteredCollections = collections;
			if (!includeSystemCollections) {
				filteredCollections = collections.filter(
					(col) => !col.name.startsWith("system."),
				);
			}

			if (namePattern) {
				try {
					const regex = new RegExp(namePattern);
					filteredCollections = filteredCollections.filter((col) =>
						regex.test(col.name),
					);
				} catch (error) {
					return createErrorResponse(
						`Invalid regex: ${namePattern}`,
						"INVALID_REGEX_PATTERN",
					);
				}
			}

			// Get collection details
			const collectionsWithDetails: any[] = [];
			let statsErrors = 0;

			for (const collection of filteredCollections) {
				const collectionInfo: any = {
					name: collection.name,
					type: collection.type || "collection",
				};

				if (includeStats) {
					try {
						const stats = await db.command({
							collStats: collection.name,
						});

						collectionInfo.details = {
							documentCount: stats.count || 0,
							sizeBytes: stats.size || 0,
							sizeHuman: formatBytes(stats.size || 0),
							storageSizeBytes: stats.storageSize || 0,
							storageSizeHuman: formatBytes(
								stats.storageSize || 0,
							),
							indexSizeBytes: stats.totalIndexSize || 0,
							indexSizeHuman: formatBytes(
								stats.totalIndexSize || 0,
							),
							avgDocSizeBytes: stats.avgObjSize || 0,
							avgDocSizeHuman: formatBytes(stats.avgObjSize || 0),
							indexCount: stats.nindexes || 0,
							isCapped: stats.capped || false,
						};

						if (stats.capped) {
							collectionInfo.details.cappedMaxDocs = stats.max;
							collectionInfo.details.cappedMaxSizeBytes =
								stats.maxSize;
							collectionInfo.details.cappedMaxSizeHuman =
								formatBytes(stats.maxSize);
						}

						if (
							stats.indexSizes &&
							Object.keys(stats.indexSizes).length > 0
						) {
							collectionInfo.details.indexNames = Object.keys(
								stats.indexSizes,
							);
						}
					} catch (error) {
						statsErrors++;
						collectionInfo.error = "Failed to get statistics";
					}
				}

				if (
					collection.options &&
					Object.keys(collection.options).length > 0
				) {
					collectionInfo.options = collection.options;
				}

				collectionsWithDetails.push(collectionInfo);
			}

			// Sort collections
			const sortDirection = sortOrder === "asc" ? 1 : -1;

			if (sortBy === "name") {
				collectionsWithDetails.sort(
					(a, b) => sortDirection * a.name.localeCompare(b.name),
				);
			} else if (sortBy === "size" && includeStats) {
				collectionsWithDetails.sort((a, b) => {
					const sizeA = a.details?.sizeBytes || 0;
					const sizeB = b.details?.sizeBytes || 0;
					return sortDirection * (sizeA - sizeB);
				});
			} else if (sortBy === "docs" && includeStats) {
				collectionsWithDetails.sort((a, b) => {
					const docsA = a.details?.documentCount || 0;
					const docsB = b.details?.documentCount || 0;
					return sortDirection * (docsA - docsB);
				});
			}

			// Prepare response
			const response: any = {
				databaseName,
				totalCollections: collectionsWithDetails.length,
				collections: collectionsWithDetails,
			};

			// Add summary if stats included
			if (includeStats && collectionsWithDetails.length > 0) {
				const validCollections = collectionsWithDetails.filter(
					(c: any) => c.details,
				);
				if (validCollections.length > 0) {
					const totalDocs = validCollections.reduce(
						(sum: number, c: any) =>
							sum + (c.details.documentCount || 0),
						0,
					);
					const totalSize = validCollections.reduce(
						(sum: number, c: any) =>
							sum + (c.details.sizeBytes || 0),
						0,
					);
					const totalStorage = validCollections.reduce(
						(sum: number, c: any) =>
							sum + (c.details.storageSizeBytes || 0),
						0,
					);
					const totalIndex = validCollections.reduce(
						(sum: number, c: any) =>
							sum + (c.details.indexSizeBytes || 0),
						0,
					);

					response.summary = {
						totalDocuments: totalDocs,
						totalSizeBytes: totalSize,
						totalSizeHuman: formatBytes(totalSize),
						totalStorageSizeBytes: totalStorage,
						totalStorageSizeHuman: formatBytes(totalStorage),
						totalIndexSizeBytes: totalIndex,
						totalIndexSizeHuman: formatBytes(totalIndex),
					};
				}
			}

			let message = `${collectionsWithDetails.length} collection(s) in '${databaseName}'`;
			if (namePattern) message += ` matching '${namePattern}'`;
			if (!includeSystemCollections) message += ` (excl system)`;
			if (includeStats) message += ` (with stats)`;

			return createSuccessResponse(response, message);
		} catch (error) {
			return createErrorResponse(
				error instanceof Error
					? error.message
					: "Failed to list collections",
				"LIST_COLLECTIONS_FAILED",
			);
		}
	},
};

// Helper function to format bytes to human readable
function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
