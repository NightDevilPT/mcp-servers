# MCP Development Guide

## Fundamental Rules

1. **Type Validation**: Implement Zod for runtime type checking
2. **Uniform Responses**: Maintain identical response structure across all operations
3. **Error Management**: Return error responses instead of throwing exceptions
4. **Clear Documentation**: Include descriptions for every parameter
5. **User Interaction**: Apply `elicitInput` when requiring user decisions or data

---

## Section 1: Tools

Tools handle actions and operational logic.

### Tool Template

```typescript
import { z } from "zod";

export const ActionNameTool = {
	name: "action_name",
	description: "Brief explanation of tool functionality",
	inputSchema: {
		param: z.string().describe("Parameter description with usage example"),
	},
	execute: async (
		args: { param: string },
		extra: any, // Contains { server: McpServer }
	) => {
		try {
			const data = await fetchData(args.param);
			return {
				content: [
					{ type: "text", text: JSON.stringify(data, null, 2) },
				],
				_meta: { timestamp: new Date().toISOString() },
			};
		} catch (error) {
			return {
				content: [{ type: "text", text: `Error: ${error.message}` }],
				isError: true,
			};
		}
	},
};
```

### Tool Naming Conventions

- Folder: kebab-case/ (e.g., create-collection/)
- Export: PascalCaseTool (e.g., CreateCollectionTool)
- Name property: snake_case (e.g., create_collection)

### Tool Registration Hub

File: src/tools/index.ts

```typescript
import { CreateCollectionTool } from "./create-collection/index";
import { FindDocumentsTool } from "./find-documents/index";

export const tools = [CreateCollectionTool, FindDocumentsTool];
```

---

## Section 2: Resources

Resources provide data through URI-based access patterns.

### Resource Template

```typescript
import { z } from "zod";

export const ResourceNameResource = {
	name: "resource_name",
	description: "Description of resource content and purpose",
	uri: "scheme://path/{parameter}",
	inputSchema: {
		parameter: z.string().describe("Parameter explanation"),
	},
	execute: async (
		args: { parameter: string },
		extra: any, // Contains { server: McpServer }
	) => {
		try {
			const data = await fetchData(args.parameter);
			return {
				contents: [
					{
						uri: `scheme://path/${args.parameter}`,
						mimeType: "application/json",
						text: JSON.stringify(data, null, 2),
					},
				],
				_meta: { timestamp: new Date().toISOString() },
			};
		} catch (error) {
			return {
				contents: [
					{
						uri: `scheme://path/${args.parameter}`,
						mimeType: "text/plain",
						text: `Error: ${error.message}`,
					},
				],
				isError: true,
			};
		}
	},
};
```

### Resource Naming Rules

- Folder: kebab-case/ (e.g., database-stats/)
- Export: PascalCaseResource (e.g., DatabaseStatsResource)
- Name property: snake_case (e.g., database_stats)
- URI format: scheme://resource/{param} (e.g., mongodb://database/{databaseName}/stats)

### Resource Registration Hub

File: src/resources/index.ts

```typescript
import { DatabaseStatsResource } from "./database-stats/index";
import { CollectionInfoResource } from "./collection-info/index";

export const resources = [DatabaseStatsResource, CollectionInfoResource];
```

---

## Section 3: MCP Server Configuration

### Standard Server Implementation

File: src/server.ts

```typescript
import { tools } from "./tools/index.js";
import { resources } from "./resources/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Initialize MCP server
const server = new McpServer(
	{
		name: "your-mcp-server-name",
		version: "1.0.0",
	},
	{
		capabilities: {
			tools: {}, // Enable tool functionality
			resources: {}, // Enable resource functionality (optional)
			elicitation: {}, // Enable user interaction features
		},
	},
);

// Register all tools
for (const tool of tools) {
	server.registerTool(
		tool.name,
		{
			description: tool.description,
			inputSchema: tool.inputSchema,
		},
		// Execute receives (args, extra) - extra includes server reference
		async (args, extra) => {
			return tool.execute(args, server);
		},
	);
}

// Register all resources (if applicable)
for (const resource of resources) {
	server.registerResource(
		resource.name,
		resource.uri,
		{
			description: resource.description,
			inputSchema: resource.inputSchema,
		},
		// Execute receives (args, extra) - extra includes server reference
		async (args, extra) => {
			return resource.execute(args, server);
		},
	);
}

// Launch server
async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("MCP server running on stdio");
}

