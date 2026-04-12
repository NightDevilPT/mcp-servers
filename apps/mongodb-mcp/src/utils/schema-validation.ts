// apps/mongodb-mcp/src/utils/schema-validator.utils.ts

import { z } from "zod";

// Supported MongoDB field types
export const SUPPORTED_TYPES = [
	"string",
	"number",
	"boolean",
	"date",
	"objectId",
	"array",
	"object",
	"int",
	"long",
	"double",
	"decimal",
	"null",
] as const;

export type SupportedFieldType = (typeof SUPPORTED_TYPES)[number];

// Schema for primitive types (for array items)
const PrimitiveFieldSchema = z.object({
	type: z.enum([
		"string",
		"number",
		"boolean",
		"date",
		"objectId",
		"int",
		"long",
		"double",
		"decimal",
		"null",
	]),
	required: z.boolean().optional().default(false),
	description: z.string().optional(),
	// String constraints
	minLength: z.number().min(0).optional(),
	maxLength: z.number().min(1).optional(),
	pattern: z.string().optional(),
	// Number constraints
	minimum: z.number().optional(),
	maximum: z.number().optional(),
	exclusiveMinimum: z.number().optional(),
	exclusiveMaximum: z.number().optional(),
	multipleOf: z.number().positive().optional(),
	// Common
	enum: z.array(z.any()).optional(),
});

// Full field definition schema
export const FieldDefinitionSchema: z.ZodObject<any> = z.object({
	name: z.string().min(1).describe("Field name"),

	type: z
		.enum(SUPPORTED_TYPES)
		.describe(`Field bsonType. Supported: ${SUPPORTED_TYPES.join(", ")}`),

	required: z
		.boolean()
		.optional()
		.default(false)
		.describe("Field is required"),

	description: z.string().optional().describe("Field description"),

	// String constraints
	minLength: z.number().min(0).optional().describe("Minimum string length"),

	maxLength: z.number().min(1).optional().describe("Maximum string length"),

	pattern: z.string().optional().describe("Regex pattern for string"),

	// Numeric constraints
	minimum: z.number().optional().describe("Minimum numeric value"),

	maximum: z.number().optional().describe("Maximum numeric value"),

	exclusiveMinimum: z.number().optional().describe("Exclusive minimum"),

	exclusiveMaximum: z.number().optional().describe("Exclusive maximum"),

	multipleOf: z.number().positive().optional().describe("Multiple of"),

	// Array constraints - items can be primitive OR object schema
	items: z
		.union([PrimitiveFieldSchema, z.lazy(() => FieldDefinitionSchema)])
		.optional()
		.describe("Schema for array items (primitive or object)"),

	minItems: z.number().min(0).optional().describe("Minimum array length"),

	maxItems: z.number().min(1).optional().describe("Maximum array length"),

	uniqueItems: z.boolean().optional().describe("Array items must be unique"),

	// Object constraints
	properties: z
		.array(z.lazy(() => FieldDefinitionSchema))
		.optional()
		.describe("Nested object properties"),

	minProperties: z
		.number()
		.min(0)
		.optional()
		.describe("Minimum number of properties"),

	maxProperties: z
		.number()
		.min(1)
		.optional()
		.describe("Maximum number of properties"),

	additionalProperties: z
		.boolean()
		.optional()
		.default(true)
		.describe("Allow additional properties"),

	// Common constraints
	enum: z.array(z.any()).optional().describe("Array of allowed values"),
});

export interface ValidationResult {
	isValid: boolean;
	errors: string[];
}

