// apps/mongodb-mcp/src/tools/data-administration/remove-fields/index.ts

import { z } from "zod";
import {
	createErrorResponse,
	createSuccessResponse,
} from "../../../utils/mcp-error.utils";
import { MongoDBUtils } from "../../../utils/mongodb.utils";
import { SchemaValidator } from "../../../utils/schema-validation";
import { FormGenerator } from "../../../utils/form-generator";

export const RemoveFieldsTool = {
	name: "remove_fields",
	description: `[Database Administration] Remove validation rules for fields from collection. Does NOT delete existing data.

WHAT IT DOES:
- Removes fields from collection's JSON schema validator
- Future documents won't need validation for these fields
- Existing documents keep all their data unchanged

EXAMPLE:
{
  "databaseName": "myapp",
  "collectionName": "users",
  "fields": ["age", "middleName"]
}

FLOW:
1. Submit database name, collection name, and fields to remove
2. Tool validates collection exists
3. Shows confirmation form
4. User confirms or cancels
5. Removes fields from validator`,

	inputSchema: {
		databaseName: z.string().describe("Existing database name"),
		collectionName: z.string().describe("Existing collection name"),
		fields: z
			.array(z.string())
			.min(1)
			.describe("Array of field names to remove from validation"),
	},

	execute: async (
		args: {
			databaseName: string;
			collectionName: string;
			fields: string[];
		},
		extra: any,
	) => {
		try {
			const { databaseName, collectionName, fields } = args;

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
					`Database '${databaseName}' not found. Create it first using create_database tool.`,
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
					`Collection '${collectionName}' not found in database '${databaseName}'`,
					"COLLECTION_NOT_FOUND",
				);
			}

			// Get current collection options
			const collectionOptions = await getCollectionOptions(db, collectionName);
			const currentValidator = collectionOptions.validator || {};
			const currentValidationLevel = collectionOptions.validationLevel || "strict";
			const currentValidationAction = collectionOptions.validationAction || "error";

			// Check if collection has validator
			if (!currentValidator.$jsonSchema) {
				return createErrorResponse(
					`Collection '${collectionName}' has no validation rules to remove.`,
					"NO_VALIDATOR_FOUND",
				);
			}

			const currentSchema = currentValidator.$jsonSchema;
			const existingProperties = currentSchema.properties || {};

			// Check which fields exist
			const fieldsToRemove = fields.filter(f => existingProperties[f]);
			const fieldsNotFound = fields.filter(f => !existingProperties[f]);

			if (fieldsToRemove.length === 0) {
				return createErrorResponse(
					`None of the specified fields exist in the validator. Existing fields: ${Object.keys(existingProperties).join(", ")}`,
					"NO_FIELDS_TO_REMOVE",
				);
			}

			// Show confirmation form
			const confirmationResult = await showConfirmationForm(
				databaseName,
				collectionName,
				fieldsToRemove,
				fieldsNotFound,
				extra,
			);

			if (confirmationResult.action === "cancel") {
				return createSuccessResponse(
					{
						cancelled: true,
						message: "Remove fields operation cancelled",
						databaseName,
						collectionName,
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

			// Create updated schema without removed fields
			const updatedProperties = { ...existingProperties };
			for (const field of fieldsToRemove) {
				delete updatedProperties[field];
			}

			// Update required array
			const requiredFields = currentSchema.required || [];
			const updatedRequired = requiredFields.filter((f: string) => !fieldsToRemove.includes(f));

			// Create updated validator
			let updatedValidator: any;
			if (Object.keys(updatedProperties).length === 0) {
				updatedValidator = {};
			} else {
				updatedValidator = {
					$jsonSchema: {
						bsonType: "object",
						properties: updatedProperties,
						...(updatedRequired.length > 0 && { required: updatedRequired }),
						additionalProperties: currentSchema.additionalProperties !== undefined 
							? currentSchema.additionalProperties 
							: true,
					},
				};
			}

			// Apply the validator
			await db.command({
				collMod: collectionName,
				validator: updatedValidator,
				validationLevel: currentValidationLevel,
				validationAction: currentValidationAction,
			});

			return createSuccessResponse(
				{
					databaseName,
					collectionName,
					fieldsRemoved: fieldsToRemove,
					fieldsNotFound: fieldsNotFound.length > 0 ? fieldsNotFound : undefined,
					validatorUpdated: true,
				},
				`Removed ${fieldsToRemove.length} field(s) from validator: ${fieldsToRemove.join(", ")}${fieldsNotFound.length > 0 ? `. Fields not found: ${fieldsNotFound.join(", ")}` : ""}`,
			);
		} catch (error) {
			return createErrorResponse(
				error instanceof Error ? error.message : "Failed to remove fields",
				"REMOVE_FIELDS_FAILED",
			);
		}
	},
};

async function getCollectionOptions(db: any, collectionName: string): Promise<any> {
	try {
		const collections = await db
			.listCollections({ name: collectionName }, { nameOnly: false })
			.toArray();
		
		if (collections.length > 0 && collections[0].options) {
			return collections[0].options;
		}
		
		return {};
	} catch (error) {
		return {};
	}
}

async function showConfirmationForm(
	databaseName: string,
	collectionName: string,
	fieldsToRemove: string[],
	fieldsNotFound: string[],
	extra: any,
): Promise<{ action: "confirm" | "cancel" }> {
	const formSchema = {
		type: "object",
		properties: {
			action: {
				type: "string",
				title: "Confirm Remove Fields",
				description: `## Remove Validation Rules

**Database:** ${databaseName}
**Collection:** ${collectionName}
**Fields to remove:** ${fieldsToRemove.join(", ")}

${fieldsNotFound.length > 0 ? `**Fields not found (will be ignored):** ${fieldsNotFound.join(", ")}\n\n` : ""}

⚠️  WARNING:
- This only removes VALIDATION rules, NOT actual data
- Existing documents will keep their data
- Future documents won't need validation for these fields

Select an option:`,
				enum: ["confirm", "cancel"],
				enumNames: ["CONFIRM - Remove Fields", "CANCEL - Abort"],
			},
		},
		required: ["action"],
	};

	const generatedForm = FormGenerator.generateFormSchema(formSchema);

	const result = await extra.server.elicitInput({
		mode: "form",
		message: `Confirm removing ${fieldsToRemove.length} field(s) from validator`,
		requestedSchema: generatedForm,
	});

	if (result.action !== "accept") {
		return { action: "cancel" };
	}

	const { action } = result.content;
	return action === "confirm" ? { action: "confirm" } : { action: "cancel" };
}