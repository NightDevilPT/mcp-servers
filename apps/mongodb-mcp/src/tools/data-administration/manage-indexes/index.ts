// apps/mongodb-mcp/src/tools/data-administration/manage-indexes/index.ts

import { z } from "zod";
import {
	createErrorResponse,
	createSuccessResponse,
} from "../../../utils/mcp-error.utils";
import { MongoDBUtils } from "../../../utils/mongodb.utils";
import { SchemaValidator } from "../../../utils/schema-validation";
import { FormGenerator } from "../../../utils/form-generator";

export const ManageIndexesTool = {
	name: "manage_indexes",
	description: `[Database Administration] Manage indexes on collection fields using an interactive form.

FLOW:
1. Submit database name and collection name
2. Tool validates collection exists
3. Tool fetches all fields and current indexes
4. Shows dynamic form with checkboxes for each field
5. User checks/unchecks fields to add/remove indexes
6. Tool applies index changes (adds new indexes, drops removed indexes)

EXAMPLE:
{
  "databaseName": "myapp",
  "collectionName": "users"
}

NOTES:
- _id field is always indexed by default (cannot be removed)
- Index names are auto-generated: idx_{fieldName}
- Dropping indexes improves write performance but may slow down queries
- Adding indexes improves query performance but uses storage space`,

	inputSchema: {
		databaseName: z.string().describe("Existing database name"),
		collectionName: z.string().describe("Existing collection name"),
	},

	execute: async (
		args: {
			databaseName: string;
			collectionName: string;
		},
		extra: any,
	) => {
		try {
			const { databaseName, collectionName } = args;

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
					`Collection '${collectionName}' not found in database '${databaseName}'. 

Before managing indexes, you must create the collection first. Use the 'create_collection' tool:
{
  "databaseName": "${databaseName}",
  "collectionName": "${collectionName}"
}`,
					"COLLECTION_NOT_FOUND",
				);
			}

			const collection = db.collection(collectionName);

			// Get all existing indexes
			const existingIndexes = await collection.indexes();

			// Get all fields from the collection
			const fields = await getAllFields(db, collectionName, collection);

			// Check if collection has any fields (excluding _id)
			const userFields = fields.filter((f) => f !== "_id");

			if (userFields.length === 0) {
				return createSuccessResponse(
					{
						databaseName,
						collectionName,
						message: "No fields available for indexing",
						reason: "Collection has no user-defined fields",
						suggestion:
							"Add fields to the collection first using the 'add_fields' tool before managing indexes.",
					},
					`Collection '${collectionName}' has no fields to index. 

This collection only contains the default '_id' field which is automatically indexed.

To add fields to this collection, use the 'add_fields' tool:
{
  "databaseName": "${databaseName}",
  "collectionName": "${collectionName}",
  "fields": [
    {
      "name": "exampleField",
      "type": "string",
      "required": true
    }
  ]
}

After adding fields, you can use this 'manage_indexes' tool to create indexes on those fields.`,
				);
			}

			// Get current indexed fields (excluding _id which is always indexed)
			const indexedFields = new Set<string>();
			for (const index of existingIndexes) {
				if (index.name === "_id_") continue;
				if (index.key && Object.keys(index.key).length === 1) {
					const fieldName = Object.keys(index.key)[0];
					indexedFields.add(fieldName);
				}
			}

			// Show form to manage indexes
			const indexManagementResult = await showIndexManagementForm(
				databaseName,
				collectionName,
				fields,
				indexedFields,
				extra,
			);

			if (indexManagementResult.action === "cancel") {
				return createSuccessResponse(
					{
						cancelled: true,
						message: "Index management cancelled",
						databaseName,
						collectionName,
					},
					"Operation cancelled. No index changes were made.",
				);
			}

			const { fieldsToIndex, fieldsToRemoveIndex } =
				indexManagementResult;

			// Track changes
			const addedIndexes: string[] = [];
			const removedIndexes: string[] = [];
			const failedChanges: { field: string; error: string }[] = [];

			// Remove indexes that were unchecked
			for (const field of fieldsToRemoveIndex) {
				try {
					const indexName = `idx_${field}`;
					await collection.dropIndex(indexName);
					removedIndexes.push(field);
				} catch (error) {
					failedChanges.push({
						field,
						error:
							error instanceof Error
								? error.message
								: "Unknown error",
					});
				}
			}

			// Add indexes for newly checked fields
			for (const field of fieldsToIndex) {
				try {
					const indexName = `idx_${field}`;
					await collection.createIndex(
						{ [field]: 1 },
						{ name: indexName },
					);
					addedIndexes.push(field);
				} catch (error) {
					failedChanges.push({
						field,
						error:
							error instanceof Error
								? error.message
								: "Unknown error",
					});
				}
			}

			// Get final index list
			const finalIndexes = await collection.indexes();
			const finalIndexedFields = new Set<string>();
			for (const index of finalIndexes) {
				if (index.name === "_id_") continue;
				if (index.key && Object.keys(index.key).length === 1) {
					const fieldName = Object.keys(index.key)[0];
					finalIndexedFields.add(fieldName);
				}
			}

			// Generate summary
			const summary = {
				databaseName,
				collectionName,
				indexesAdded: addedIndexes,
				indexesRemoved: removedIndexes,
				failedChanges:
					failedChanges.length > 0 ? failedChanges : undefined,
				currentIndexedFields: Array.from(finalIndexedFields),
				totalIndexCount: finalIndexes.length - 1,
				changesApplied:
					addedIndexes.length > 0 || removedIndexes.length > 0,
			};

			let message = "";
			if (addedIndexes.length > 0 && removedIndexes.length > 0) {
				message = `Successfully added indexes on ${addedIndexes.length} field(s) and removed indexes from ${removedIndexes.length} field(s) in '${collectionName}'`;
				message += `\n   Added: ${addedIndexes.join(", ")}`;
				message += `\n   Removed: ${removedIndexes.join(", ")}`;
			} else if (addedIndexes.length > 0) {
				message = `Successfully added indexes on ${addedIndexes.length} field(s) in '${collectionName}': ${addedIndexes.join(", ")}`;
			} else if (removedIndexes.length > 0) {
				message = `Successfully removed indexes from ${removedIndexes.length} field(s) in '${collectionName}': ${removedIndexes.join(", ")}`;
			} else {
				message = `No index changes were made to '${collectionName}'`;
			}

			if (failedChanges.length > 0) {
				message += `\n\nFailed changes: ${failedChanges.map((f) => `${f.field} (${f.error})`).join(", ")}`;
			}

			return createSuccessResponse(summary, message);
		} catch (error) {
			return createErrorResponse(
				error instanceof Error
					? error.message
					: "Failed to manage indexes",
				"MANAGE_INDEXES_FAILED",
			);
		}
	},
};

