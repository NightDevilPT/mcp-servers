// src/tools/drop-collection/index.ts
import { z } from "zod";
import { MongoClient } from "mongodb";

export const DropCollectionTool = {
	name: "drop_collection",
	description: "[Database administration] : Drop a collection from MongoDB database with user confirmation",
	inputSchema: {
		database: z
			.string()
			.describe("Name of the database where collection will be dropped"),
		collection: z.string().describe("Name of the collection to drop"),
	},
	execute: async (
		args: {
			database: string;
			collection: string;
		},
		extra: any, // Contains { server: McpServer }
	) => {
		let client: MongoClient | null = null;

		try {
			// Connect to MongoDB first to check if collection exists
			if (!process.env.MONGODB_URI) {
				return {
					content: [
						{
							type: "text" as const,
							text: "MONGODB_URI environment variable is not set",
						},
					],
					isError: true,
				};
			}
			client = new MongoClient(process.env.MONGODB_URI);
			await client.connect();

			const db = client.db(args.database);

			// Check if collection exists before prompting user
			const collections = await db.listCollections({ name: args.collection }).toArray();
			if (collections.length === 0) {
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

			// Collection exists, now prompt for confirmation
			const confirmationResult = await extra.server.elicitInput({
				message: `⚠️ You are about to permanently drop a collection:\n\nDatabase: ${args.database}\nCollection: ${args.collection}\n\n⚠️ WARNING: This action cannot be undone and all data in this collection will be permanently lost!\n\nDo you want to proceed?`,
				requestedSchema: {
					type: "object",
					properties: {
						action: {
							type: "string",
							enum: ["yes", "no"],
							title: "Confirm Drop",
							description:
								"Choose 'yes' to drop the collection or 'no' to cancel",
						},
						reason: {
							type: "string",
							title: "Reason (optional)",
							description:
								"Why are you dropping this collection?",
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
							text: `Collection drop cancelled by user.${confirmationResult.content?.reason ? ` Reason: ${confirmationResult.content.reason}` : ""}`,
						},
					],
					isError: false,
				};
			}

			// Drop the collection
			const result = await db.collection(args.collection).drop();

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								success: true,
								database: args.database,
								collection: args.collection,
								message: `Collection '${args.collection}' dropped successfully from database '${args.database}'`,
								dropped: result,
								reason:
									confirmationResult.content?.reason ||
									"No reason provided",
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
				},
			};
		} catch (error: any) {
			// Handle specific MongoDB errors
			if (error.code === 26) {
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
