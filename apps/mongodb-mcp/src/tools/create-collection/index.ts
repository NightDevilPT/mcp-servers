// src/tools/create-collection/index.ts
import { z } from "zod";
import { MongoClient } from "mongodb";

// Valid MongoDB BSON types (only these are accepted)
const validMongoDBTypes = [
	"string",
	"int",
	"long",
	"double",
	"decimal",
	"bool",
	"date",
	"timestamp",
	"objectId",
	"array",
	"object",
	"null",
	"binary",
	"regex",
	"javascript",
	"javascriptWithScope",
] as const;

type MongoDBType = (typeof validMongoDBTypes)[number];

// Interface for field definition
interface FieldDefinition {
	fieldName: string;
	fieldType: MongoDBType;
	required?: boolean;
	description?: string;
	minLength?: number;
	maxLength?: number;
	minimum?: number;
	maximum?: number;
	pattern?: string;
	enum?: any[];
}

// Validation function for field names
function validateFieldName(name: string): { valid: boolean; error?: string } {
	if (!name || name.trim() === "") {
		return { valid: false, error: "Field name cannot be empty" };
	}

	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
		return {
			valid: false,
			error: "Field name must start with a letter or underscore and contain only letters, numbers, or underscores",
		};
	}

	if (name.startsWith("$")) {
		return { valid: false, error: "Field name cannot start with '$'" };
	}

	if (name.includes(".")) {
		return { valid: false, error: "Field name cannot contain '.'" };
	}

	return { valid: true };
}

// Validation function for field type - NO ALIASES, only valid types
function validateFieldType(type: string): { valid: boolean; error?: string } {
	const normalizedType = type.toLowerCase().trim();

	// Direct check - no aliases
	if (validMongoDBTypes.includes(normalizedType as MongoDBType)) {
		return { valid: true };
	}

	return {
		valid: false,
		error: `Invalid field type '${type}'. Valid types are: ${validMongoDBTypes.join(", ")}`,
	};
}

