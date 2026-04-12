// apps/mongodb-mcp/src/tools/data-administration/add-fields/index.ts

import { z } from "zod";
import {
	createErrorResponse,
	createSuccessResponse,
} from "../../../utils/mcp-error.utils";
import { MongoDBUtils } from "../../../utils/mongodb.utils";
import {
	FieldDefinitionSchema,
	SchemaValidator,
} from "../../../utils/schema-validation";
import { FormGenerator } from "../../../utils/form-generator";

export const AddFieldsTool = {
	name: "add_fields",
	description: `[Database Administration] Add or update fields in an existing collection with JSON schema validation.

NOTE: This tool will ADD new fields and REPLACE/UPDATE existing fields with the new schema definitions. If a field already exists, its validation rules will be replaced with the new ones provided.

SUPPORTED FIELD TYPES:
- string: Text values with optional minLength, maxLength, pattern (regex)
- number: Numeric values (double by default) with optional minimum, maximum
- int: Integer values with optional minimum, maximum
- long: Long integer values with optional minimum, maximum
- double: Double precision float with optional minimum, maximum
- decimal: Decimal values with optional minimum, maximum
- boolean: True/false values
- date: ISO date values
- objectId: MongoDB ObjectId values
- array: Array of values with optional minItems, maxItems, and items type
- object: Nested object with properties

EXAMPLE 1 - Add a new email field:
{
  "databaseName": "myapp",
  "collectionName": "users",
  "fields": [
    {
      "name": "email",
      "type": "string",
      "required": true,
      "description": "User email address",
      "pattern": "^[^@]+@[^@]+\\.[^@]+$",
      "maxLength": 255
    }
  ]
}

EXAMPLE 2 - Update existing age field with new validation:
{
  "databaseName": "myapp",
  "collectionName": "users",
  "fields": [
    {
      "name": "age",
      "type": "int",
      "required": true,
      "minimum": 18,
      "maximum": 100
    }
  ]
}

EXAMPLE 3 - Add multiple fields (some new, some updates):
{
  "databaseName": "myapp",
  "collectionName": "products",
  "fields": [
    {
      "name": "price",
      "type": "decimal",
      "required": true,
      "minimum": 0,
      "maximum": 999999.99
    },
    {
      "name": "inStock",
      "type": "boolean",
      "required": true
    },
    {
      "name": "tags",
      "type": "array",
      "required": false,
      "items": { "type": "string" },
      "minItems": 1,
      "maxItems": 10
    }
  ]
}

EXAMPLE 4 - Update nested object field:
{
  "databaseName": "myapp",
  "collectionName": "users",
  "fields": [
    {
      "name": "address",
      "type": "object",
      "required": true,
      "properties": [
        {
          "name": "street",
          "type": "string",
          "required": true,
          "maxLength": 200
        },
        {
          "name": "city",
          "type": "string",
          "required": true
        },
        {
          "name": "zipCode",
          "type": "string",
          "pattern": "^[0-9]{5}$"
        }
      ]
    }
  ]
}

FLOW:
1. Submit database name, collection name, and field definitions
2. Tool validates collection exists
3. Tool identifies which fields are new and which will be updated
4. Shows confirmation form with details
5. User confirms or cancels
6. Updates collection validator (ADD new fields, REPLACE existing ones)
7. Collection's JSON schema validator is updated`,

	inputSchema: {
		databaseName: z.string().describe("Existing database name"),
		collectionName: z.string().describe("Existing collection name"),
		fields: z
			.array(FieldDefinitionSchema)
			.min(1)
			.describe("Array of field definitions following the schema above")
			.refine(
				(fields) => {
					const fieldNames = fields.map((f) => f.name);
					return new Set(fieldNames).size === fieldNames.length;
				},
				{ message: "Field names must be unique" },
			),
	},

	execute: async (
		args: {
			databaseName: string;
			collectionName: string;
			fields: any[];
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
					`Invalid database name: ${dbNameValidation.errors.join(", ")}

Database name rules:
- Only letters, numbers, underscores, and hyphens
- Maximum 64 characters
- Cannot be empty

Example valid name: "my_database", "app-data", "test123"`,
					"INVALID_DATABASE_NAME",
				);
			}

			// Validate collection name
			const collectionValidation =
				SchemaValidator.validateCollectionName(collectionName);
			if (!collectionValidation.isValid) {
				return createErrorResponse(
					`Invalid collection name: ${collectionValidation.errors.join(", ")}

Collection name rules:
- Only letters, numbers, underscores, and hyphens
- Maximum 255 characters
- Cannot start with 'system.'
- Cannot be empty

Example valid name: "users", "products_data", "user-profiles"`,
					"INVALID_COLLECTION_NAME",
				);
			}

			// Validate fields array
			if (!fields || fields.length === 0) {
				return createErrorResponse(
					`No fields provided. You must specify at least one field to add or update.

Example of adding a field:
{
  "databaseName": "myapp",
  "collectionName": "users",
  "fields": [
    {
      "name": "email",
      "type": "string",
      "required": true,
      "description": "User email address",
      "pattern": "^[^@]+@[^@]+\\.[^@]+$",
      "maxLength": 255
    }
  ]
}

To update an existing field, just provide the field with the new validation rules.`,
					"EMPTY_FIELDS_ARRAY",
				);
			}

			// Validate field definitions
			const fieldsValidation =
				SchemaValidator.validateFieldDefinitions(fields);
			if (!fieldsValidation.isValid) {
				return createErrorResponse(
					`Invalid field definition(s):\n${fieldsValidation.errors.join("\n")}

Please check your field definitions. Here's a correct example:

{
  "name": "age",              // Required: field name
  "type": "int",              // Required: string, number, int, boolean, etc.
  "required": true,           // Optional: default false
  "description": "User age",  // Optional
  "minimum": 0,               // Optional: for number types
  "maximum": 150              // Optional: for number types
}

For string type, you can use: minLength, maxLength, pattern
For array type, you can use: minItems, maxItems, items
For object type, you can use: properties

Supported types: string, number, int, long, double, decimal, boolean, date, objectId, array, object`,
					"INVALID_FIELD_DEFINITIONS",
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
					`Database '${databaseName}' does not exist. 

Before adding fields to a collection, you need to:
1. Create the database using the 'create_database' tool:
   {
     "databaseName": "${databaseName}"
   }

2. Create the collection using the 'create_collection' tool:
   {
     "databaseName": "${databaseName}",
     "collectionName": "${collectionName}"
   }

3. Then use this 'add_fields' tool to add fields with validation.

Alternatively, you can check existing databases using the 'list_databases' tool.`,
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
					`Collection '${collectionName}' does not exist in database '${databaseName}'. 

Before adding fields, you must create the collection first. Use the 'create_collection' tool:
{
  "databaseName": "${databaseName}",
  "collectionName": "${collectionName}"
}

After successfully creating the collection, you can use this 'add_fields' tool to add fields with validation.

To see existing collections in this database, use the 'list_collections' tool:
{
  "databaseName": "${databaseName}"
}`,
					"COLLECTION_NOT_FOUND",
				);
			}

			// Get current collection options
			const collectionOptions = await getCollectionOptions(
				db,
				collectionName,
			);
			const currentValidator = collectionOptions.validator || {};
			const currentValidationLevel =
				collectionOptions.validationLevel || "strict";
			const currentValidationAction =
				collectionOptions.validationAction || "error";

			// Get existing fields from current validator
			const existingFields = await getExistingFields(db, collectionName);

			// Identify which fields are new and which will be updated
			const newFieldNames = fields.map((f: any) => f.name);
			const fieldsToUpdate = newFieldNames.filter((name: string) =>
				existingFields.includes(name),
			);
			const fieldsToAdd = newFieldNames.filter(
				(name: string) => !existingFields.includes(name),
			);

			// Always show confirmation form
			const hasExistingValidation =
				Object.keys(currentValidator).length > 0;

			const confirmationResult = await showConfirmationForm(
				databaseName,
				collectionName,
				fields,
				existingFields,
				fieldsToAdd,
				fieldsToUpdate,
				hasExistingValidation,
				extra,
			);

			if (confirmationResult.action === "cancel") {
				return createSuccessResponse(
					{
						cancelled: true,
						message: "Add/update fields operation cancelled",
						databaseName,
						collectionName,
					},
					"Operation cancelled. No changes were made to the collection.",
				);
			}

			if (confirmationResult.action !== "confirm") {
				return createErrorResponse(
					"Invalid confirmation action. Please select either 'confirm' or 'cancel'.",
					"INVALID_ACTION",
				);
			}

			// Generate new JSON schema for all fields (this will replace existing ones)
			const newSchema = SchemaValidator.generateJsonSchema(fields);

			// Merge with existing validator (existing fields will be replaced by new ones)
			const updatedValidator = mergeValidators(
				currentValidator,
				newSchema,
				fields,
			);

			// Apply the validator to the collection
			await db.command({
				collMod: collectionName,
				validator: updatedValidator,
				validationLevel: currentValidationLevel,
				validationAction: currentValidationAction,
			});

			// Generate summary
			const summary = {
				databaseName,
				collectionName,
				operation: "merge_with_replace",
				hadExistingValidation: hasExistingValidation,
				fieldsAdded: fieldsToAdd,
				fieldsUpdated: fieldsToUpdate,
				fieldsDetails: fields.map((f: any) => ({
					name: f.name,
					type: f.type,
					required: f.required || false,
					constraints: SchemaValidator.getConstraintsSummary(f),
				})),
				validatorUpdated: true,
			};

			let message = `✅ Successfully processed ${fields.length} field(s) in '${collectionName}'`;
			if (fieldsToAdd.length > 0) {
				message += `\n   Added: ${fieldsToAdd.length} new field(s) - ${fieldsToAdd.join(", ")}`;
			}
			if (fieldsToUpdate.length > 0) {
				message += `\n   Updated: ${fieldsToUpdate.length} existing field(s) - ${fieldsToUpdate.join(", ")}`;
			}
			if (hasExistingValidation) {
				message += `\n\nNote: Existing validation rules were preserved. Updated fields now have new validation rules.`;
			} else {
				message += `\n\nNote: This collection now has validation rules for the specified fields.`;
			}

			return createSuccessResponse(summary, message);
		} catch (error) {
			return createErrorResponse(
				error instanceof Error
					? error.message
					: "Failed to add/update fields in collection. Please check your MongoDB connection and try again.",
				"ADD_FIELDS_FAILED",
			);
		}
	},
};

