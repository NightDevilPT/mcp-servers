// apps/mongodb-mcp/src/tools/data-administration/drop-database/index.ts

import { z } from "zod";
import {
	createErrorResponse,
	createSuccessResponse,
} from "../../../utils/mcp-error.utils";
import { MongoDBUtils } from "../../../utils/mongodb.utils";
import { FormGenerator } from "../../../utils/form-generator";

export const DropDatabasesTool = {
	name: "drop_databases",
	description: "[Database Administration] Permanently delete multiple databases. Interactive form with confirmation. System dbs (admin/config/local) protected.",
	inputSchema: {},
	execute: async (args: any, extra: any) => {
		try {
			await MongoDBUtils.testConnection();

			const client = await MongoDBUtils.getClient();
			const admin = client.db().admin();
			const result = await admin.listDatabases();

			const systemDatabases = ["admin", "config", "local"];
			const userDatabases = result.databases.filter(
				(db: any) => !systemDatabases.includes(db.name),
			);

			if (userDatabases.length === 0) {
				return createErrorResponse(
					"No user databases found to drop",
					"NO_DATABASES_FOUND",
				);
			}

			// Create dynamic form schema
			const properties: Record<string, any> = {};

			userDatabases.forEach((db: any) => {
				properties[db.name] = {
					type: "boolean",
					title: db.name,
					description: `Size: ${db.sizeOnDisk ? (db.sizeOnDisk / 1024).toFixed(2) + " KB" : "Unknown"}`,
					default: false,
				};
			});

			properties.confirmation = {
				type: "string",
				title: "Confirmation",
				description: "Type 'DELETE' to confirm",
				enum: ["DELETE"],
			};

			const selectionSchema = {
				type: "object",
				properties: properties,
				required: ["confirmation"],
			};

			const formSchema = FormGenerator.generateFormSchema(selectionSchema);

			const resultForm = await extra.server.elicitInput({
				mode: "form",
				message: `⚠️ DANGER: Permanently delete databases. IRREVERSIBLE! Select databases and type 'DELETE' to confirm.`,
				requestedSchema: formSchema,
			});

			if (resultForm.action !== "accept") {
				return createSuccessResponse(
					{ cancelled: true },
					"Operation cancelled",
				);
			}

			const { confirmation, ...dbSelections } = resultForm.content;

			if (confirmation !== "DELETE") {
				return createErrorResponse(
					"Type 'DELETE' to confirm",
					"CONFIRMATION_FAILED",
				);
			}

			const selectedDatabases = Object.entries(dbSelections)
				.filter(([_, selected]) => selected === true)
				.map(([dbName]) => dbName);

			if (selectedDatabases.length === 0) {
				return createErrorResponse(
					"No databases selected",
					"NO_DATABASES_SELECTED",
				);
			}

			const droppedDatabases: string[] = [];
			const failedDatabases: { name: string; error: string }[] = [];

			for (const dbName of selectedDatabases) {
				try {
					await client.db(dbName).dropDatabase();
					droppedDatabases.push(dbName);
				} catch (error) {
					failedDatabases.push({
						name: dbName,
						error: error instanceof Error ? error.message : "Unknown error",
					});
				}
			}

			return createSuccessResponse(
				{
					dropped: droppedDatabases,
					failed: failedDatabases,
					totalDropped: droppedDatabases.length,
					totalFailed: failedDatabases.length,
				},
				`Dropped ${droppedDatabases.length} db(s). Failed: ${failedDatabases.length}`,
			);
		} catch (error) {
			return createErrorResponse(
				error instanceof Error ? error.message : "Failed to drop databases",
				"DATABASE_DROP_FAILED",
			);
		}
	},
};