export interface SchemaField {
	bsonType: string;
	description?: string;
	minLength?: number;
	maxLength?: number;
	minimum?: number;
	maximum?: number;
	pattern?: string;
	enum?: any[];
}

export interface CollectionSchema {
	bsonType: string;
	required: string[];
	properties: Record<string, SchemaField>;
}

export interface CollectionValidator {
	$jsonSchema: CollectionSchema;
}

export interface CollectionOptions {
	validator?: CollectionValidator;
	validationLevel?: string;
	validationAction?: string;
}

export interface CollectionInfo {
	name: string;
	type: string;
	options: CollectionOptions;
	info: any;
}

export function generateFieldExample(field: SchemaField): any {
	switch (field.bsonType) {
		case "string":
			if (field.enum && field.enum.length > 0) {
				return field.enum[0];
			}
			if (field.pattern) {
				// Generate a string that matches the pattern (simplified)
				return "example_string";
			}
			const minLength = field.minLength || 1;
			const maxLength = Math.min(field.maxLength || 20, 50);
			const length = Math.max(minLength, Math.min(8, maxLength));
			return "a".repeat(length);
		
		case "int":
		case "long":
		case "double":
		case "decimal":
			if (field.enum && field.enum.length > 0) {
				return field.enum[0];
			}
			const min = field.minimum || 0;
			const max = field.maximum || 100;
			return Math.floor(Math.random() * (max - min + 1)) + min;
		
		case "bool":
			return true;
		
		case "date":
		case "timestamp":
			return new Date().toISOString();
		
		case "objectId":
			return "507f1f77bcf86cd799439011";
		
		case "array":
			return [];
		
		case "object":
			return {};
		
		case "null":
			return null;
		
		case "binary":
			return "base64data";
		
		case "regex":
			return "/pattern/";
		
		case "javascript":
			return "function() { return true; }";
		
		case "javascriptWithScope":
			return { code: "function() { return true; }", scope: {} };
		
		default:
			return null;
	}
}

export function generateDummyDocument(schema: CollectionSchema): any {
	const document: any = {};

	// Add required fields
	for (const fieldName of schema.required) {
		const field = schema.properties[fieldName];
		if (field) {
			document[fieldName] = generateFieldExample(field);
		}
	}

	// Add some optional fields (up to 3 for demonstration)
	const optionalFields = Object.keys(schema.properties).filter(
		name => !schema.required.includes(name)
	);
	
	const sampleOptionalFields = optionalFields.slice(0, 3);
	for (const fieldName of sampleOptionalFields) {
		const field = schema.properties[fieldName];
		if (field) {
			document[fieldName] = generateFieldExample(field);
		}
	}

	return document;
}

export function formatFieldDescription(fieldName: string, field: SchemaField): string {
	let description = `**${fieldName}** (${field.bsonType})`;
	
	if (field.description) {
		description += ` - ${field.description}`;
	}
	
	if (field.enum && field.enum.length > 0) {
		description += `\n  - Enum: [${field.enum.map(v => JSON.stringify(v)).join(", ")}]`;
	}
	
	if (field.bsonType === "string") {
		if (field.minLength !== undefined || field.maxLength !== undefined) {
			const constraints = [];
			if (field.minLength !== undefined) constraints.push(`min: ${field.minLength}`);
			if (field.maxLength !== undefined) constraints.push(`max: ${field.maxLength}`);
			description += `\n  - Length: ${constraints.join(", ")}`;
		}
		if (field.pattern) {
			description += `\n  - Pattern: ${field.pattern}`;
		}
	}
	
	if (["int", "long", "double", "decimal"].includes(field.bsonType)) {
		if (field.minimum !== undefined || field.maximum !== undefined) {
			const constraints = [];
			if (field.minimum !== undefined) constraints.push(`min: ${field.minimum}`);
			if (field.maximum !== undefined) constraints.push(`max: ${field.maximum}`);
			description += `\n  - Range: ${constraints.join(", ")}`;
		}
		if (field.enum && field.enum.length > 0) {
			description += `\n  - Enum: [${field.enum.map(v => JSON.stringify(v)).join(", ")}]`;
		}
	}
	
	return description;
}
