// apps/mongodb-mcp/src/tools/data-administration/rename-collection/index.ts

import { z } from "zod";
import {
	createErrorResponse,
	createSuccessResponse,
} from "../../../utils/mcp-error.utils";
import { MongoDBUtils } from "../../../utils/mongodb.utils";
import { SchemaValidator } from "../../../utils/schema-validation";
import { FormGenerator } from "../../../utils/form-generator";

export const RenameCollectionTool = {
	name: "rename_collection",
	description: `[Database Administration] Rename an existing collection.

NOTE: Renaming a collection is an atomic operation but will break any existing applications or queries referencing the old name.

EXAMPLE:
{
  "databaseName": "myapp",
  "oldCollectionName": "users_temp",
  "newCollectionName": "users"
}

FLOW:
1. Submit database name, old collection name, and new collection name
2. Tool validates both collection names
3. Checks if old collection exists and new name doesn't exist
4. Shows confirmation form
5. User confirms or cancels
6. Renames the collection

WARNINGS:
- Renaming breaks existing indexes (they are preserved but collection name changes)
- Applications using old name will fail
- Consider updating application code before renaming`,

	inputSchema: {
		databaseName: z.string().describe("Existing database name"),
		oldCollectionName: z
			.string()
			.describe("Current collection name to rename"),
		newCollectionName: z.string().describe("New collection name"),
	},

	execute: async (
		args: {
			databaseName: string;
			oldCollectionName: string;
			newCollectionName: string;
		},
		extra: any,
	) => {
		try {
			const { databaseName, oldCollectionName, newCollectionName } = args;

			// Validate database name
			const dbNameValidation =
				SchemaValidator.validateDatabaseName(databaseName);
			if (!dbNameValidation.isValid) {
				return createErrorResponse(
					`Invalid database name: ${dbNameValidation.errors.join(", ")}`,
					"INVALID_DATABASE_NAME",
				);
			}

			// Validate old collection name
			const oldCollectionValidation =
				SchemaValidator.validateCollectionName(oldCollectionName);
			if (!oldCollectionValidation.isValid) {
				return createErrorResponse(
					`Invalid old collection name: ${oldCollectionValidation.errors.join(", ")}`,
					"INVALID_COLLECTION_NAME",
				);
			}

			// Validate new collection name
			const newCollectionValidation =
				SchemaValidator.validateCollectionName(newCollectionName);
			if (!newCollectionValidation.isValid) {
				return createErrorResponse(
					`Invalid new collection name: ${newCollectionValidation.errors.join(", ")}`,
					"INVALID_COLLECTION_NAME",
				);
			}

			// Check if names are the same
			if (oldCollectionName === newCollectionName) {
				return createErrorResponse(
					"Old and new collection names are the same. No rename needed.",
					"SAME_COLLECTION_NAME",
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
					`Database '${databaseName}' not found. Create it first using create_database tool.`,
					"DATABASE_NOT_FOUND",
				);
			}

			const db = client.db(databaseName);

			// Check if old collection exists
			const collections = await db
				.listCollections({ name: oldCollectionName })
				.toArray();

			if (collections.length === 0) {
				return createErrorResponse(
					`Collection '${oldCollectionName}' not found in database '${databaseName}'.`,
					"COLLECTION_NOT_FOUND",
				);
			}

			// Check if new collection name already exists
			const newCollectionExists = await db
				.listCollections({ name: newCollectionName })
				.toArray();

			if (newCollectionExists.length > 0) {
				return createErrorResponse(
					`Collection '${newCollectionName}' already exists in database '${databaseName}'. Cannot rename to an existing collection name.`,
					"COLLECTION_ALREADY_EXISTS",
				);
			}

			// Get collection stats for confirmation
			let collectionStats = null;
			try {
				const stats = await db.command({
					collStats: oldCollectionName,
				});
				collectionStats = {
					documentCount: stats.count || 0,
					sizeBytes: stats.size || 0,
					indexCount: stats.nindexes || 0,
				};
			} catch (error) {
				// Ignore stats error
			}

			// Show confirmation form
			const confirmationResult = await showConfirmationForm(
				databaseName,
				oldCollectionName,
				newCollectionName,
				collectionStats,
				extra,
			);

			if (confirmationResult.action === "cancel") {
				return createSuccessResponse(
					{
						cancelled: true,
						message: "Rename collection operation cancelled",
						databaseName,
						oldCollectionName,
						newCollectionName,
					},
					"Operation cancelled",
				);
			}

			if (confirmationResult.action !== "confirm") {
				return createErrorResponse(
					"Invalid confirmation action",
					"INVALID_ACTION",
				);
			}

			// Rename the collection
			const oldCollection = db.collection(oldCollectionName);
			await oldCollection.rename(newCollectionName);

			return createSuccessResponse(
				{
					databaseName,
					oldCollectionName,
					newCollectionName,
					renamed: true,
					documentCount: collectionStats?.documentCount || 0,
				},
				`Successfully renamed collection '${oldCollectionName}' to '${newCollectionName}' in database '${databaseName}'`,
			);
		} catch (error) {
			return createErrorResponse(
				error instanceof Error
					? error.message
					: "Failed to rename collection",
				"RENAME_COLLECTION_FAILED",
			);
		}
	},
};

async function showConfirmationForm(
	databaseName: string,
	oldCollectionName: string,
	newCollectionName: string,
	collectionStats: any,
	extra: any,
): Promise<{ action: "confirm" | "cancel" }> {
	const statsInfo = collectionStats
		? `\n**Collection Info:**
- Documents: ${collectionStats.documentCount.toLocaleString()}
- Size: ${formatBytes(collectionStats.sizeBytes)}
- Indexes: ${collectionStats.indexCount}`
		: "";

	const formSchema = {
		type: "object",
		properties: {
			action: {
				type: "string",
				title: "Confirm Collection Rename",
				description: `## Rename Collection

**Database:** ${databaseName}
**Old Name:** ${oldCollectionName}
**New Name:** ${newCollectionName}${statsInfo}

⚠️  WARNINGS:
- This will break any applications/queries using the old name
- Update your application code before renaming
- Operation is atomic but cannot be undone easily

Select an option:`,
				enum: ["confirm", "cancel"],
				enumNames: ["CONFIRM - Rename Collection", "CANCEL - Abort"],
			},
		},
		required: ["action"],
	};

	const generatedForm = FormGenerator.generateFormSchema(formSchema);

	const result = await extra.server.elicitInput({
		mode: "form",
		message: `Confirm renaming collection '${oldCollectionName}' to '${newCollectionName}'`,
		requestedSchema: generatedForm,
	});

	if (result.action !== "accept") {
		return { action: "cancel" };
	}

	const { action } = result.content;
	return action === "confirm" ? { action: "confirm" } : { action: "cancel" };
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
