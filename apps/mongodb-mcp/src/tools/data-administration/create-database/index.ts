// apps/mongodb-mcp/src/tools/data-administration/create-database/index.ts

import { z } from "zod";
import {
	createErrorResponse,
	createSuccessResponse,
} from "../../../utils/mcp-error.utils";
import { MongoDBUtils } from "../../../utils/mongodb.utils";
import { SchemaValidator } from "../../../utils/schema-validation";
import { FormGenerator } from "../../../utils/form-generator";

export const CreateDatabaseTool = {
	name: "create_database",
	description:
		"[Database Administration] Create MongoDB database. Name: letters, numbers, _, - only. Max 64 chars. Cannot be: admin, config, local.",
	inputSchema: {
		databaseName: z
			.string()
			.min(1)
			.max(64)
			.regex(/^[a-zA-Z0-9_-]+$/)
			.describe("Database name (letters, numbers, _, -)"),
		confirmed: z
			.boolean()
			.optional()
			.default(false)
			.describe("Set to true to skip confirmation"),
	},

	execute: async (
		args: { databaseName: string; confirmed?: boolean },
		extra: any,
	) => {
		try {
			const { databaseName, confirmed = false } = args;

			const dbNameValidation =
				SchemaValidator.validateDatabaseName(databaseName);
			if (!dbNameValidation.isValid) {
				return createErrorResponse(
					`Invalid database name: ${dbNameValidation.errors.join(", ")}`,
					"INVALID_DATABASE_NAME",
				);
			}

			await MongoDBUtils.testConnection();
			const client = await MongoDBUtils.getClient();

			const admin = client.db().admin();
			const dbList = await admin.listDatabases();
			const databaseExists = dbList.databases.some(
				(db: any) => db.name === databaseName,
			);

			if (databaseExists) {
				return createErrorResponse(
					`Database '${databaseName}' already exists`,
					"DATABASE_ALREADY_EXISTS",
				);
			}

			if (confirmed) {
				return await createDatabase(databaseName, client);
			}

			const confirmationResult = await showConfirmationForm(
				databaseName,
				extra,
			);

			if (confirmationResult.action === "cancel") {
				return createSuccessResponse(
					{ cancelled: true, databaseName },
					"Database creation cancelled",
				);
			}

			if (confirmationResult.action === "confirm") {
				return await createDatabase(databaseName, client);
			}

			return createErrorResponse("Invalid action", "INVALID_ACTION");
		} catch (error) {
			return createErrorResponse(
				error instanceof Error
					? error.message
					: "Failed to create database",
				"DATABASE_CREATION_FAILED",
			);
		}
	},
};

async function showConfirmationForm(
	databaseName: string,
	extra: any,
): Promise<{ action: "confirm" | "cancel" }> {
	const formSchema = {
		type: "object",
		properties: {
			action: {
				type: "string",
				title: "Confirm Database Creation",
				description: `Are you sure to create database: ${databaseName}?`,
				enum: ["confirm", "cancel"],
				enumNames: ["Confirm - Create Database", "Cancel - Abort"],
			},
		},
		required: ["action"],
	};

	const generatedForm = FormGenerator.generateFormSchema(formSchema);

	const result = await extra.server.elicitInput({
		mode: "form",
		message: `Confirm database creation: ${databaseName}`,
		requestedSchema: generatedForm,
	});

	if (result.action !== "accept") {
		return { action: "cancel" };
	}

	const { action } = result.content;
	return action === "confirm" ? { action: "confirm" } : { action: "cancel" };
}

async function createDatabase(databaseName: string, client: any) {
	const db = client.db(databaseName);
	await db.createCollection("_temp");

	return createSuccessResponse(
		{ name: databaseName, created: true },
		`Database '${databaseName}' created successfully`,
	);
}
