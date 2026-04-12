// apps/mongodb-mcp/src/tools/data-administration/create-collection/index.ts

import { z } from "zod";
import {
	createErrorResponse,
	createSuccessResponse,
} from "../../../utils/mcp-error.utils";
import { MongoDBUtils } from "../../../utils/mongodb.utils";
import { SchemaValidator } from "../../../utils/schema-validation";
import { FormGenerator } from "../../../utils/form-generator";

export const CreateCollectionTool = {
	name: "create_collection",
	description: `[Database Administration] Create empty collection in database.

EXAMPLE:
{
  "databaseName": "myapp",
  "collectionName": "users"
}

FLOW:
1. Submit database name and collection name
2. Tool validates names
3. Shows confirmation form
4. User confirms or cancels`,

	inputSchema: {
		databaseName: z.string().describe("Existing database name"),
		collectionName: z.string().describe("Collection name to create"),
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

			// Validate names
			const dbNameValidation =
				SchemaValidator.validateDatabaseName(databaseName);
			if (!dbNameValidation.isValid) {
				return createErrorResponse(
					`Invalid db name: ${dbNameValidation.errors.join(", ")}`,
					"INVALID_DATABASE_NAME",
				);
			}

			const collectionValidation =
				SchemaValidator.validateCollectionName(collectionName);
			if (!collectionValidation.isValid) {
				return createErrorResponse(
					`Invalid collection name: ${collectionValidation.errors.join(", ")}`,
					"INVALID_COLLECTION_NAME",
				);
			}

			// Show confirmation form
			const confirmationResult = await showConfirmationForm(
				databaseName,
				collectionName,
				extra,
			);

			if (confirmationResult.action === "cancel") {
				return createSuccessResponse(
					{
						cancelled: true,
						message: "Collection creation cancelled",
						databaseName,
						collectionName,
					},
					"Collection creation cancelled",
				);
			}

			if (confirmationResult.action === "confirm") {
				return await createCollection(databaseName, collectionName);
			}

			return createErrorResponse(
				"Invalid confirmation action",
				"INVALID_ACTION",
			);
		} catch (error) {
			return createErrorResponse(
				error instanceof Error
					? error.message
					: "Failed to create collection",
				"COLLECTION_CREATION_FAILED",
			);
		}
	},
};

async function showConfirmationForm(
	databaseName: string,
	collectionName: string,
	extra: any,
): Promise<{ action: "confirm" | "cancel" }> {
	const formSchema = {
		type: "object",
		properties: {
			action: {
				type: "string",
				title: "Confirm Collection Creation",
				description: `## Collection Details

**Database:** ${databaseName}
**Collection:** ${collectionName}

Warning: This will create a new collection.

Select an option:`,
				enum: ["confirm", "cancel"],
				enumNames: [
					"CONFIRM - Create Collection",
					"CANCEL - Abort Creation",
				],
			},
		},
		required: ["action"],
	};

	const generatedForm = FormGenerator.generateFormSchema(formSchema);

	const result = await extra.server.elicitInput({
		mode: "form",
		message: `Confirm collection creation:
Database: ${databaseName}
Collection: ${collectionName}`,
		requestedSchema: generatedForm,
	});

	if (result.action !== "accept") {
		return { action: "cancel" };
	}

	const { action } = result.content;
	return action === "confirm" ? { action: "confirm" } : { action: "cancel" };
}

async function createCollection(databaseName: string, collectionName: string) {
	await MongoDBUtils.testConnection();
	const client = await MongoDBUtils.getClient();
	const db = client.db(databaseName);

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

	// Check if collection exists
	const collections = await db
		.listCollections({ name: collectionName })
		.toArray();

	if (collections.length > 0) {
		return createErrorResponse(
			`Collection '${collectionName}' already exists in database '${databaseName}'`,
			"COLLECTION_ALREADY_EXISTS",
		);
	}

	// Create empty collection
	await db.createCollection(collectionName);

	return createSuccessResponse(
		{
			databaseName,
			collectionName,
			created: true,
		},
		`Collection '${collectionName}' created successfully in database '${databaseName}'`,
	);
}
