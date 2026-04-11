// src/tools/list-collections/index.ts
import { z } from "zod";
import { MongoClient } from "mongodb";
import {
	withMongoConnection,
	handleMongoError,
	createListResponse,
} from "../../../utils";

export const ListCollectionsTool = {
	name: "list_collections",
	description: "[Database administration] : List all collections in a MongoDB database",
	inputSchema: {
		database: z
			.string()
			.describe("Name of the database to list collections from"),
	},
	execute: async (
		args: {
			database: string;
		},
		extra: any, // Contains { server: McpServer }
	) => {
		try {
			return await withMongoConnection(args.database, async (client, db) => {
				// Get list of collections
				const collections = await db.listCollections().toArray();

				// Extract collection names and basic info
				const collectionInfo = collections.map(collection => ({
					name: collection.name,
					type: collection.type || 'collection',
					options: (collection as any).options || {},
					info: (collection as any).info || {}
				}));

				return createListResponse(
					args.database,
					collectionInfo,
					"collections"
				);
			});
		} catch (error: any) {
			const handledError = handleMongoError(error, args.database);
			if (handledError) {
				return handledError;
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `Error listing collections: ${error.message}`,
					},
				],
				isError: true,
			};
		}
	},
};
