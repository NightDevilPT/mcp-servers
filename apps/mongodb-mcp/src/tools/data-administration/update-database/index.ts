// apps/mongodb-mcp/src/tools/data-administration/update-database/index.ts

import { z } from "zod";
import {
	createErrorResponse,
	createSuccessResponse,
} from "../../../utils/mcp-error.utils";
import { MongoDBUtils } from "../../../utils/mongodb.utils";
import { SchemaValidator } from "../../../utils/schema-validation";

export const UpdateDatabaseTool = {
	name: "update_database",
	description: `[Database Administration] Update database settings and rename database.

Operations:
- renameDatabase: Rename database (requires confirm: "YES")
- updateSettings: Modify database settings

Example rename: {"databaseName": "old_name", "newDatabaseName": "new_name", "operation": "rename", "confirm": "YES"}`,

	inputSchema: {
		databaseName: z.string().describe("Current database name"),
		newDatabaseName: z
			.string()
			.optional()
			.describe("New database name (for rename)"),
		operation: z.enum(["rename"]).describe("Operation to perform"),
		confirm: z
			.enum(["YES", "NO"])
			.optional()
			.describe("Required for destructive operations"),
	},

	execute: async (
		args: {
			databaseName: string;
			newDatabaseName?: string;
			operation: "rename";
			confirm?: "YES" | "NO";
		},
		extra: any,
	) => {
		try {
			const { databaseName, newDatabaseName, operation, confirm } = args;

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

			// Rename operation
			if (operation === "rename") {
				if (!newDatabaseName) {
					return createErrorResponse(
						"newDatabaseName required for rename",
						"MISSING_NEW_NAME",
					);
				}

				if (confirm !== "YES") {
					return createErrorResponse(
						"Select 'YES' to confirm rename",
						"CONFIRMATION_FAILED",
					);
				}

				// Validate new database name
				const newDbValidation =
					SchemaValidator.validateDatabaseName(newDatabaseName);
				if (!newDbValidation.isValid) {
					return createErrorResponse(
						`Invalid new db name: ${newDbValidation.errors.join(", ")}`,
						"INVALID_DATABASE_NAME",
					);
				}

				// Check if new name already exists
				const newDbExists = dbList.databases.some(
					(dbInfo: any) => dbInfo.name === newDatabaseName,
				);

				if (newDbExists) {
					return createErrorResponse(
						`Database '${newDatabaseName}' already exists`,
						"DATABASE_ALREADY_EXISTS",
					);
				}

				// Rename database by copying collections
				const db = client.db(databaseName);
				const newDb = client.db(newDatabaseName);
				const collections = await db.listCollections().toArray();

				for (const collection of collections) {
					const docs = await db
						.collection(collection.name)
						.find()
						.toArray();
					if (docs.length > 0) {
						await newDb
							.collection(collection.name)
							.insertMany(docs);
					}

					// Copy indexes
					const indexes = await db
						.collection(collection.name)
						.indexes();
					for (const index of indexes) {
						if (index.name !== "_id_") {
							await newDb
								.collection(collection.name)
								.createIndex(index.key, {
									name: index.name,
									unique: index.unique,
									sparse: index.sparse,
								});
						}
					}
				}

				// Drop old database
				await db.dropDatabase();

				return createSuccessResponse(
					{
						oldName: databaseName,
						newName: newDatabaseName,
						renamed: true,
						collectionsMigrated: collections.length,
					},
					`Renamed '${databaseName}' to '${newDatabaseName}'`,
				);
			}

			return createErrorResponse(
				"Unsupported operation",
				"UNSUPPORTED_OPERATION",
			);
		} catch (error) {
			return createErrorResponse(
				error instanceof Error
					? error.message
					: "Failed to update database",
				"UPDATE_DATABASE_FAILED",
			);
		}
	},
};