// Recursive function to get fields from user until valid
async function getValidFields(
	extra: any,
	previousErrors?: string[],
): Promise<FieldDefinition[]> {
	let errorMessage = "";
	if (previousErrors && previousErrors.length > 0) {
		errorMessage =
			"\n\n❌ Previous errors:\n" +
			previousErrors.map((e) => `  • ${e}`).join("\n") +
			"\n\nPlease fix the issues and try again:\n";
	}

	const fieldsResult = await extra.server.elicitInput({
		message: `📝 Define the schema for your collection${errorMessage}\n\nEnter fields as JSON array. Each field must have:\n• fieldName (required): Field name (letters, numbers, underscore)\n• fieldType (required): ${validMongoDBTypes.join(", ")}\n• required (optional): true/false\n• description (optional): Field description\n• minLength/maxLength (for string type)\n• minimum/maximum (for int, long, double, decimal types)\n\nExample:\n[\n  {\n    "fieldName": "username",\n    "fieldType": "string",\n    "required": true,\n    "minLength": 3,\n    "maxLength": 50\n  },\n  {\n    "fieldName": "age",\n    "fieldType": "int",\n    "minimum": 0,\n    "maximum": 150\n  },\n  {\n    "fieldName": "isActive",\n    "fieldType": "bool"\n  }\n]`,
		requestedSchema: {
			type: "object",
			properties: {
				fieldsJson: {
					type: "string",
					title: "Fields Definition (JSON)",
					description: "JSON array of field definitions",
				},
			},
			required: ["fieldsJson"],
		},
	});

	if (fieldsResult.action !== "accept") {
		return [];
	}

	const fieldsJson = fieldsResult.content?.fieldsJson;
	if (!fieldsJson) {
		return [];
	}

	try {
		const fields = JSON.parse(fieldsJson);

		if (!Array.isArray(fields)) {
			throw new Error("Fields must be a JSON array");
		}

		if (fields.length === 0) {
			throw new Error("At least one field is required");
		}

		const validationErrors: string[] = [];
		const validFields: FieldDefinition[] = [];

		for (let i = 0; i < fields.length; i++) {
			const field = fields[i];
			const fieldIndex = i + 1;

			// Validate field name
			if (!field.fieldName) {
				validationErrors.push(
					`Field ${fieldIndex}: Missing 'fieldName' property`,
				);
				continue;
			}

			const nameValidation = validateFieldName(field.fieldName);
			if (!nameValidation.valid) {
				validationErrors.push(
					`Field ${fieldIndex} (${field.fieldName}): ${nameValidation.error}`,
				);
				continue;
			}

			// Validate field type
			if (!field.fieldType) {
				validationErrors.push(
					`Field ${fieldIndex} (${field.fieldName}): Missing 'fieldType' property`,
				);
				continue;
			}

			const typeValidation = validateFieldType(field.fieldType);
			if (!typeValidation.valid) {
				validationErrors.push(
					`Field ${fieldIndex} (${field.fieldName}): ${typeValidation.error}`,
				);
				continue;
			}

			const normalizedType = field.fieldType
				.toLowerCase()
				.trim() as MongoDBType;

			// Validate string constraints
			if (normalizedType === "string") {
				if (
					field.minLength !== undefined &&
					(typeof field.minLength !== "number" || field.minLength < 0)
				) {
					validationErrors.push(
						`Field ${fieldIndex} (${field.fieldName}): 'minLength' must be a non-negative number`,
					);
					continue;
				}
				if (
					field.maxLength !== undefined &&
					(typeof field.maxLength !== "number" || field.maxLength < 0)
				) {
					validationErrors.push(
						`Field ${fieldIndex} (${field.fieldName}): 'maxLength' must be a non-negative number`,
					);
					continue;
				}
				if (
					field.minLength !== undefined &&
					field.maxLength !== undefined &&
					field.minLength > field.maxLength
				) {
					validationErrors.push(
						`Field ${fieldIndex} (${field.fieldName}): 'minLength' cannot be greater than 'maxLength'`,
					);
					continue;
				}
				if (
					field.pattern !== undefined &&
					typeof field.pattern !== "string"
				) {
					validationErrors.push(
						`Field ${fieldIndex} (${field.fieldName}): 'pattern' must be a string`,
					);
					continue;
				}
			}

			// Validate number constraints for int, long, double, decimal
			if (["int", "long", "double", "decimal"].includes(normalizedType)) {
				if (
					field.minimum !== undefined &&
					typeof field.minimum !== "number"
				) {
					validationErrors.push(
						`Field ${fieldIndex} (${field.fieldName}): 'minimum' must be a number`,
					);
					continue;
				}
				if (
					field.maximum !== undefined &&
					typeof field.maximum !== "number"
				) {
					validationErrors.push(
						`Field ${fieldIndex} (${field.fieldName}): 'maximum' must be a number`,
					);
					continue;
				}
				if (
					field.minimum !== undefined &&
					field.maximum !== undefined &&
					field.minimum > field.maximum
				) {
					validationErrors.push(
						`Field ${fieldIndex} (${field.fieldName}): 'minimum' cannot be greater than 'maximum'`,
					);
					continue;
				}
			}

			// Validate enum
			if (field.enum !== undefined && !Array.isArray(field.enum)) {
				validationErrors.push(
					`Field ${fieldIndex} (${field.fieldName}): 'enum' must be an array`,
				);
				continue;
			}

			// Validate required
			if (
				field.required !== undefined &&
				typeof field.required !== "boolean"
			) {
				validationErrors.push(
					`Field ${fieldIndex} (${field.fieldName}): 'required' must be a boolean`,
				);
				continue;
			}

			// Field is valid
			validFields.push({
				fieldName: field.fieldName,
				fieldType: normalizedType,
				required: field.required || false,
				description: field.description || `${field.fieldName} field`,
				...(field.minLength !== undefined && {
					minLength: field.minLength,
				}),
				...(field.maxLength !== undefined && {
					maxLength: field.maxLength,
				}),
				...(field.minimum !== undefined && { minimum: field.minimum }),
				...(field.maximum !== undefined && { maximum: field.maximum }),
				...(field.pattern && { pattern: field.pattern }),
				...(field.enum && { enum: field.enum }),
			});
		}

		if (validationErrors.length > 0) {
			// Recursively call with errors
			return getValidFields(extra, validationErrors);
		}

		if (validFields.length === 0) {
			throw new Error("No valid fields provided");
		}

		return validFields;
	} catch (parseError: any) {
		return getValidFields(extra, [
			`JSON Parse Error: ${parseError.message}`,
		]);
	}
}