main().catch((error) => {
	console.error("Server error:", error);
	process.exit(1);
});
```

### Server Configuration Essentials

1. **Capabilities**: Enable `tools: {}`, `resources: {}`, and `elicitation: {}` based on requirements
2. **Extra Parameter**: The registration callback receives `(args, extra)` where `extra` holds the server reference
3. **Forwarding**: Pass `extra` (not `server`) to your execute function
4. **Access Method**: Inside execute, use `extra.server.elicitInput()` for user prompts

---

## Section 4: Human-in-the-Loop Using elicitInput

When operations need user confirmation or extra input, leverage `extra.server.elicitInput` to pause and request interaction. The `extra` parameter provides server access.

### Access Pattern

```typescript
execute: async (args, extra) => {
	// Access elicitInput through extra.server
	const result = await extra.server.elicitInput({
		message: "Clear user prompt",
		requestedSchema: {
			/* JSON Schema definition */
		},
	});

	// Process result
};
```

### Basic Implementation for Tools

```typescript
execute: async (args, extra) => {
	const result = await extra.server.elicitInput({
		message: "Clear description of required input",
		requestedSchema: {
			type: "object",
			properties: {
				fieldName: {
					type: "string",
					title: "Field Label",
					description: "Expected input description",
				},
			},
			required: ["fieldName"],
		},
	});

	// Process based on user action
	if (result.action === "accept") {
		const userInput = result.content.fieldName;
		// Proceed with userInput
		return {
			content: [{ type: "text", text: `Received: ${userInput}` }],
		};
	} else if (result.action === "decline") {
		return {
			content: [{ type: "text", text: "User declined operation" }],
			isError: false,
		};
	} else {
		// "cancel"
		return {
			content: [{ type: "text", text: "Operation cancelled" }],
			isError: false,
		};
	}
};
```

## Project Structure Reference

```
src/
├── tools/
│   ├── tool-name/
│   │   └── index.ts
│   ├── another-tool/
│   │   └── index.ts
│   └── index.ts
├── resources/
│   ├── resource-name/
│   │   └── index.ts
│   ├── another-resource/
│   │   └── index.ts
│   └── index.ts
├── types/
│   └── github-types.ts
└── server.ts
```

### Implementation Examples

#### Folder Layout

```
Directory structure:
└── mongodb-mcp/
    ├── docker-compose.yml
    ├── package-lock.json
    ├── package.json
    ├── src/
    │   ├── server.ts
    │   └── tools/
    │       ├── create-collection/
    │       │   └── index.ts
    │       └── index.ts
    └── tsconfig.json
```

##### src/server.ts Implementation

```ts
import { tools } from "./tools/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Initialize MCP server instance
const server = new McpServer(
	{
		name: "mongodb-mcp-server",
		version: "1.0.0",
	},
	{
		capabilities: {
			tools: {},
		},
	},
);

// Register all available tools
for (const tool of tools) {
	server.registerTool(
		tool.name,
		{
			description: tool.description,
			inputSchema: tool.inputSchema,
		},
		// Execute function receives (args, extra) - extra contains server reference
		async (args, extra) => {
			// Forward server instance to tool's execute function
			return tool.execute(args, server);
		},
	);
}

// Launch server
async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("MongoDB MCP server running on stdio");
}

main().catch((error) => {
	console.error("Server error:", error);
	process.exit(1);
});
```

##### src/tools/index.ts Implementation

```ts
import { createCollectionTool } from "./create-collection/index.js";

export const tools = [createCollectionTool];
```

##### src/tools/create-collection/index.ts Implementation

```ts
// src/tools/create-collection/index.ts
import { z } from "zod";
import { MongoClient } from "mongodb";

export const CreateCollectionTool = {
	name: "create_collection",
	description:
		"Create a new collection in MongoDB database with user confirmation",
	inputSchema: {
		uri: z
			.string()
			.describe(
				"URI of the MongoDB database where collection will be created",
			),
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
	// The 'extra' parameter contains the server instance
	execute: async (
		args: {
			uri: string;
			database: string;
			collection: string;
			options?: string;
		},
		extra: any, // Contains { server: McpServer }
	) => {
		let client: MongoClient | null = null;

		try {
			// Parse options if supplied
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

			// Access elicitInput via extra.server.server
			// Structure: extra.server.server.elicitInput
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

			// Process user decision based on reference pattern
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

			// Connect to MongoDB
			client = new MongoClient(args.uri);
			await client.connect();

			const db = client.db(args.database);

			// Execute collection creation
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
			// Handle MongoDB-specific errors
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
			// Ensure connection cleanup
			if (client) {
				await client.close();
			}
		}
	},
};
```
