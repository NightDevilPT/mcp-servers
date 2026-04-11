// src/tools/drop-collection/index.ts
import { z } from "zod";
import { MongoClient } from "mongodb";

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
		let client: MongoClient | null = null;

		try {
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

			// Validate MongoDB URI
			if (!process.env.MONGODB_URI) {
				return {
					content: [
						{
							type: "text" as const,
							text: "Error: MONGODB_URI environment variable is not set",
						},
					],
					isError: true,
				};
			}

			// Connect to MongoDB
			client = new MongoClient(process.env.MONGODB_URI);
			await client.connect();

			const db = client.db(args.database);

			// Check if database exists
			const dbList = await client.db().admin().listDatabases();
			const dbExists = dbList.databases.some(
				(d) => d.name === args.database,
			);

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
			const collections = await db
				.listCollections({ name: args.collection })
				.toArray();
			const collectionExists = collections.length > 0;

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
					message: `⚠️⚠️⚠️ DANGER: PERMANENT DATA DELETION ⚠️⚠️⚠️

You are about to PERMANENTLY DELETE the following collection:

📊 Database: ${args.database}
📁 Collection: ${args.collection}
📄 Document Count: ${docCount.toLocaleString()} documents
💾 Size: ${stats ? `${(stats.size / 1024 / 1024).toFixed(2)} MB` : "Unknown"}

⚠️ WARNING: This action CANNOT be undone!
⚠️ All data in this collection will be LOST FOREVER!

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
								text: `✅ Collection deletion cancelled. No data was deleted.${confirmationResult.content?.reason ? `\nReason provided: ${confirmationResult.content.reason}` : ""}`,
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
								text: `❌ Collection deletion cancelled: Collection name confirmation mismatch. Expected '${args.collection}' but got '${confirmationResult.content?.confirmName}'.`,
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
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								success: true,
								database: args.database,
								collection: args.collection,
								documentsDeleted: docCount,
								message: `✅ Collection '${args.collection}' permanently deleted from database '${args.database}'. ${docCount.toLocaleString()} documents were removed.`,
								reason: reason,
								timestamp: new Date().toISOString(),
							},
							null,
							2,
						),
					},
				],
				_meta: {
					timestamp: new Date().toISOString(),
					database: args.database,
					collection: args.collection,
					documentsDeleted: docCount,
				},
			};
		} catch (error: any) {
			// Handle specific MongoDB errors
			if (error.code === 26 || error.message.includes("does not exist")) {
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

			if (error.code === 13) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Error: Unauthorized to drop collection '${args.collection}'. Please check your database permissions.`,
						},
					],
					isError: true,
				};
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
		} finally {
			// Always close the connection
			if (client) {
				await client.close();
			}
		}
	},
};