async function getAllFields(
	db: any,
	collectionName: string,
	collection: any,
): Promise<string[]> {
	const fields = new Set<string>();

	fields.add("_id");

	try {
		const collections = await db
			.listCollections({ name: collectionName }, { nameOnly: false })
			.toArray();

		if (
			collections.length > 0 &&
			collections[0].options &&
			collections[0].options.validator
		) {
			const validator = collections[0].options.validator;
			if (validator.$jsonSchema && validator.$jsonSchema.properties) {
				const schemaFields = Object.keys(
					validator.$jsonSchema.properties,
				);
				schemaFields.forEach((field) => fields.add(field));
			}
		}

		const sampleDocs = await collection.find({}).limit(10).toArray();
		for (const doc of sampleDocs) {
			Object.keys(doc).forEach((field) => fields.add(field));
		}
	} catch (error) {
		const sampleDoc = await collection.findOne({});
		if (sampleDoc) {
			Object.keys(sampleDoc).forEach((field) => fields.add(field));
		}
	}

	return Array.from(fields).sort();
}

async function showIndexManagementForm(
	databaseName: string,
	collectionName: string,
	fields: string[],
	indexedFields: Set<string>,
	extra: any,
): Promise<{
	action: "apply" | "cancel";
	fieldsToIndex: string[];
	fieldsToRemoveIndex: string[];
}> {
	const properties: Record<string, any> = {};

	// Add checkbox for each field
	for (const field of fields) {
		if (field === "_id") {
			properties[field] = {
				type: "string",
				title: `${field}`,
				description: "Always indexed (cannot be changed)",
				enum: ["indexed"],
			};
		} else {
			const isIndexed = indexedFields.has(field);
			properties[field] = {
				type: "boolean",
				title: field,
				description: isIndexed ? "Currently indexed" : "Not indexed",
				default: isIndexed,
			};
		}
	}

	properties.action = {
		type: "string",
		title: "Action",
		enum: ["apply", "cancel"],
	};

	const formSchema = {
		type: "object",
		description: "Manage indexes for the collection",
		properties: properties,
		required: ["action"],
	};

	const generatedForm = FormGenerator.generateFormSchema(formSchema);

	const statusMessage = `Manage indexes for ${databaseName}.${collectionName}

Current Status:
- Indexed fields: ${indexedFields.size > 0 ? Array.from(indexedFields).join(", ") : "none"}
- Available fields: ${fields.length}

Instructions:
- Check a field to ADD an index
- Uncheck a field to REMOVE its index
- _id field is always indexed and cannot be changed
- Click APPLY to save changes or CANCEL to abort`;

	const result = await extra.server.elicitInput({
		mode: "form",
		message: statusMessage,
		requestedSchema: generatedForm,
	});

	if (result.action !== "accept") {
		return { action: "cancel", fieldsToIndex: [], fieldsToRemoveIndex: [] };
	}

	const { action, ...selections } = result.content;

	if (action === "cancel") {
		return { action: "cancel", fieldsToIndex: [], fieldsToRemoveIndex: [] };
	}

	const fieldsToIndex: string[] = [];
	const fieldsToRemoveIndex: string[] = [];

	for (const [field, shouldBeIndexed] of Object.entries(selections)) {
		if (field === "_id") continue;

		const isCurrentlyIndexed = indexedFields.has(field);
		const shouldBeIndexedBool = shouldBeIndexed === true;

		if (shouldBeIndexedBool && !isCurrentlyIndexed) {
			fieldsToIndex.push(field);
		} else if (!shouldBeIndexedBool && isCurrentlyIndexed) {
			fieldsToRemoveIndex.push(field);
		}
	}

	return {
		action: "apply",
		fieldsToIndex,
		fieldsToRemoveIndex,
	};
}