export class SchemaValidator {
	static validateFieldDefinitions(fields: any[]): ValidationResult {
		const errors: string[] = [];

		for (let i = 0; i < fields.length; i++) {
			const field = fields[i];
			const fieldPath = `fields[${i}].${field.name || `unnamed`}`;

			if (!field.name) {
				errors.push(`Field at index ${i} is missing 'name' property`);
				continue;
			}

			// Check for unsupported keywords
			const unsupportedErrors = this.checkUnsupportedKeywords(
				field,
				fieldPath,
			);
			errors.push(...unsupportedErrors);

			// Validate type-specific constraints
			const typeErrors = this.validateTypeConstraints(field, fieldPath);
			errors.push(...typeErrors);

			// Recursively validate array items
			if (field.type === "array" && field.items) {
				// Check if items is primitive (no name required) or object (needs validation)
				if (field.items.name) {
					// It's an object schema, validate it
					const nestedResult = this.validateFieldDefinitions([
						field.items,
					]);
					errors.push(
						...nestedResult.errors.map(
							(e) => `${fieldPath}.items: ${e}`,
						),
					);
				} else {
					// It's a primitive type, validate its constraints
					const primitiveErrors = this.validatePrimitiveConstraints(
						field.items,
						`${fieldPath}.items`,
					);
					errors.push(...primitiveErrors);
				}
			}

			// Recursively validate object properties
			if (field.type === "object" && field.properties) {
				const nestedResult = this.validateFieldDefinitions(
					field.properties,
				);
				errors.push(
					...nestedResult.errors.map(
						(e) => `${fieldPath}.properties: ${e}`,
					),
				);
			}
		}

		return { isValid: errors.length === 0, errors };
	}

	private static validatePrimitiveConstraints(
		item: any,
		path: string,
	): string[] {
		const errors: string[] = [];
		const type = item.type;

		if (type === "string") {
			if (item.minLength !== undefined && item.minLength < 0) {
				errors.push(`${path}: minLength cannot be negative`);
			}
			if (
				item.minLength !== undefined &&
				item.maxLength !== undefined &&
				item.minLength > item.maxLength
			) {
				errors.push(`${path}: minLength > maxLength`);
			}
		}

		if (["number", "int", "long", "double", "decimal"].includes(type)) {
			if (
				item.minimum !== undefined &&
				item.maximum !== undefined &&
				item.minimum > item.maximum
			) {
				errors.push(`${path}: minimum > maximum`);
			}
		}

		return errors;
	}

	private static checkUnsupportedKeywords(
		field: any,
		fieldPath: string,
	): string[] {
		const errors: string[] = [];
		const unsupported = [
			"default",
			"format",
			"$ref",
			"$schema",
			"definitions",
			"id",
			"title",
		];

		for (const keyword of unsupported) {
			if (field[keyword] !== undefined) {
				errors.push(
					`${fieldPath}: '${keyword}' is NOT supported by MongoDB $jsonSchema. Remove it.`,
				);
			}
		}

		return errors;
	}

