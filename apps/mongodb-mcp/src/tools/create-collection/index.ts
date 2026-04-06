// src/tools/create-collection/index.ts
import { z } from "zod";
import { MongoClient } from "mongodb";

export const CreateCollectionTool = {
	name: "create_collection",
	description:
		"[Database administration] : Create a new collection in MongoDB database with user confirmation",
	inputSchema: {
		database: z
			.string()
			.describe("Name of the database where collection will be created"),
		collection: z.string().describe("Name of the collection to create"),
		options: z
			.string()
			.optional()
			.describe(
				'Optional JSON string with collection options, example: {"capped": true, "size": 100000, "max": 5000}',
			),
	},
	// IMPORTANT: The second parameter 'extra' contains the server instance
	execute: async (
		args: {
			database: string;
			collection: string;
			options?: string;
		},
		extra: any, // This contains { server: McpServer }
	) => {
		let client: MongoClient | null = null;

		try {
			// Parse options if provided
			let collectionOptions = {};
			if (args.options) {
				try {
					collectionOptions = JSON.parse(args.options);
				} catch (parseError) {
					return {
						content: [
							{
								type: "text" as const,
								text: `Error: Invalid JSON in options parameter. ${parseError}`,
							},
						],
						isError: true,
					};
				}
			}

			// CORRECT WAY: Access elicitInput via extra.server.server
			// The structure is: extra.server.server.elicitInput
			const confirmationResult = await extra.server.elicitInput({
				message: `⚠️ You are about to create a new collection:\n\nDatabase: ${args.database}\nCollection: ${args.collection}\n${args.options ? `Options: ${JSON.stringify(collectionOptions, null, 2)}` : "No additional options"}\n\nDo you want to proceed?`,
				requestedSchema: {
					type: "object",
					properties: {
						action: {
							type: "string",
							enum: ["create", "cancel"],
							title: "Action",
							description:
								"Choose 'create' to proceed or 'cancel' to abort",
						},
						reason: {
							type: "string",
							title: "Reason (optional)",
							description:
								"Why are you creating this collection?",
						},
					},
					required: ["action"],
				},
			});

			// Handle user's decision - Based on the reference code pattern
			if (
				confirmationResult.action !== "accept" ||
				confirmationResult.content?.action !== "create"
			) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Collection creation cancelled by user.${confirmationResult.content?.reason ? ` Reason: ${confirmationResult.content.reason}` : ""}`,
						},
					],
					isError: false,
				};
			}

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

			// Connect to MongoDB
			client = new MongoClient(process.env.MONGODB_URI);
			await client.connect();

			const db = client.db(args.database);

			// Create the collection
			await db.createCollection(args.collection, collectionOptions);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								success: true,
								database: args.database,
								collection: args.collection,
								message: `Collection '${args.collection}' created successfully in database '${args.database}'`,
								options: collectionOptions,
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
			if (error.code === 48) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Error: Collection '${args.collection}' already exists in database '${args.database}'`,
						},
					],
					isError: true,
				};
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `Error creating collection: ${error.message}`,
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
