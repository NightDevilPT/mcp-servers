// apps/mongodb-mcp/src/tools/data-administration/update-collection/index.ts

import { z } from "zod";
import {
	createErrorResponse,
	createSuccessResponse,
} from "../../../utils/mcp-error.utils";
import { MongoDBUtils } from "../../../utils/mongodb.utils";
import {
	SchemaValidator,
	FieldDefinitionSchema,
} from "../../../utils/schema-validation";

export const UpdateCollectionTool = {
	name: "update_collection",
	description: `[Database Administration] Update collection settings, rename, or modify validation.

Operations:
- rename: Rename collection
- updateValidation: Update JSON schema validation
- updateOptions: Modify collection options (capped, max size, etc.)

Example rename: {"databaseName": "ecommerce", "collectionName": "old_name", "newCollectionName": "new_name", "operation": "rename", "confirm": "YES"}

Example updateValidation: {"databaseName": "ecommerce", "collectionName": "users", "operation": "updateValidation", "fields": [{"name": "email", "type": "string", "required": true}]}`,

	inputSchema: {
		databaseName: z.string().describe("Database name"),
		collectionName: z.string().describe("Current collection name"),
		newCollectionName: z
			.string()
			.optional()
			.describe("New collection name (for rename)"),
		operation: z
			.enum(["rename", "updateValidation", "updateOptions"])
			.describe("Operation to perform"),
		fields: z
			.array(FieldDefinitionSchema)
			.optional()
			.describe("New field definitions (for updateValidation)"),
		options: z
			.object({
				capped: z.boolean().optional(),
				size: z.number().optional(),
				max: z.number().optional(),
				validationLevel: z
					.enum(["off", "strict", "moderate"])
					.optional(),
				validationAction: z.enum(["error", "warn"]).optional(),
			})
			.optional()
			.describe("Collection options (for updateOptions)"),
		confirm: z
			.enum(["YES", "NO"])
			.optional()
			.describe("Required for destructive operations"),
	},

	execute: async (
		args: {
			databaseName: string;
			collectionName: string;
			newCollectionName?: string;
			operation: "rename" | "updateValidation" | "updateOptions";
			fields?: any[];
			options?: {
				capped?: boolean;
				size?: number;
				max?: number;
				validationLevel?: "off" | "strict" | "moderate";
				validationAction?: "error" | "warn";
			};
			confirm?: "YES" | "NO";
		},
		extra: any,
	) => {
		try {
			const {
				databaseName,
				collectionName,
				newCollectionName,
				operation,
				fields,
				options,
				confirm,
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

			// Validate collection name
			const collectionValidation =
				SchemaValidator.validateCollectionName(collectionName);
			if (!collectionValidation.isValid) {
				return createErrorResponse(
					`Invalid collection name: ${collectionValidation.errors.join(", ")}`,
					"INVALID_COLLECTION_NAME",
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

			// Check if collection exists
			const collections = await db
				.listCollections({ name: collectionName })
				.toArray();
			if (collections.length === 0) {
				return createErrorResponse(
					`Collection '${collectionName}' not found`,
					"COLLECTION_NOT_FOUND",
				);
			}

			// RENAME operation
			if (operation === "rename") {
				if (!newCollectionName) {
					return createErrorResponse(
						"newCollectionName required for rename",
						"MISSING_NEW_NAME",
					);
				}

				if (confirm !== "YES") {
					return createErrorResponse(
						"Select 'YES' to confirm rename",
						"CONFIRMATION_FAILED",
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

				// Check if new name already exists
				const newCollectionExists = await db
					.listCollections({ name: newCollectionName })
					.toArray();
				if (newCollectionExists.length > 0) {
					return createErrorResponse(
						`Collection '${newCollectionName}' already exists`,
						"COLLECTION_ALREADY_EXISTS",
					);
				}

				// Rename collection
				await db.collection(collectionName).rename(newCollectionName);

				return createSuccessResponse(
					{
						databaseName,
						oldName: collectionName,
						newName: newCollectionName,
						renamed: true,
					},
					`Renamed '${collectionName}' to '${newCollectionName}'`,
				);
			}

			// UPDATE VALIDATION operation
			if (operation === "updateValidation") {
				if (!fields || fields.length === 0) {
					return createErrorResponse(
						"fields array required for updateValidation",
						"MISSING_FIELDS",
					);
				}

				// Validate field definitions
				const fieldsValidation =
					SchemaValidator.validateFieldDefinitions(fields);
				if (!fieldsValidation.isValid) {
					return createErrorResponse(
						`Invalid fields: ${fieldsValidation.errors.join(", ")}`,
						"INVALID_FIELD_DEFINITIONS",
					);
				}

				// Generate new JSON schema
				const jsonSchema = SchemaValidator.generateJsonSchema(fields);

				// Update collection validator
				await db.command({
					collMod: collectionName,
					validator: { $jsonSchema: jsonSchema },
					validationLevel: "strict",
					validationAction: "error",
				});

				return createSuccessResponse(
					{
						databaseName,
						collectionName,
						validationUpdated: true,
						totalFields: fields.length,
						requiredFields: fields.filter((f) => f.required).length,
					},
					`Updated validation for '${collectionName}' with ${fields.length} field(s)`,
				);
			}

			// UPDATE OPTIONS operation
			if (operation === "updateOptions") {
				if (!options) {
					return createErrorResponse(
						"options object required for updateOptions",
						"MISSING_OPTIONS",
					);
				}

				const collModOptions: any = { collMod: collectionName };

				if (options.validationLevel !== undefined) {
					collModOptions.validationLevel = options.validationLevel;
				}
				if (options.validationAction !== undefined) {
					collModOptions.validationAction = options.validationAction;
				}

				// Note: capped, size, max cannot be modified after collection creation
				if (options.capped !== undefined) {
					return createErrorResponse(
						"Capped property cannot be changed after collection creation",
						"CANNOT_MODIFY_CAPPED",
					);
				}

				await db.command(collModOptions);

				return createSuccessResponse(
					{
						databaseName,
						collectionName,
						optionsUpdated: true,
						updatedOptions: options,
					},
					`Updated options for '${collectionName}'`,
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
					: "Failed to update collection",
				"UPDATE_COLLECTION_FAILED",
			);
		}
	},
};