async function getCollectionOptions(
	db: any,
	collectionName: string,
): Promise<any> {
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

async function getExistingFields(
	db: any,
	collectionName: string,
): Promise<string[]> {
	try {
		const collectionOptions = await getCollectionOptions(
			db,
			collectionName,
		);

		if (
			collectionOptions.validator &&
			collectionOptions.validator.$jsonSchema
		) {
			const schema = collectionOptions.validator.$jsonSchema;
			if (schema.properties) {
				return Object.keys(schema.properties);
			}
		}

		const collection = db.collection(collectionName);
		const sample = await collection.findOne({});
		if (sample) {
			return Object.keys(sample);
		}

		return [];
	} catch (error) {
		return [];
	}
}

async function showConfirmationForm(
	databaseName: string,
	collectionName: string,
	fields: any[],
	existingFields: string[],
	fieldsToAdd: string[],
	fieldsToUpdate: string[],
	hasExistingValidation: boolean,
	extra: any,
): Promise<{ action: "confirm" | "cancel" }> {
	// Build field summary
	const fieldSummary = fields
		.map((field) => {
			const constraints = SchemaValidator.getConstraintsSummary(field);
			const isUpdate = existingFields.includes(field.name);
			const status = isUpdate ? "🔄 UPDATE" : "✨ NEW";
			return `  ${status} • ${field.name} (${field.type})${field.required ? " [REQUIRED]" : ""}${constraints.length ? `\n    Constraints: ${constraints.join(", ")}` : ""}`;
		})
		.join("\n");

	const updateWarning =
		fieldsToUpdate.length > 0
			? `⚠️  The following ${fieldsToUpdate.length} existing field(s) will have their validation rules REPLACED:\n   ${fieldsToUpdate.join(", ")}\n\n`
			: "";

	const addInfo =
		fieldsToAdd.length > 0
			? `✨ The following ${fieldsToAdd.length} new field(s) will be ADDED:\n   ${fieldsToAdd.join(", ")}\n\n`
			: "";

	const validationWarning = hasExistingValidation
		? "ℹ️  This collection already has validation rules. Existing validation will be preserved, but updated fields will have their rules replaced."
		: "ℹ️  This collection currently has no validation rules. New validation will be created.";

	const existingFieldsMsg =
		existingFields.length > 0
			? `\n\nExisting fields in collection: ${existingFields.join(", ")}`
			: "\n\nExisting fields in collection: none";

	const formSchema = {
		type: "object",
		properties: {
			action: {
				type: "string",
				title: "Confirm Add/Update Fields Operation",
				description: `## Operation Details

**Database:** ${databaseName}
**Collection:** ${collectionName}
**Operation:** ADD new fields + REPLACE validation for existing fields
**Total fields to process:** ${fields.length}

${validationWarning}

${updateWarning}${addInfo}

## Field Details:
${fieldSummary}${existingFieldsMsg}

⚠️  WARNING: Existing fields listed above as "UPDATE" will have their validation rules COMPLETELY REPLACED with the new definitions.

Select an option:`,
				enum: ["confirm", "cancel"],
				enumNames: [
					"CONFIRM - Add/Update Fields",
					"CANCEL - Abort Operation",
				],
			},
		},
		required: ["action"],
	};

	const generatedForm = FormGenerator.generateFormSchema(formSchema);

	const result = await extra.server.elicitInput({
		mode: "form",
		message: `Confirm adding/updating ${fields.length} field(s) in ${databaseName}.${collectionName}`,
		requestedSchema: generatedForm,
	});

	if (result.action !== "accept") {
		return { action: "cancel" };
	}

	const { action } = result.content;
	return action === "confirm" ? { action: "confirm" } : { action: "cancel" };
}

function mergeValidators(
	currentValidator: any,
	newSchema: any,
	newFields: any[],
): any {
	// If no current validator, just use new schema
	if (!currentValidator.$jsonSchema) {
		return { $jsonSchema: newSchema };
	}

	const currentSchema = currentValidator.$jsonSchema;

	// Merge properties - new schema properties will override existing ones
	const mergedProperties = {
		...currentSchema.properties,
		...newSchema.properties,
	};

	// Merge required array - add new required fields, keep existing
	const existingRequired = currentSchema.required || [];
	const newRequiredFields = newFields
		.filter((f) => f.required)
		.map((f) => f.name);
	const mergedRequired = [
		...new Set([...existingRequired, ...newRequiredFields]),
	];

	return {
		$jsonSchema: {
			bsonType: "object",
			properties: mergedProperties,
			required: mergedRequired,
			additionalProperties:
				currentSchema.additionalProperties !== undefined
					? currentSchema.additionalProperties
					: true,
		},
	};
}
