// apps/mongodb-mcp/src/tools/data-administration/create-collection/index.ts

import { z } from "zod";
import {
	createErrorResponse,
	createSuccessResponse,
} from "../../../utils/mcp-error.utils";
import { MongoDBUtils } from "../../../utils/mongodb.utils";
import {
	SchemaValidator,
	FieldDefinitionSchema,
	SUPPORTED_TYPES,
} from "../../../utils/schema-validation";
import { FormGenerator } from "../../../utils/form-generator";

export const CreateCollectionTool = {
	name: "create_collection",
	description: `[Database Administration] Create collection with JSON schema validation.

TYPES: ${SUPPORTED_TYPES.join(", ")}

SIMPLE EXAMPLE:
{
  "databaseName": "myapp",
  "collectionName": "users",
  "fields": [
    {"name": "email", "type": "string", "required": true},
    {"name": "age", "type": "int", "minimum": 0, "maximum": 150}
  ]
}

COMPLEX EXAMPLE (Product with Address):
{
  "databaseName": "ecommerce",
  "collectionName": "products",
  "fields": [
    {"name": "name", "type": "string", "required": true},
    {"name": "price", "type": "decimal", "required": true, "minimum": 0},
    {"name": "address", "type": "object", "properties": [
      {"name": "street", "type": "string", "required": true},
      {"name": "city", "type": "string", "required": true},
      {"name": "zipCode", "type": "string", "pattern": "^[0-9]{5}$"}
    ]},
    {"name": "tags", "type": "array", "items": {"type": "string"}}
  ]
}

FLOW:
1. Submit database name, collection name, and fields
2. Tool validates all fields
3. Shows confirmation form with field preview
4. User chooses: CONFIRM (create), EDIT (modify), or CANCEL
5. If EDIT, user modifies fields and resubmits
6. Repeat until CONFIRM or CANCEL`,

	inputSchema: {
		databaseName: z.string().describe("Existing database name"),
		collectionName: z.string().describe("Collection name"),
		fields: z
			.array(FieldDefinitionSchema)
			.min(1)
			.describe("Field definitions array")
			.refine(
				(fields) => {
					const fieldNames = fields.map((f) => f.name);
					return new Set(fieldNames).size === fieldNames.length;
				},
				{ message: "Field names must be unique" },
			),
		editMode: z
			.boolean()
			.optional()
			.default(false)
			.describe("Set to true when editing fields"),
		confirmed: z
			.boolean()
			.optional()
			.default(false)
			.describe("Set to true to skip confirmation"),
	},

	execute: async (
		args: {
			databaseName: string;
			collectionName: string;
			fields: z.infer<typeof FieldDefinitionSchema>[];
			editMode?: boolean;
			confirmed?: boolean;
		},
		extra: any,
	) => {
		try {
			let { databaseName, collectionName, fields, editMode, confirmed } =
				args;

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

			// Validate field definitions
			const fieldsValidation =
				SchemaValidator.validateFieldDefinitions(fields);
			if (!fieldsValidation.isValid) {
				if (editMode) {
					return createSuccessResponse(
						{
							editMode: true,
							validationErrors: fieldsValidation.errors,
							currentFields: fields,
							message: "Please fix the validation errors below",
							databaseName,
							collectionName,
						},
						`Validation errors: ${fieldsValidation.errors.join(", ")}`,
					);
				}
				return createErrorResponse(
					`Invalid fields: ${fieldsValidation.errors.join(", ")}`,
					"INVALID_FIELD_DEFINITIONS",
				);
			}

			// If confirmed is true, create the collection directly
			if (confirmed) {
				return await createCollection(
					databaseName,
					collectionName,
					fields,
				);
			}

			// Show confirmation form
			const confirmationResult = await showConfirmationForm(
				databaseName,
				collectionName,
				fields,
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

			if (confirmationResult.action === "edit") {
				// Return fields in edit mode for modification
				const fieldsWithEditInstructions = fields.map((field) => ({
					...field,
					_editHint: `Modify this field as needed. Field name: ${field.name}, Type: ${field.type}`,
				}));

				return createSuccessResponse(
					{
						editMode: true,
						message:
							"Please review and edit the field definitions below",
						currentFields: fieldsWithEditInstructions,
						instructions: `
To edit a field:
1. Change the field name, type, or constraints
2. Add or remove fields from the array
3. For nested objects, modify the properties array
4. For arrays, modify the items definition

After making changes, submit again with confirmed: true
`,
						databaseName,
						collectionName,
						exampleFormat: {
							fieldExample: {
								name: "field_name",
								type: "string",
								required: true,
								minLength: 3,
								maxLength: 100,
							},
						},
					},
					"Edit mode: Modify fields and resubmit with confirmed: true",
				);
			}

			if (confirmationResult.action === "confirm") {
				return await createCollection(
					databaseName,
					collectionName,
					fields,
				);
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
	fields: any[],
	extra: any,
): Promise<{ action: "confirm" | "edit" | "cancel" }> {
	// Build field preview
	const fieldPreview = fields
		.map((field, index) => {
			const constraints = SchemaValidator.getConstraintsSummary(field);
			return `
${index + 1}. **${field.name}**
   - Type: ${field.type}
   - Required: ${field.required ? "✅ Yes" : "❌ No"}
   ${field.description ? `- Description: ${field.description}\n` : ""}
   ${constraints.length > 0 ? `- Constraints: ${constraints.join(", ")}` : ""}
`;
		})
		.join("\n");

	const formSchema = {
		type: "object",
		properties: {
			action: {
				type: "string",
				title: "Confirm Collection Creation",
				description: `## 📋 Collection Details

**Database:** \`${databaseName}\`
**Collection:** \`${collectionName}\`
**Total Fields:** ${fields.length}
**Required Fields:** ${fields.filter((f: any) => f.required).length}

### Field Definitions:
${fieldPreview}

⚠️ **Warning**: This will create a collection with validation rules. This action is permanent.

Select an option:`,
				enum: ["confirm", "edit", "cancel"],
				enumNames: [
					"✅ CONFIRM - Create Collection Now",
					"✏️ EDIT - Modify Fields First",
					"❌ CANCEL - Abort Creation",
				],
			},
		},
		required: ["action"],
	};

	const generatedForm = FormGenerator.generateFormSchema(formSchema);

	const result = await extra.server.elicitInput({
		mode: "form",
		message: `## 🔍 Review Collection Configuration

Please review the collection configuration below before creating.

**Database:** ${databaseName}
**Collection:** ${collectionName}
**Fields:** ${fields.length} fields (${fields.filter((f: any) => f.required).length} required)

Choose an action to proceed:`,
		requestedSchema: generatedForm,
	});

	if (result.action !== "accept") {
		return { action: "cancel" };
	}

	const { action } = result.content;

	if (action === "confirm") {
		return { action: "confirm" };
	} else if (action === "edit") {
		return { action: "edit" };
	}
	return { action: "cancel" };
}

async function createCollection(
	databaseName: string,
	collectionName: string,
	fields: any[],
) {
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

	// Generate and create JSON Schema
	const jsonSchema = SchemaValidator.generateJsonSchema(fields);
	await db.createCollection(collectionName, {
		validator: { $jsonSchema: jsonSchema },
		validationLevel: "strict",
		validationAction: "error",
	});

	// Prepare response
	const fieldSummary = fields.map((f) => ({
		name: f.name,
		type: f.type,
		required: f.required || false,
		constraints: SchemaValidator.getConstraintsSummary(f),
	}));

	return createSuccessResponse(
		{
			databaseName,
			collectionName,
			created: true,
			totalFields: fields.length,
			requiredFields: fields.filter((f) => f.required).length,
			fields: fieldSummary,
			jsonSchema: jsonSchema,
		},
		`✅ Collection '${collectionName}' created successfully in database '${databaseName}' with ${fields.length} field(s)`,
	);
}
