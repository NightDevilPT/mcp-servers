// apps/mongodb-mcp/src/tools/data-administration/list-databases/index.ts

import { z } from "zod";
import {
	createErrorResponse,
	createSuccessResponse,
} from "../../../utils/mcp-error.utils";
import { MongoDBUtils } from "../../../utils/mongodb.utils";

export const ListDatabasesTool = {
	name: "list_databases",
	description:
		"[Database Administration] List all databases. Optionally include size and system dbs (admin/config/local).",
	inputSchema: {
		includeSize: z
			.boolean()
			.optional()
			.default(false)
			.describe("Include database size"),
		includeSystemDatabases: z
			.boolean()
			.optional()
			.default(false)
			.describe("Include system dbs"),
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

			const databases = includeSize
				? filteredDatabases.map((db: any) => ({
						name: db.name,
						sizeOnDisk: db.sizeOnDisk,
						empty: db.empty,
					}))
				: filteredDatabases.map((db: any) => ({
						name: db.name,
						empty: db.empty,
					}));

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

			const msg = `Found ${databases.length} db(s)${!includeSystemDatabases ? " (excl system)" : ""}`;
			return createSuccessResponse(response, msg);
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
