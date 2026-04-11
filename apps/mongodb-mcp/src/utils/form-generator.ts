// form-generator.utils.ts

export interface FormField {
	type: "string" | "number" | "boolean" | "array" | "object";
	title?: string;
	description?: string;
	default?: any;
	minLength?: number;
	maxLength?: number;
	pattern?: string;
	format?: "email" | "uri" | "date" | "date-time" | "time" | "uuid";
	enum?: any[];
	oneOf?: Array<{ const: any; title: string }>;
	minimum?: number;
	maximum?: number;
	items?: FormField | any;
	minItems?: number;
	maxItems?: number;
	properties?: Record<string, FormField>;
	required?: string[];
}

export interface GeneratedFormSchema {
	type: "object";
	properties: Record<string, FormField>;
	required: string[];
}

export interface SchemaField {
	type: string;
	description?: string;
	minLength?: number;
	maxLength?: number;
	pattern?: string;
	format?: string;
	enum?: any[];
	oneOf?: Array<{ const: any; title: string }>;
	minimum?: number;
	maximum?: number;
	minItems?: number;
	maxItems?: number;
	items?: any;
	properties?: Record<string, any>;
	required?: string[];
	default?: any;
}

export class FormGenerator {
	static generateFormSchema(
		schema: any,
		options?: {
			includeTimestamps?: boolean;
			includeIds?: boolean;
			fieldTransformations?: Record<
				string,
				(field: SchemaField) => FormField
			>;
		},
	): GeneratedFormSchema {
		const properties: Record<string, FormField> = {};
		const required: string[] = [];

		if (!schema || !schema.properties) {
			return { type: "object", properties: {}, required: [] };
		}

		for (const [fieldName, field] of Object.entries(schema.properties)) {
			const fieldSchema = field as SchemaField;

			if (
				!options?.includeTimestamps &&
				this.isTimestampField(fieldName, fieldSchema)
			) {
				continue;
			}
			if (
				!options?.includeIds &&
				this.isIdField(fieldName, fieldSchema)
			) {
				continue;
			}

			if (options?.fieldTransformations?.[fieldName]) {
				properties[fieldName] =
					options.fieldTransformations[fieldName](fieldSchema);
				if (schema.required?.includes(fieldName)) {
					required.push(fieldName);
				}
				continue;
			}

			const formField = this.mapFieldToFormField(fieldName, fieldSchema);
			properties[fieldName] = formField;

			if (schema.required?.includes(fieldName)) {
				required.push(fieldName);
			}
		}

		return { type: "object", properties, required };
	}

	private static mapFieldToFormField(
		fieldName: string,
		field: SchemaField,
	): FormField {
		const baseField: FormField = {
			type: this.mapDataType(field.type),
			title: this.formatFieldTitle(fieldName),
			description:
				field.description || this.generateDescription(fieldName, field),
			default: field.default,
		};

		switch (baseField.type) {
			case "string":
				this.applyStringConstraints(baseField, field);
				break;
			case "number":
				this.applyNumberConstraints(baseField, field);
				break;
			case "array":
				this.applyArrayConstraints(baseField, field);
				break;
			case "object":
				this.applyObjectConstraints(baseField, field);
				break;
		}

		return baseField;
	}

	private static mapDataType(type: string): FormField["type"] {
		const typeMap: Record<string, FormField["type"]> = {
			string: "string",
			text: "string",
			varchar: "string",
			char: "string",
			uuid: "string",
			id: "string",
			date: "string",
			datetime: "string",
			timestamp: "string",
			time: "string",
			email: "string",
			uri: "string",
			url: "string",
			integer: "number",
			int: "number",
			number: "number",
			decimal: "number",
			float: "number",
			double: "number",
			bigint: "number",
			boolean: "boolean",
			bool: "boolean",
			flag: "boolean",
			array: "array",
			list: "array",
			collection: "array",
			object: "object",
			dict: "object",
			map: "object",
			json: "object",
			jsonb: "object",
		};

		return typeMap[type?.toLowerCase()] || "string";
	}

