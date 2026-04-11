import { z } from "zod";
import {
	createErrorResponse,
	createSuccessResponse,
} from "../../../utils/mcp-error.utils";
import { MongoDBUtils } from "../../../utils/mongodb.utils";

export const CreateDatabaseTool = {
	name: "create_database",
	description: "Create a new database in MongoDB",
	inputSchema: {
		databaseName: z.string().describe("Name of the database to create"),
	},
	execute: async (args: { databaseName: string }, extra: any) => {
		try {
			const { databaseName } = args;

			if (!databaseName || !/^[a-zA-Z0-9_-]+$/.test(databaseName)) {
				return createErrorResponse(
					"Invalid database name. Use only letters, numbers, underscores, and hyphens",
					"INVALID_DATABASE_NAME",
				);
			}

			await MongoDBUtils.testConnection();

			const client = await MongoDBUtils.getClient();
			const db = client.db(databaseName);

			// Create temporary collection to initialize database
			await db.createCollection("_temp");
			// Remove the temporary collection
			// await db.collection("_temp").drop();

			return createSuccessResponse(
				{
					name: databaseName,
					created: true,
				},
				`Database '${databaseName}' created successfully`,
			);
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