export const CreateCollectionTool = {
	name: "create_collection",
	description: `[Database Administration] Create a new collection in MongoDB database with JSON schema validation.

HOW IT WORKS:
1. You provide database name and collection name
2. You define fields with valid MongoDB BSON types
3. The tool validates all field definitions
4. If validation fails, it will ask you to correct the fields
5. Once validated, creates collection with schema validation

VALID MONGODB BSON TYPES (case insensitive):
• string - Text data (supports minLength, maxLength, pattern, enum)
• int - Integer numbers (supports minimum, maximum)
• long - Long integers (supports minimum, maximum)
• double - Double precision floats (supports minimum, maximum)
• decimal - Decimal numbers (supports minimum, maximum)
• bool - Boolean true/false values
• date - Date/time values
• timestamp - Timestamp values
• objectId - MongoDB ObjectId
• array - Array of values
• object - Nested object
• null - Null values
• binary - Binary data
• regex - Regular expression
• javascript - JavaScript code

FIELD VALIDATION RULES:
• fieldName: Must start with letter/underscore, contain only letters/numbers/underscores
• fieldType: Must be one of the valid BSON types listed above (NO ALIASES)
• required: (boolean) Whether field is required in every document
• description: (string) Description of the field
• minLength: (number) Minimum string length (string type only)
• maxLength: (number) Maximum string length (string type only)
• pattern: (string) Regex pattern (string type only)
• minimum: (number) Minimum numeric value (int, long, double, decimal types only)
• maximum: (number) Maximum numeric value (int, long, double, decimal types only)
• enum: (array) Allowed values for the field

CORRECT FIELD TYPE EXAMPLES:
✅ "fieldType": "string"
✅ "fieldType": "int"
✅ "fieldType": "bool"
✅ "fieldType": "date"
✅ "fieldType": "objectId"

WRONG FIELD TYPE EXAMPLES:
❌ "fieldType": "text" (use "string")
❌ "fieldType": "boolean" (use "bool")
❌ "fieldType": "number" (use "int", "long", "double", or "decimal")
❌ "fieldType": "integer" (use "int")

EXAMPLE USAGE:
{
  "database": "myApp",
  "collection": "users",
  "fields": "[{\"fieldName\":\"email\",\"fieldType\":\"string\",\"required\":true},{\"fieldName\":\"age\",\"fieldType\":\"int\",\"minimum\":0,\"maximum\":150},{\"fieldName\":\"isActive\",\"fieldType\":\"bool\"}]"
}

NOTE: If fields are not provided, collection will be created without schema validation.`,
	inputSchema: {
		database: z
			.string()
			.describe("Name of the database where collection will be created"),
		collection: z
			.string()
			.describe(
				"Name of the collection to create (must be unique within the database)",
			),
		fields: z
			.string()
			.describe(
				'JSON string of field definitions. Use only valid BSON types: string, int, long, double, decimal, bool, date, timestamp, objectId, array, object, null, binary, regex, javascript. Example: \'[{"fieldName":"username","fieldType":"string","required":true},{"fieldName":"age","fieldType":"int"}]\'',
			),
	},
	execute: async (
		args: {
			database: string;
			collection: string;
			fields?: string;
		},
		extra: any,
	) => {
		let client: MongoClient | null = null;

		try {
			// Validate MongoDB URI
			if (!process.env.MONGODB_URI) {
				return {
					content: [
						{
							type: "text" as const,
							text: "Error: MONGODB_URI environment variable is not set",
						},
					],
					isError: true,
				};
			}

			let fieldsArray: FieldDefinition[] = [];

			// If fields are provided as string, parse and validate them
			if (args.fields) {
				try {
					const parsedFields = JSON.parse(args.fields);
					if (!Array.isArray(parsedFields)) {
						throw new Error("Fields must be an array");
					}

					// Validate each field
					const validationErrors: string[] = [];

					for (let i = 0; i < parsedFields.length; i++) {
						const field = parsedFields[i];
						const fieldIndex = i + 1;

						if (!field.fieldName) {
							validationErrors.push(
								`Field ${fieldIndex}: Missing 'fieldName' property`,
							);
							continue;
						}

						const nameValidation = validateFieldName(
							field.fieldName,
						);
						if (!nameValidation.valid) {
							validationErrors.push(
								`Field ${fieldIndex} (${field.fieldName}): ${nameValidation.error}`,
							);
							continue;
						}

						if (!field.fieldType) {
							validationErrors.push(
								`Field ${fieldIndex} (${field.fieldName}): Missing 'fieldType' property`,
							);
							continue;
						}

						const typeValidation = validateFieldType(
							field.fieldType,
						);
						if (!typeValidation.valid) {
							validationErrors.push(
								`Field ${fieldIndex} (${field.fieldName}): ${typeValidation.error}`,
							);
							continue;
						}

						const normalizedType = field.fieldType
							.toLowerCase()
							.trim() as MongoDBType;

						// Additional validation based on type
						if (normalizedType === "string") {
							if (
								field.minLength !== undefined &&
								(typeof field.minLength !== "number" ||
									field.minLength < 0)
							) {
								validationErrors.push(
									`Field ${fieldIndex} (${field.fieldName}): 'minLength' must be a non-negative number`,
								);
								continue;
							}
							if (
								field.maxLength !== undefined &&
								(typeof field.maxLength !== "number" ||
									field.maxLength < 0)
							) {
								validationErrors.push(
									`Field ${fieldIndex} (${field.fieldName}): 'maxLength' must be a non-negative number`,
								);
								continue;
							}
						}

						if (
							["int", "long", "double", "decimal"].includes(
								normalizedType,
							)
						) {
							if (
								field.minimum !== undefined &&
								typeof field.minimum !== "number"
							) {
								validationErrors.push(
									`Field ${fieldIndex} (${field.fieldName}): 'minimum' must be a number`,
								);
								continue;
							}
							if (
								field.maximum !== undefined &&
								typeof field.maximum !== "number"
							) {
								validationErrors.push(
									`Field ${fieldIndex} (${field.fieldName}): 'maximum' must be a number`,
								);
								continue;
							}
						}

						fieldsArray.push({
							fieldName: field.fieldName,
							fieldType: normalizedType,
							required: field.required || false,
							description:
								field.description || `${field.fieldName} field`,
							...(field.minLength !== undefined && {
								minLength: field.minLength,
							}),
							...(field.maxLength !== undefined && {
								maxLength: field.maxLength,
							}),
							...(field.minimum !== undefined && {
								minimum: field.minimum,
							}),
							...(field.maximum !== undefined && {
								maximum: field.maximum,
							}),
							...(field.pattern && { pattern: field.pattern }),
							...(field.enum && { enum: field.enum }),
						});
					}

					if (validationErrors.length > 0) {
						// If there are validation errors, use the interactive elicitation
						fieldsArray = await getValidFields(
							extra,
							validationErrors,
						);
						if (fieldsArray.length === 0) {
							return {
								content: [
									{
										type: "text" as const,
										text: "Collection creation cancelled due to invalid field definitions.",
									},
								],
								isError: false,
							};
						}
					}
				} catch (parseError: any) {
					// If JSON parsing fails, use interactive elicitation
					fieldsArray = await getValidFields(extra, [
						`JSON Parse Error: ${parseError.message}`,
					]);
					if (fieldsArray.length === 0) {
						return {
							content: [
								{
									type: "text" as const,
									text: "Collection creation cancelled due to invalid field definitions.",
								},
							],
							isError: false,
						};
					}
				}
			}

			// Prepare collection options
			const collectionOptions: any = {};

			// Add JSON schema validator if fields are provided
			if (fieldsArray.length > 0) {
				const jsonSchema: any = {
					bsonType: "object",
					required: fieldsArray
						.filter((f) => f.required)
						.map((f) => f.fieldName),
					properties: {},
				};

				fieldsArray.forEach((field) => {
					const property: any = {
						bsonType: field.fieldType,
						description: field.description,
					};

					// Add string validations
					if (field.fieldType === "string") {
						if (field.minLength !== undefined)
							property.minLength = field.minLength;
						if (field.maxLength !== undefined)
							property.maxLength = field.maxLength;
						if (field.pattern) property.pattern = field.pattern;
						if (field.enum) property.enum = field.enum;
					}

					// Add number validations for int, long, double, decimal
					if (
						["int", "long", "double", "decimal"].includes(
							field.fieldType,
						)
					) {
						if (field.minimum !== undefined)
							property.minimum = field.minimum;
						if (field.maximum !== undefined)
							property.maximum = field.maximum;
						if (field.enum) property.enum = field.enum;
					}

					jsonSchema.properties[field.fieldName] = property;
				});

				collectionOptions.validator = { $jsonSchema: jsonSchema };
				collectionOptions.validationLevel = "strict";
				collectionOptions.validationAction = "error";
			}

			// Connect to MongoDB
			client = new MongoClient(process.env.MONGODB_URI);
			await client.connect();

			const db = client.db(args.database);

			// Create the collection
			await db.createCollection(args.collection, collectionOptions);

			// Success response
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								success: true,
								database: args.database,
								collection: args.collection,
								message: `Collection '${args.collection}' created successfully in database '${args.database}'`,
								schema:
									fieldsArray.length > 0
										? {
												fields: fieldsArray.map(
													(f) => ({
														fieldName: f.fieldName,
														fieldType: f.fieldType,
														required: f.required,
														description:
															f.description,
														...(f.minLength !==
															undefined && {
															minLength:
																f.minLength,
														}),
														...(f.maxLength !==
															undefined && {
															maxLength:
																f.maxLength,
														}),
														...(f.minimum !==
															undefined && {
															minimum: f.minimum,
														}),
														...(f.maximum !==
															undefined && {
															maximum: f.maximum,
														}),
														...(f.pattern && {
															pattern: f.pattern,
														}),
														...(f.enum && {
															enum: f.enum,
														}),
													}),
												),
												validationLevel: "strict",
											}
										: "No schema validation applied",
							},
							null,
							2,
						),
					},
				],
				_meta: {
					timestamp: new Date().toISOString(),
				},
			};
		} catch (error: any) {
			// Handle specific MongoDB errors
			if (error.code === 48) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Error: Collection '${args.collection}' already exists in database '${args.database}'. Please choose a different collection name.`,
						},
					],
					isError: true,
				};
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `Error creating collection: ${error.message}`,
					},
				],
				isError: true,
			};
		} finally {
			// Always close the connection
			if (client) {
				await client.close();
			}
		}
	},
};
