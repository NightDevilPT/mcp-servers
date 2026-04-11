// src/tools/rename-collection/index.ts
import { z } from "zod";
import { MongoClient } from "mongodb";
import {
	withMongoConnection,
	validateCollectionExists,
	handleMongoError,
	createCollectionResponse,
} from "../../../utils";

export const RenameCollectionTool = {
	name: "rename_collection",
	description:
		"[Database administration] : Rename a collection in MongoDB database with user confirmation",
	inputSchema: {
		database: z
			.string()
			.describe("Name of the database where collection will be renamed"),
		collection: z
			.string()
			.describe("Current name of the collection to rename"),
		newName: z.string().describe("New name for the collection"),
	},
	execute: async (
		args: {
			database: string;
			collection: string;
			newName: string;
		},
		extra: any, // Contains { server: McpServer }
	) => {
		try {
			return await withMongoConnection(args.database, async (client, db) => {
				// Check if source collection exists
				const sourceExists = await validateCollectionExists(db, args.collection);
				if (!sourceExists) {
					return {
						content: [
							{
								type: "text" as const,
								text: `Error: Collection '${args.collection}' does not exist in database '${args.database}'`,
							},
						],
						isError: true,
					};
				}

				// Check if target collection name already exists
				const targetExists = await validateCollectionExists(db, args.newName);
				if (targetExists) {
					return {
						content: [
							{
								type: "text" as const,
								text: `Error: Collection '${args.newName}' already exists in database '${args.database}'`,
							},
						],
						isError: true,
					};
				}

				// Collection exists and new name is available, now prompt for confirmation
				const confirmationResult = await extra.server.elicitInput({
					message: `? You are about to rename a collection:\n\nDatabase: ${args.database}\nFrom: ${args.collection}\nTo: ${args.newName}\n\nDo you want to proceed?`,
					requestedSchema: {
						type: "object",
						properties: {
							action: {
								type: "string",
								enum: ["yes", "no"],
								title: "Confirm Rename",
								description:
									"Choose 'yes' to rename the collection or 'no' to cancel",
							},
							reason: {
								type: "string",
								title: "Reason (optional)",
								description:
									"Why are you renaming this collection?",
							},
						},
						required: ["action"],
					},
				});

				// Handle user's decision
				if (
					confirmationResult.action !== "accept" ||
					confirmationResult.content?.action !== "yes"
				) {
					return {
						content: [
							{
								type: "text" as const,
								text: `Collection rename cancelled by user.${confirmationResult.content?.reason ? ` Reason: ${confirmationResult.content.reason}` : ""}`,
							},
						],
						isError: false,
					};
				}

				// Rename the collection
				await db.collection(args.collection).rename(args.newName);

				return createCollectionResponse(
					args.database,
					args.collection,
					`Collection '${args.collection}' renamed successfully to '${args.newName}' in database '${args.database}'`,
					{
						oldName: args.collection,
						newName: args.newName,
						reason:
							confirmationResult.content?.reason ||
							"No reason provided",
					}
				);
			});
		} catch (error: any) {
			const handledError = handleMongoError(error, args.database, args.collection);
			if (handledError) {
				return handledError;
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `Error renaming collection: ${error.message}`,
					},
				],
				isError: true,
			};
		}
	},
};