	private static applyStringConstraints(
		formField: FormField,
		field: SchemaField,
	): void {
		if (field.minLength !== undefined)
			formField.minLength = field.minLength;
		if (field.maxLength !== undefined)
			formField.maxLength = field.maxLength;
		if (field.pattern) formField.pattern = field.pattern;
		if (field.format) formField.format = field.format as any;
		if (field.enum && field.enum.length > 0) formField.enum = field.enum;
		if (field.oneOf) formField.oneOf = field.oneOf;
	}

	private static applyNumberConstraints(
		formField: FormField,
		field: SchemaField,
	): void {
		if (field.minimum !== undefined) formField.minimum = field.minimum;
		if (field.maximum !== undefined) formField.maximum = field.maximum;
		if (field.enum && field.enum.length > 0) formField.enum = field.enum;
	}

	private static applyArrayConstraints(
		formField: FormField,
		field: SchemaField,
	): void {
		if (field.minItems !== undefined) formField.minItems = field.minItems;
		if (field.maxItems !== undefined) formField.maxItems = field.maxItems;

		if (field.items) {
			if (typeof field.items === "object" && field.items.type) {
				formField.items = this.mapFieldToFormField(
					"items",
					field.items as SchemaField,
				);
			} else {
				formField.items = { type: "string" };
			}
		}
	}

	private static applyObjectConstraints(
		formField: FormField,
		field: SchemaField,
	): void {
		if (field.properties) {
			const nested = this.generateFormSchema({
				properties: field.properties,
				required: field.required,
			});
			formField.properties = nested.properties;
			formField.required = nested.required;
		}
	}

	private static formatFieldTitle(fieldName: string): string {
		return fieldName
			.split(/(?=[A-Z])|_|-/)
			.map(
				(word) =>
					word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
			)
			.join(" ")
			.trim();
	}

	private static generateDescription(
		fieldName: string,
		field: SchemaField,
	): string {
		const descriptions: string[] = [];

		if (field.description) {
			descriptions.push(field.description);
		}

		if (field.minLength && field.maxLength) {
			descriptions.push(
				`Length: ${field.minLength}-${field.maxLength} characters`,
			);
		} else if (field.minLength) {
			descriptions.push(`Minimum ${field.minLength} characters`);
		} else if (field.maxLength) {
			descriptions.push(`Maximum ${field.maxLength} characters`);
		}

		if (field.minimum !== undefined && field.maximum !== undefined) {
			descriptions.push(`Range: ${field.minimum}-${field.maximum}`);
		} else if (field.minimum !== undefined) {
			descriptions.push(`Minimum: ${field.minimum}`);
		} else if (field.maximum !== undefined) {
			descriptions.push(`Maximum: ${field.maximum}`);
		}

		if (field.pattern) {
			descriptions.push(`Format: ${field.pattern}`);
		}

		if (field.enum && field.enum.length > 0) {
			descriptions.push(`Allowed values: ${field.enum.join(", ")}`);
		}

		if (field.format) {
			descriptions.push(`Format: ${field.format}`);
		}

		return (
			descriptions.join(". ") ||
			`Enter ${this.formatFieldTitle(fieldName)}`
		);
	}

	private static isTimestampField(
		fieldName: string,
		field: SchemaField,
	): boolean {
		const timestampPatterns = [
			"created_at",
			"updated_at",
			"deleted_at",
			"timestamp",
			"createdAt",
			"updatedAt",
		];
		return (
			timestampPatterns.includes(fieldName) ||
			field.type === "timestamp" ||
			field.format === "date-time"
		);
	}

	private static isIdField(fieldName: string, field: SchemaField): boolean {
		const idPatterns = ["id", "_id", "uuid", "guid", "identifier"];
		return idPatterns.includes(fieldName) || field.type === "uuid";
	}
}