	private static validateTypeConstraints(
		field: any,
		fieldPath: string,
	): string[] {
		const errors: string[] = [];
		const type = field.type;

		// String type validation
		if (type === "string") {
			if (
				field.minimum !== undefined ||
				field.maximum !== undefined ||
				field.exclusiveMinimum !== undefined ||
				field.exclusiveMaximum !== undefined
			) {
				errors.push(
					`${fieldPath}: Numeric constraints not allowed on string type. Use minLength/maxLength.`,
				);
			}
			if (field.minLength !== undefined && field.minLength < 0) {
				errors.push(`${fieldPath}: minLength cannot be negative`);
			}
			if (
				field.minLength !== undefined &&
				field.maxLength !== undefined &&
				field.minLength > field.maxLength
			) {
				errors.push(
					`${fieldPath}: minLength (${field.minLength}) > maxLength (${field.maxLength})`,
				);
			}
		}

		// Numeric types validation
		if (["number", "int", "long", "double", "decimal"].includes(type)) {
			if (
				field.minLength !== undefined ||
				field.maxLength !== undefined ||
				field.pattern !== undefined
			) {
				errors.push(
					`${fieldPath}: String constraints not allowed on numeric type. Use minimum/maximum.`,
				);
			}
			if (
				field.minimum !== undefined &&
				field.maximum !== undefined &&
				field.minimum > field.maximum
			) {
				errors.push(
					`${fieldPath}: minimum (${field.minimum}) > maximum (${field.maximum})`,
				);
			}
		}

		// Boolean validation
		if (type === "boolean") {
			const invalidConstraints = [
				"minLength",
				"maxLength",
				"pattern",
				"minimum",
				"maximum",
				"exclusiveMinimum",
				"exclusiveMaximum",
				"multipleOf",
				"items",
				"properties",
			];
			const found = invalidConstraints.filter(
				(k) => field[k] !== undefined,
			);
			if (found.length > 0) {
				errors.push(
					`${fieldPath}: Boolean type only supports 'required', 'description', and 'enum'. Found: ${found.join(", ")}`,
				);
			}
		}

		// Date validation
		if (type === "date") {
			const invalidConstraints = [
				"minLength",
				"maxLength",
				"pattern",
				"minimum",
				"maximum",
				"items",
				"properties",
			];
			const found = invalidConstraints.filter(
				(k) => field[k] !== undefined,
			);
			if (found.length > 0) {
				errors.push(
					`${fieldPath}: Date type only supports 'required' and 'description'. Found: ${found.join(", ")}`,
				);
			}
		}

		// ObjectId validation
		if (type === "objectId") {
			const invalidConstraints = [
				"minLength",
				"maxLength",
				"pattern",
				"minimum",
				"maximum",
				"items",
				"properties",
			];
			const found = invalidConstraints.filter(
				(k) => field[k] !== undefined,
			);
			if (found.length > 0) {
				errors.push(
					`${fieldPath}: ObjectId type only supports 'required' and 'description'. Found: ${found.join(", ")}`,
				);
			}
		}

		// Array validation
		if (type === "array") {
			if (!field.items) {
				errors.push(
					`${fieldPath}: Array type must define 'items' schema`,
				);
			}
			if (field.pattern !== undefined) {
				errors.push(`${fieldPath}: pattern not allowed on array type`);
			}
		}

		// Object validation
		if (type === "object") {
			if (!field.properties && field.items) {
				errors.push(
					`${fieldPath}: Object type cannot have 'items'. Use 'properties'`,
				);
			}
		}

		// Enum validation
		if (field.enum && field.enum.length > 0) {
			if (type === "string") {
				const nonStrings = field.enum.filter(
					(v: any) => typeof v !== "string",
				);
				if (nonStrings.length > 0) {
					errors.push(
						`${fieldPath}: Enum for string must be strings. Found: ${nonStrings.join(", ")}`,
					);
				}
			} else if (
				["number", "int", "long", "double", "decimal"].includes(type)
			) {
				const nonNumbers = field.enum.filter(
					(v: any) => typeof v !== "number",
				);
				if (nonNumbers.length > 0) {
					errors.push(
						`${fieldPath}: Enum for number must be numbers. Found: ${nonNumbers.join(", ")}`,
					);
				}
			}
		}

		return errors;
	}

	static generateJsonSchema(fields: any[]): any {
		const properties: Record<string, any> = {};
		const required: string[] = [];

		for (const field of fields) {
			const propertySchema = this.mapFieldToJsonSchema(field);
			properties[field.name] = propertySchema;

			if (field.required) {
				required.push(field.name);
			}
		}

		const schema: any = {
			bsonType: "object",
			properties: properties,
			additionalProperties: true,
		};

		if (required.length > 0) {
			schema.required = required;
		}

		return schema;
	}

