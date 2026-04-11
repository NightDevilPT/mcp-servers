import { z } from "zod";
import {
	createErrorResponse,
	createSuccessResponse,
} from "../../../utils/mcp-error.utils";
import { MongoDBUtils } from "../../../utils/mongodb.utils";

export const ListDatabasesTool = {
	name: "list_databases",
	description: "List all databases in MongoDB instance",
	inputSchema: {
		includeSize: z
			.boolean()
			.optional()
			.default(false)
			.describe("Include database size information"),
		includeSystemDatabases: z
			.boolean()
			.optional()
			.default(false)
			.describe("Include system databases (admin, config, local)"),
	},
	execute: async (
		args: { includeSize?: boolean; includeSystemDatabases?: boolean },
		extra: any,
	) => {
		try {
			const { includeSize = false, includeSystemDatabases = false } =
				args;

			await MongoDBUtils.testConnection();

			const client = await MongoDBUtils.getClient();
			const admin = client.db().admin();
			const result = await admin.listDatabases();

			const systemDatabases = ["admin", "config", "local"];

			let filteredDatabases = result.databases;

			if (!includeSystemDatabases) {
				filteredDatabases = result.databases.filter(
					(db: any) => !systemDatabases.includes(db.name),
				);
			}

			let databases: any[];

			if (includeSize) {
				databases = filteredDatabases.map((db: any) => ({
					name: db.name,
					sizeOnDisk: db.sizeOnDisk,
					empty: db.empty,
				}));
			} else {
				databases = filteredDatabases.map((db: any) => ({
					name: db.name,
					empty: db.empty,
				}));
			}

			const response: any = {
				databases,
				totalCount: databases.length,
			};

			if (includeSize) {
				response.totalSize = filteredDatabases.reduce(
					(sum: number, db: any) => sum + (db.sizeOnDisk || 0),
					0,
				);
			}

			return createSuccessResponse(
				response,
				`Found ${databases.length} database(s)${!includeSystemDatabases ? " (excluding system databases)" : ""}`,
			);
		} catch (error) {
			return createErrorResponse(
				error instanceof Error
					? error.message
					: "Failed to list databases",
				"LIST_DATABASES_FAILED",
			);
		}
	},
};
