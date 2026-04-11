// src/tools/db-administration/drop_all_collections/index.ts
import { z } from "zod";
import { MongoClient, Db } from "mongodb";
import {
	withMongoConnection,
	handleMongoError,
	createDatabaseResponse,
	generateFieldSummary,
} from "../../../utils";

export const DropAllCollectionsTool = {
	name: "drop_all_collections",
	description: `[Database Administration] Drop collections from MongoDB database using dynamic form with dropdown selection.

HOW IT WORKS:
1. Takes database name as input
2. Fetches all collections in the database with their statistics
3. Generates a dynamic form with dropdown select for collection selection
4. User selects collection to delete from dropdown
5. Shows detailed warning with collection information
6. Confirms deletion and removes selected collection

FEATURES:
- Dynamic form generation with dropdown selection
- Collection statistics display (document count, size)
- Single collection selection for safety
- Detailed confirmation warnings
- Safe deletion with user confirmation
- Form field validation

SAFETY FEATURES:
- Shows collection statistics before deletion
- Requires explicit user confirmation
- Displays detailed warning for each collection
- Prevents accidental mass deletion

EXAMPLE USAGE:
{
  "databaseName": "myApp"
}

OUTPUT:
- List of all collections with statistics
- Dynamic form with dropdown for collection selection
- Detailed deletion confirmation
- Success/failure status for selected collection`,

	inputSchema: {
		databaseName: z
			.string()
			.describe("Name of the database containing collections to drop"),
	},
	execute: async (
		args: {
			databaseName: string;
		},
		extra: any,
	) => {
		try {
			return await withMongoConnection(
				args.databaseName,
				async (client: MongoClient, db: Db) => {
					// Get all collections with statistics
					const collections = await db.listCollections().toArray();

					if (collections.length === 0) {
						return createDatabaseResponse(
							args.databaseName,
							`No collections found in database '${args.databaseName}'`,
						);
					}

					// Fetch statistics for each collection
					const collectionStats = [];
					for (const collection of collections) {
						try {
							const stats = await db.command({
								collStats: collection.name,
							});
							const docCount = await db
								.collection(collection.name)
								.countDocuments();

							collectionStats.push({
								name: collection.name,
								type: collection.type || "collection",
								documentCount: docCount,
								size: stats.size || 0,
								avgObjSize: stats.avgObjSize || 0,
								indexCount: stats.nindexes || 0,
								indexSize: stats.totalIndexSize || 0,
								capped: stats.capped || false,
							});
						} catch (error) {
							// If stats fail, still include basic info
							collectionStats.push({
								name: collection.name,
								type: collection.type || "collection",
								documentCount: 0,
								size: 0,
								avgObjSize: 0,
								indexCount: 0,
								indexSize: 0,
								capped: false,
							});
						}
					}

					// Generate dynamic form with checkboxes using form generator pattern
					const formProperties: Record<string, any> = {};

					// Add boolean checkbox for each collection
					collectionStats.forEach((collection) => {
						formProperties[collection.name] = {
							type: "boolean",
							title: `${collection.name} (${collection.documentCount.toLocaleString()} docs, ${(collection.size / 1024 / 1024).toFixed(2)} MB)`,
							description: `Drop collection '${collection.name}' - ${collection.documentCount.toLocaleString()} documents, ${(collection.size / 1024 / 1024).toFixed(2)} MB`,
							default: false,
						};
					});

					// Add delete button field
					formProperties.deleteSelected = {
						type: "string",
						title: "Delete Selected Collections",
						description: "Click to delete all selected collections",
						enum: ["DELETE_NOW"],
						default: "",
					};

					const formSchema = {
						type: "object",
						properties: formProperties,
						required: ["deleteSelected"],
					};

					// Generate message with collection information
					let message = `# Drop Multiple Collections - ${args.databaseName}\n\n`;
					message += `Found ${collectionStats.length} collections in database '${args.databaseName}':\n\n`;

					message += "## Collection Details:\n\n";
					collectionStats.forEach((collection) => {
						message += `**${collection.name}**\n`;
						message += `- Documents: ${collection.documentCount.toLocaleString()}\n`;
						message += `- Size: ${(collection.size / 1024 / 1024).toFixed(2)} MB\n`;
						message += `- Indexes: ${collection.indexCount}\n`;
						message += `- Type: ${collection.type}\n`;
						message += `- Capped: ${collection.capped ? "Yes" : "No"}\n\n`;
					});

					message += "## Selection Instructions\n\n";
					message +=
						"1. Check the boxes next to collections you want to delete\n";
					message +=
						"2. Click 'DELETE_NOW' to delete all selected collections\n";
					message +=
						"3. This action is **IRREVERSIBLE** - all data in selected collections will be permanently deleted\n\n";

					// Request user input with dynamic form
					const formResult = await extra.server.elicitInput({
						mode: "form",
						message: `${message}Please select collections to delete:`,
						requestedSchema: formSchema,
					});

					if (formResult.action !== "accept") {
						return createDatabaseResponse(
							args.databaseName,
							"Collection deletion cancelled by user.",
						);
					}

					// Validate action
					if (formResult.content?.deleteSelected !== "DELETE_NOW") {
						return createDatabaseResponse(
							args.databaseName,
							"Action cancelled by user.",
						);
					}

					// Get selected collections from checkboxes
					const selectedCollections = Object.entries(
						formResult.content || {},
					)
						.filter(
							([name, selected]) =>
								name !== "deleteSelected" && selected === true,
						)
						.map(([name]) => name);

					if (selectedCollections.length === 0) {
						return createDatabaseResponse(
							args.databaseName,
							"No collections selected for deletion.",
						);
					}

					// Drop selected collections
					const results = [];
					for (const collectionName of selectedCollections) {
						try {
							await db.collection(collectionName).drop();
							results.push({
								name: collectionName,
								status: "success",
								message: `Collection '${collectionName}' deleted successfully`,
							});
						} catch (error: any) {
							results.push({
								name: collectionName,
								status: "error",
								message: `Failed to delete '${collectionName}': ${error.message}`,
							});
						}
					}

					// Generate summary
					const successful = results.filter(
						(r) => r.status === "success",
					);
					const failed = results.filter((r) => r.status === "error");

					let summaryMessage = `# Collection Deletion Summary\n\n`;
					summaryMessage += `Database: ${args.databaseName}\n`;
					summaryMessage += `Total selected: ${selectedCollections.length}\n`;
					summaryMessage += `Successfully deleted: ${successful.length}\n`;
					summaryMessage += `Failed to delete: ${failed.length}\n\n`;

					if (successful.length > 0) {
						summaryMessage += "## Successfully Deleted:\n\n";
						successful.forEach((r) => {
							summaryMessage += `- ${r.name}: ${r.message}\n`;
						});
						summaryMessage += "\n";
					}

					if (failed.length > 0) {
						summaryMessage += "## Failed to Delete:\n\n";
						failed.forEach((r) => {
							summaryMessage += `- ${r.name}: ${r.message}\n`;
						});
					}

					return createDatabaseResponse(
						args.databaseName,
						`Bulk collection deletion completed. ${successful.length} of ${selectedCollections.length} collections deleted successfully.`,
						{
							selectedCollections,
							results,
							successfulCount: successful.length,
							failedCount: failed.length,
						},
					);
				},
			);
		} catch (error: any) {
			const handledError = handleMongoError(error, args.databaseName);
			if (handledError) {
				return handledError;
			}

			return {
				content: [
					{
						type: "text" as const,
						text: `Error dropping collections: ${error.message}`,
					},
				],
				isError: true,
			};
		}
	},
};
