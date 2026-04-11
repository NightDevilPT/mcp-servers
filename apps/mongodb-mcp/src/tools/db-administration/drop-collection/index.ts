// src/tools/drop-collection/index.ts
import { z } from "zod";
import { MongoClient } from "mongodb";
import {
	withMongoConnection,
	validateDatabaseExists,
	validateCollectionExists,
	handleMongoError,
	createCollectionResponse,
} from "../../../utils";

export const DropCollectionTool = {
	name: "drop_collection",
	description: `[Database Administration] Permanently drop/delete a collection from MongoDB database with user confirmation.

⚠️ WARNING: This action is IRREVERSIBLE! All data in the collection will be permanently deleted.

HOW IT WORKS:
1. Validates database and collection names
2. Checks if collection exists in the database
3. If collection exists, requests user confirmation with warning
4. Only proceeds if user explicitly confirms
5. Permanently deletes the collection and all its data

REQUIREMENTS:
- MongoDB URI must be set in environment variables
- Database and collection must exist
- User must confirm the dangerous operation

EXAMPLES:
- Drop collection: database="myApp", collection="temp_logs"`,
	inputSchema: {
		database: z
			.string()
			.describe("Name of the database containing the collection"),
		collection: z
			.string()
			.describe("Name of the collection to permanently delete"),
		force: z
			.boolean()
			.optional()
			.default(false)
			.describe("Skip confirmation (use with extreme caution!)"),
	},
	execute: async (
		args: {
			database: string;
			collection: string;
			force?: boolean;
		},
		extra: any,
	) => {
		// Validate input parameters
		if (!args.database || args.database.trim() === "") {
			return {
				content: [
					{
						type: "text" as const,
						text: "Error: Database name cannot be empty",
					},
				],
				isError: true,
			};
		}

		if (!args.collection || args.collection.trim() === "") {
			return {
				content: [
					{
						type: "text" as const,
						text: "Error: Collection name cannot be empty",
					},
				],
				isError: true,
			};
		}

		try {
			return await withMongoConnection(args.database, async (client, db) => {
				// Check if database exists
				const dbExists = await validateDatabaseExists(client, args.database);
				if (!dbExists) {
					return {
						content: [
							{
								type: "text" as const,
								text: `Error: Database '${args.database}' does not exist.`,
							},
						],
						isError: true,
					};
				}

				// Check if collection exists
				const collectionExists = await validateCollectionExists(db, args.collection);
				if (!collectionExists) {
					return {
						content: [
							{
								type: "text" as const,
								text: `Error: Collection '${args.collection}' does not exist in database '${args.database}'.`,
							},
						],
						isError: true,
					};
				}

				// Get collection stats for better user information
				const collection = db.collection(args.collection);
				let docCount = 0;
				let stats = null;

				try {
					docCount = await collection.countDocuments();
					stats = await db.command({ collStats: args.collection });
				} catch (statsError) {
					// Stats might not be available, continue without them
					console.log("Could not fetch collection stats");
				}

				// Force mode or ask for confirmation
				let shouldProceed = false;
				let reason = "";

				if (args.force) {
					shouldProceed = true;
					reason = "Force flag enabled";
				} else {
					// Ask for confirmation with detailed warning
					const confirmationResult = await extra.server.elicitInput({
						message: `? DANGER: PERMANENT DATA DELETION ?

You are about to PERMANENTLY DELETE the following collection:

 Database: ${args.database}
 Collection: ${args.collection}
 Document Count: ${docCount.toLocaleString()} documents
 Size: ${stats ? `${(stats.size / 1024 / 1024).toFixed(2)} MB` : "Unknown"}

 WARNING: This action CANNOT be undone!
 All data in this collection will be LOST FOREVER!

Do you REALLY want to proceed?`,
						requestedSchema: {
							type: "object",
							properties: {
								action: {
									type: "string",
									enum: ["yes_delete_permanently", "no_cancel"],
									title: "Confirm Permanent Deletion",
									description:
										"Type 'yes_delete_permanently' to confirm deletion or 'no_cancel' to cancel",
								},
								reason: {
									type: "string",
									title: "Reason for Deletion (optional)",
									description:
										"Why are you dropping this collection?",
								},
								confirmName: {
									type: "string",
									title: "Confirm Collection Name",
									description: `Type the collection name '${args.collection}' to confirm`,
								},
							},
							required: ["action", "confirmName"],
						},
					});

					// Check if user cancelled
					if (
						confirmationResult.action !== "accept" ||
						confirmationResult.content?.action !==
							"yes_delete_permanently"
					) {
						return {
							content: [
								{
									type: "text" as const,
									text: ` Collection deletion cancelled. No data was deleted.${confirmationResult.content?.reason ? `\nReason provided: ${confirmationResult.content.reason}` : ""}`,
								},
							],
							isError: false,
						};
					}

					// Verify collection name confirmation
					if (
						confirmationResult.content?.confirmName !== args.collection
					) {
						return {
							content: [
								{
									type: "text" as const,
									text: ` Collection deletion cancelled: Collection name confirmation mismatch. Expected '${args.collection}' but got '${confirmationResult.content?.confirmName}'.`,
								},
							],
							isError: false,
						};
					}

					shouldProceed = true;
					reason =
						confirmationResult.content?.reason ||
						"User confirmed deletion";
				}

				if (!shouldProceed) {
					return {
						content: [
							{
								type: "text" as const,
								text: "Collection deletion cancelled.",
							},
						],
						isError: false,
					};
				}

				// Drop the collection
				const dropResult = await collection.drop();

				if (!dropResult) {
					return {
						content: [
							{
								type: "text" as const,
								text: `Error: Failed to drop collection '${args.collection}'. Collection might have been already deleted.`,
							},
						],
						isError: true,
					};
				}

				// Success response
				return createCollectionResponse(
					args.database,
					args.collection,
					` Collection '${args.collection}' permanently deleted from database '${args.database}'. ${docCount.toLocaleString()} documents were removed.`,
					{
						documentsDeleted: docCount,
						reason: reason,
						timestamp: new Date().toISOString(),
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
						text: `Error dropping collection: ${error.message}`,
					},
				],
				isError: true,
			};
		}
	},
};
