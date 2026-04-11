// src/tools/crud/insert-one/index.ts
import { z } from "zod";
import {
	withMongoConnection,
	handleMongoError,
	createCollectionResponse,
	CollectionInfo,
	CollectionSchema,
	generateDummyDocument,
	formatFieldDescription,
	generateFormSchema,
	generateFieldSummary,
} from "../../../utils";

export const InsertOneTool = {
	name: "insert_one",
	description: `[CRUD Operations] Insert a single document into a MongoDB collection with schema validation.

HOW IT WORKS:
1. Takes database name and collection name as input
2. Fetches collection details including schema validation rules
3. Analyzes the schema to understand field requirements and constraints
4. Generates a dummy document example based on the schema
5. Shows field descriptions and validation rules
6. Prompts user to input actual document data
7. Validates and inserts the document

FEATURES:
- Automatic schema detection from collection validators
- Field type validation (string, int, bool, date, etc.)
- Constraint validation (min/max length, min/max values, patterns, enums)
- Required field enforcement
- Dummy document generation for guidance
- Detailed field descriptions with examples

SUPPORTED FIELD TYPES:
- string, int, long, double, decimal
- bool, date, timestamp, objectId
- array, object, null, binary
- regex, javascript, javascriptWithScope

VALIDATION CONSTRAINTS:
- minLength/maxLength for strings
- minimum/maximum for numbers
- pattern for regex validation
- enum for allowed values
- required fields enforcement

EXAMPLE USAGE:
{
  "databaseName": "myApp",
  "collectionName": "users"
}

OUTPUT:
- Collection schema details
- Field descriptions with constraints
- Dummy document example
- Interactive input for actual document`,

	inputSchema: {
		databaseName: z
			.string()
			.describe("Name of the database containing the collection"),
		collectionName: z
			.string()
			.describe("Name of the collection to insert document into"),
	},
	execute: async (
		args: {
			databaseName: string;
			collectionName: string;
		},
		extra: any,
	) => {
		try {
			return await withMongoConnection(
				args.databaseName,
				async (client, db) => {
					// Get collection details
					const collections = await db.listCollections().toArray();
					const collectionInfo = collections.find(
						(c) => c.name === args.collectionName,
					);

					if (!collectionInfo) {
						return {
							content: [
								{
									type: "text" as const,
									text: `Error: Collection '${args.collectionName}' does not exist in database '${args.databaseName}'`,
								},
							],
							isError: true,
						};
					}

					// Extract schema information
					const collectionOptions =
						(collectionInfo as any).options || {};
					const validator = collectionOptions.validator;
					let schema: CollectionSchema | null = null;

					if (validator && validator.$jsonSchema) {
						schema = validator.$jsonSchema;
					}

					// Generate form schema based on collection schema
					let formSchema: any;
					let responseText: string;

					if (schema) {
						// Generate dynamic form schema
						const { properties, required } = generateFormSchema(schema);
						formSchema = {
							type: "object",
							properties,
							required,
						};

						// Generate field summary for the message
						responseText = `# Insert Document - ${args.collectionName}\n\n`;
						responseText += `Database: ${args.databaseName}\n`;
						responseText += `Collection: ${args.collectionName}\n`;
						responseText += `Validation: Strict schema validation enabled\n\n`;
						responseText += generateFieldSummary(schema);

						// Generate dummy document for reference
						const dummyDocument = generateDummyDocument(schema);
						responseText += `## Example Document\n\n`;
						responseText += `\`\`\`json\n${JSON.stringify(dummyDocument, null, 2)}\n\`\`\`\n\n`;
					} else {
						// No schema validation - use simple JSON input
						formSchema = {
							type: "object",
							properties: {
								document: {
									type: "string",
									title: "Document JSON",
									description: "The document to insert (in JSON format)",
								},
							},
							required: ["document"],
						};

						responseText = `# Insert Document - ${args.collectionName}\n\n`;
						responseText += `Database: ${args.databaseName}\n`;
						responseText += `Collection: ${args.collectionName}\n`;
						responseText += `Validation: No schema validation\n\n`;
						responseText += `This collection has no schema validation rules. You can insert any document structure.\n\n`;
						responseText += `## Example Document\n\n`;
						responseText += `\`\`\`json\n{\n  "exampleField": "exampleValue"\n}\n\`\`\`\n\n`;
					}

					// Get user input using dynamic form
					const documentResult = await extra.server.elicitInput({
						mode: "form",
						message: `${responseText}Please fill in the document fields:`,
						requestedSchema: formSchema,
					});

					if (documentResult.action !== "accept") {
						return {
							content: [
								{
									type: "text" as const,
									text: "Document insertion cancelled by user.",
								},
							],
							isError: false,
						};
					}

					// Extract document from form response
					let document: any;
					if (schema) {
						// Use the form data directly as the document
						document = documentResult.content || {};
					} else {
						// Parse JSON string for collections without schema
						const documentJson = documentResult.content?.document;
						if (!documentJson) {
							return {
								content: [
									{
										type: "text" as const,
										text: "Error: No document provided.",
									},
								],
								isError: true,
							};
						}

						try {
							document = JSON.parse(documentJson);
						} catch (parseError: any) {
							return {
								content: [
									{
										type: "text" as const,
										text: `Error: Invalid JSON format - ${parseError.message}`,
									},
								],
								isError: true,
							};
						}
					}

					// Insert the document
					const collection = db.collection(args.collectionName);
					const result = await collection.insertOne(document);

					return createCollectionResponse(
						args.databaseName,
						args.collectionName,
						`Document inserted successfully into collection '${args.collectionName}'`,
						{
							insertedId: result.insertedId.toString(),
							insertedDocument: document,
						},
					);
				},
			);
		} catch (error: any) {
			const handledError = handleMongoError(
				error,
				args.databaseName,
				args.collectionName,
			);
			if (handledError) {
				return handledError;
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `Error inserting document: ${error.message}`,
					},
				],
				isError: true,
			};
		}
	},
};