	private static mapFieldToJsonSchema(field: any): any {
		const schema: any = {};

		const typeMapping: Record<string, string> = {
			string: "string",
			number: "number",
			int: "int",
			long: "long",
			double: "double",
			decimal: "decimal",
			boolean: "bool",
			date: "date",
			objectId: "objectId",
			array: "array",
			object: "object",
			null: "null",
		};

		schema.bsonType = typeMapping[field.type] || field.type;

		if (field.description) {
			schema.description = field.description;
		}

		switch (field.type) {
			case "string":
				if (field.minLength !== undefined)
					schema.minLength = field.minLength;
				if (field.maxLength !== undefined)
					schema.maxLength = field.maxLength;
				if (field.pattern) schema.pattern = field.pattern;
				if (field.enum) schema.enum = field.enum;
				break;

			case "number":
			case "int":
			case "long":
			case "double":
			case "decimal":
				if (field.minimum !== undefined) schema.minimum = field.minimum;
				if (field.maximum !== undefined) schema.maximum = field.maximum;
				if (field.exclusiveMinimum !== undefined)
					schema.exclusiveMinimum = field.exclusiveMinimum;
				if (field.exclusiveMaximum !== undefined)
					schema.exclusiveMaximum = field.exclusiveMaximum;
				if (field.multipleOf !== undefined)
					schema.multipleOf = field.multipleOf;
				if (field.enum) schema.enum = field.enum;
				break;

			case "array":
				if (field.items) {
					// Check if items has a name (object schema) or just type (primitive)
					if (field.items.name) {
						schema.items = this.mapFieldToJsonSchema(field.items);
					} else {
						// Primitive array items
						const itemSchema: any = {
							bsonType:
								typeMapping[field.items.type] ||
								field.items.type,
						};
						if (field.items.minLength !== undefined)
							itemSchema.minLength = field.items.minLength;
						if (field.items.maxLength !== undefined)
							itemSchema.maxLength = field.items.maxLength;
						if (field.items.pattern)
							itemSchema.pattern = field.items.pattern;
						if (field.items.minimum !== undefined)
							itemSchema.minimum = field.items.minimum;
						if (field.items.maximum !== undefined)
							itemSchema.maximum = field.items.maximum;
						if (field.items.enum)
							itemSchema.enum = field.items.enum;
						schema.items = itemSchema;
					}
				}
				if (field.minItems !== undefined)
					schema.minItems = field.minItems;
				if (field.maxItems !== undefined)
					schema.maxItems = field.maxItems;
				if (field.uniqueItems !== undefined)
					schema.uniqueItems = field.uniqueItems;
				break;

			case "object":
				if (field.properties && field.properties.length > 0) {
					schema.properties = {};
					schema.required = [];

					for (const prop of field.properties) {
						schema.properties[prop.name] =
							this.mapFieldToJsonSchema(prop);
						if (prop.required) {
							schema.required.push(prop.name);
						}
					}

					if (field.additionalProperties !== undefined) {
						schema.additionalProperties =
							field.additionalProperties;
					}
				}
				if (field.minProperties !== undefined)
					schema.minProperties = field.minProperties;
				if (field.maxProperties !== undefined)
					schema.maxProperties = field.maxProperties;
				break;
		}

		return schema;
	}

	static getConstraintsSummary(field: any): string[] {
		const constraints: string[] = [];

		if (field.required) constraints.push("required");
		if (field.description)
			constraints.push(`description: ${field.description}`);
		if (field.minLength !== undefined)
			constraints.push(`minLength: ${field.minLength}`);
		if (field.maxLength !== undefined)
			constraints.push(`maxLength: ${field.maxLength}`);
		if (field.pattern) constraints.push(`pattern: ${field.pattern}`);
		if (field.minimum !== undefined)
			constraints.push(`minimum: ${field.minimum}`);
		if (field.maximum !== undefined)
			constraints.push(`maximum: ${field.maximum}`);
		if (field.exclusiveMinimum !== undefined)
			constraints.push(`exclusiveMinimum: ${field.exclusiveMinimum}`);
		if (field.exclusiveMaximum !== undefined)
			constraints.push(`exclusiveMaximum: ${field.exclusiveMaximum}`);
		if (field.multipleOf !== undefined)
			constraints.push(`multipleOf: ${field.multipleOf}`);
		if (field.enum) constraints.push(`enum: ${field.enum.join(", ")}`);
		if (field.minItems !== undefined)
			constraints.push(`minItems: ${field.minItems}`);
		if (field.maxItems !== undefined)
			constraints.push(`maxItems: ${field.maxItems}`);
		if (field.uniqueItems) constraints.push("uniqueItems");
		if (field.minProperties !== undefined)
			constraints.push(`minProperties: ${field.minProperties}`);
		if (field.maxProperties !== undefined)
			constraints.push(`maxProperties: ${field.maxProperties}`);

		return constraints;
	}

	static validateCollectionName(name: string): ValidationResult {
		const errors: string[] = [];

		if (!name || name.trim().length === 0) {
			errors.push("Collection name cannot be empty");
		} else if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
			errors.push(
				"Collection name can only contain letters, numbers, underscores, and hyphens",
			);
		} else if (name.length > 255) {
			errors.push("Collection name cannot exceed 255 characters");
		} else if (name.startsWith("system.")) {
			errors.push("Collection name cannot start with 'system.'");
		}

		return { isValid: errors.length === 0, errors };
	}

	static validateDatabaseName(name: string): ValidationResult {
		const errors: string[] = [];

		if (!name || name.trim().length === 0) {
			errors.push("Database name cannot be empty");
		} else if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
			errors.push(
				"Database name can only contain letters, numbers, underscores, and hyphens",
			);
		} else if (name.length > 64) {
			errors.push("Database name cannot exceed 64 characters");
		}

		return { isValid: errors.length === 0, errors };
	}
}
