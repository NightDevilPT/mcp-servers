import { CollectionSchema, SchemaField } from "./schema-utils";

export interface FormField {
	name: string;
	type: "string" | "number" | "boolean" | "array" | "object";
	title: string;
	description: string;
	required: boolean;
	default?: any;
	minLength?: number;
	maxLength?: number;
	minimum?: number;
	maximum?: number;
	pattern?: string;
	enum?: any[];
	format?: "email" | "uri" | "date" | "date-time";
}

export function generateFormSchema(schema: CollectionSchema): {
	properties: Record<string, any>;
	required: string[];
} {
	const properties: Record<string, any> = {};
	const required: string[] = schema.required || [];

	for (const [fieldName, field] of Object.entries(schema.properties)) {
		const formField = convertSchemaFieldToFormField(fieldName, field);
		properties[fieldName] = {
			type: formField.type,
			title: formField.title,
			description: formField.description,
		};

		// Add constraints based on field type
		if (formField.type === "string") {
			if (formField.minLength !== undefined) {
				properties[fieldName].minLength = formField.minLength;
			}
			if (formField.maxLength !== undefined) {
				properties[fieldName].maxLength = formField.maxLength;
			}
			if (formField.pattern) {
				properties[fieldName].pattern = formField.pattern;
			}
			if (formField.format) {
				properties[fieldName].format = formField.format;
			}
		}

		if (formField.type === "number") {
			if (formField.minimum !== undefined) {
				properties[fieldName].minimum = formField.minimum;
			}
			if (formField.maximum !== undefined) {
				properties[fieldName].maximum = formField.maximum;
			}
		}

		// Add enum values
		if (formField.enum && formField.enum.length > 0) {
			properties[fieldName].enum = formField.enum;
		}

		// Add default values
		if (formField.default !== undefined) {
			properties[fieldName].default = formField.default;
		}
	}

	return { properties, required };
}

function convertSchemaFieldToFormField(
	fieldName: string,
	field: SchemaField,
): FormField {
	const baseField: FormField = {
		name: fieldName,
		type: mapBsonTypeToFormType(field.bsonType),
		title: formatFieldName(fieldName),
		description: field.description || `${fieldName} field`,
		required: false, // Will be determined by schema.required
	};

	// Add constraints based on BSON type
	switch (field.bsonType) {
		case "string":
			if (field.minLength !== undefined)
				baseField.minLength = field.minLength;
			if (field.maxLength !== undefined)
				baseField.maxLength = field.maxLength;
			if (field.pattern) baseField.pattern = field.pattern;
			if (field.enum) baseField.enum = field.enum;
			break;

		case "int":
		case "long":
		case "double":
		case "decimal":
			if (field.minimum !== undefined) baseField.minimum = field.minimum;
			if (field.maximum !== undefined) baseField.maximum = field.maximum;
			if (field.enum) baseField.enum = field.enum;
			baseField.type = "number";
			break;

		case "bool":
			baseField.type = "boolean";
			break;

		case "date":
		case "timestamp":
			baseField.type = "string";
			baseField.format = "date-time";
			break;

		case "objectId":
			baseField.type = "string";
			baseField.pattern = "^[0-9a-fA-F]{24}$";
			baseField.description =
				field.description || `${fieldName} (MongoDB ObjectId)`;
			break;

		case "array":
			baseField.type = "array";
			break;

		case "object":
			baseField.type = "object";
			break;

		case "null":
			baseField.type = "string";
			baseField.description =
				field.description || `${fieldName} (null value)`;
			break;

		case "binary":
			baseField.type = "string";
			baseField.description =
				field.description || `${fieldName} (binary data)`;
			break;

		case "regex":
			baseField.type = "string";
			baseField.pattern = "^/.*/$";
			baseField.description =
				field.description || `${fieldName} (regex pattern)`;
			break;

		case "javascript":
		case "javascriptWithScope":
			baseField.type = "string";
			baseField.description =
				field.description || `${fieldName} (JavaScript code)`;
			break;

		default:
			baseField.type = "string";
	}

	return baseField;
}

function mapBsonTypeToFormType(bsonType: string): FormField["type"] {
	switch (bsonType) {
		case "string":
		case "objectId":
		case "date":
		case "timestamp":
		case "null":
		case "binary":
		case "regex":
		case "javascript":
		case "javascriptWithScope":
			return "string";
		case "int":
		case "long":
		case "double":
		case "decimal":
			return "number";
		case "bool":
			return "boolean";
		case "array":
			return "array";
		case "object":
			return "object";
		default:
			return "string";
	}
}

function formatFieldName(fieldName: string): string {
	// Convert field name to title case
	return fieldName
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, (str) => str.toUpperCase())
		.replace(/_/g, " ")
		.trim();
}

export function generateFieldSummary(schema: CollectionSchema): string {
	let summary = "";

	if (schema.required && schema.required.length > 0) {
		summary += `**Required Fields:** ${schema.required.join(", ")}\n\n`;
	}

	const optionalFields = Object.keys(schema.properties).filter(
		(name) => !schema.required.includes(name),
	);

	if (optionalFields.length > 0) {
		summary += `**Optional Fields:** ${optionalFields.join(", ")}\n\n`;
	}

	summary += "**Field Details:**\n";
	for (const [fieldName, field] of Object.entries(schema.properties)) {
		const isRequired = schema.required.includes(fieldName);
		const status = isRequired ? "Required" : "Optional";
		summary += `- **${fieldName}** (${field.bsonType}) - ${status}\n`;

		if (field.description) {
			summary += `  - ${field.description}\n`;
		}

		// Add constraints
		const constraints = [];
		if (field.minLength !== undefined)
			constraints.push(`min length: ${field.minLength}`);
		if (field.maxLength !== undefined)
			constraints.push(`max length: ${field.maxLength}`);
		if (field.minimum !== undefined)
			constraints.push(`min: ${field.minimum}`);
		if (field.maximum !== undefined)
			constraints.push(`max: ${field.maximum}`);
		if (field.pattern) constraints.push(`pattern: ${field.pattern}`);
		if (field.enum && field.enum.length > 0)
			constraints.push(`enum: [${field.enum.join(", ")}]`);

		if (constraints.length > 0) {
			summary += `  - Constraints: ${constraints.join(", ")}\n`;
		}

		summary += "\n";
	}

	return summary;
}
