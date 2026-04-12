// apps/mongodb-mcp/src/tools/data-administration/drop-collection/index.ts

import { z } from "zod";
import {
	createErrorResponse,
	createSuccessResponse,
} from "../../../utils/mcp-error.utils";
import { MongoDBUtils } from "../../../utils/mongodb.utils";
import { SchemaValidator } from "../../../utils/schema-validation";

export const DropCollectionTool = {
	name: "drop_collection",
	description: `[Database Administration] Permanently delete a collection. IRREVERSIBLE! All data in the collection will be lost.

Options:
- databaseName: Database containing the collection
- collectionName: Collection to delete
- confirm: Select "YES" from dropdown to confirm

Example: {"databaseName": "ecommerce", "collectionName": "temp_users", "confirm": "YES"}`,

	inputSchema: {
		databaseName: z.string().describe("Database name"),
		collectionName: z.string().describe("Collection name to delete"),
		confirm: z
			.enum(["YES", "NO"])
			.describe("Select 'YES' to confirm deletion"),
	},

	execute: async (
		args: {
			databaseName: string;
			collectionName: string;
			confirm: "YES" | "NO";
		},
		extra: any,
	) => {
		try {
			const { databaseName, collectionName, confirm } = args;

			// Validate confirmation
			if (confirm !== "YES") {
				return createErrorResponse(
					"Select 'YES' to confirm collection deletion",
					"CONFIRMATION_FAILED",
				);
			}

			// Validate database name
			const dbNameValidation =
				SchemaValidator.validateDatabaseName(databaseName);
			if (!dbNameValidation.isValid) {
				return createErrorResponse(
					`Invalid db name: ${dbNameValidation.errors.join(", ")}`,
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
					`Database '${databaseName}' not found`,
					"DATABASE_NOT_FOUND",
				);
			}

			const db = client.db(databaseName);

			// Check if collection exists
			const collections = await db
				.listCollections({ name: collectionName })
				.toArray();

			if (collections.length === 0) {
				return createErrorResponse(
					`Collection '${collectionName}' not found in '${databaseName}'`,
					"COLLECTION_NOT_FOUND",
				);
			}

			// Protect system collections
			if (collectionName.startsWith("system.")) {
				return createErrorResponse(
					"Cannot drop system collections",
					"SYSTEM_COLLECTION_PROTECTED",
				);
			}

			// Drop the collection
			await db.collection(collectionName).drop();

			return createSuccessResponse(
				{
					databaseName,
					collectionName,
					dropped: true,
				},
				`Dropped '${collectionName}' from '${databaseName}'`,
			);
		} catch (error) {
			return createErrorResponse(
				error instanceof Error
					? error.message
					: "Failed to drop collection",
				"DROP_COLLECTION_FAILED",
			);
		}
	},
};
