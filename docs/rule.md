Here is the complete MCP Development Guide with simple code examples, ready for you to copy and paste.

---

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
- URI format: scheme://resource/{param}

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

const server = new McpServer(
	{
		name: "your-mcp-server-name",
		version: "1.0.0",
	},
	{
		capabilities: {
			tools: {},
			resources: {},
			elicitation: {},
		},
	},
);

for (const tool of tools) {
	server.registerTool(
		tool.name,
		{
			description: tool.description,
			inputSchema: tool.inputSchema,
		},
		async (args, extra) => {
			return tool.execute(args, server);
		},
	);
}

for (const resource of resources) {
	server.registerResource(
		resource.name,
		resource.uri,
		{
			description: resource.description,
			inputSchema: resource.inputSchema,
		},
		async (args, extra) => {
			return resource.execute(args, server);
		},
	);
}

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

1. Enable capabilities: tools, resources, elicitation
2. Register tools and resources by iterating through arrays
3. Pass server reference to execute functions
4. Access elicitInput via extra.server.elicitInput()

---

## Section 4: Human-in-the-Loop Using elicitInput

### Basic elicitInput Pattern

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

	if (result.action === "accept") {
		const userInput = result.content.fieldName;
		return {
			content: [{ type: "text", text: `Received: ${userInput}` }],
		};
	} else if (result.action === "decline") {
		return {
			content: [{ type: "text", text: "User declined operation" }],
			isError: false,
		};
	} else {
		return {
			content: [{ type: "text", text: "Operation cancelled" }],
			isError: false,
		};
	}
};
```

---

## Section 5: Dynamic Form Input Using FormGenerator

### FormGenerator Utility Location
`src/utils/form-generator.ts`

### Pattern 1: Simple Form Input

```typescript
import { z } from "zod";
import { FormGenerator } from "../utils/form-generator.js";

export const CreateUserTool = {
	name: "create_user",
	description: "Create a new user",
	inputSchema: {
		apiUrl: z.string().describe("API endpoint"),
	},
	execute: async (args: { apiUrl: string }, extra: any) => {
		const userSchema = {
			type: "object",
			properties: {
				name: { type: "string", minLength: 2, maxLength: 50 },
				email: { type: "string", format: "email" },
				age: { type: "number", minimum: 18, maximum: 120 },
			},
			required: ["name", "email"],
		};

		const formSchema = FormGenerator.generateFormSchema(userSchema, {
			includeTimestamps: false,
			includeIds: false,
		});

		const result = await extra.server.elicitInput({
			mode: "form",
			message: "Please provide user details:",
			requestedSchema: formSchema,
		});

		if (result.action !== "accept") {
			return {
				content: [{ type: "text", text: "User creation cancelled" }],
				isError: false,
			};
		}

		const userData = result.content;
		// Save userData to database or API
		
		return {
			content: [{ type: "text", text: `User ${userData.name} created` }],
			_meta: { timestamp: new Date().toISOString() },
		};
	},
};
```

### Pattern 2: Confirmation with Options

```typescript
import { z } from "zod";
import { FormGenerator } from "../utils/form-generator.js";

export const DeleteResourceTool = {
	name: "delete_resource",
	description: "Delete a resource with confirmation",
	inputSchema: {
		resourceId: z.string().describe("ID of resource to delete"),
	},
	execute: async (args: { resourceId: string }, extra: any) => {
		const confirmationSchema = {
			type: "object",
			properties: {
				action: {
					type: "string",
					enum: ["delete", "cancel"],
					title: "Action",
				},
				reason: {
					type: "string",
					title: "Reason (optional)",
				},
			},
			required: ["action"],
		};

		const formSchema = FormGenerator.generateFormSchema(confirmationSchema);

		const result = await extra.server.elicitInput({
			mode: "form",
			message: `⚠️ Are you sure you want to delete resource ${args.resourceId}?`,
			requestedSchema: formSchema,
		});

		if (result.action !== "accept" || result.content.action !== "delete") {
			return {
				content: [{ type: "text", text: "Deletion cancelled" }],
				isError: false,
			};
		}

		// Perform deletion
		return {
			content: [{ type: "text", text: "Resource deleted successfully" }],
			_meta: { timestamp: new Date().toISOString() },
		};
	},
};
```

### Pattern 3: Complex Nested Data

```typescript
import { z } from "zod";
import { FormGenerator } from "../utils/form-generator.js";

export const CreateBlogPostTool = {
	name: "create_blog_post",
	description: "Create a new blog post",
	inputSchema: {},
	execute: async (args: any, extra: any) => {
		const blogSchema = {
			type: "object",
			properties: {
				title: { type: "string", minLength: 5, maxLength: 200 },
				content: { type: "string", minLength: 50 },
				tags: {
					type: "array",
					items: { type: "string" },
					minItems: 1,
					maxItems: 5,
				},
				published: { type: "boolean", default: false },
				author: {
					type: "object",
					properties: {
						name: { type: "string" },
						email: { type: "string", format: "email" },
					},
					required: ["name"],
				},
			},
			required: ["title", "content", "author"],
		};

		const formSchema = FormGenerator.generateFormSchema(blogSchema, {
			includeTimestamps: false,
			includeIds: false,
			fieldTransformations: {
				title: (field) => ({
					...field,
					title: "Blog Title",
					description: "Enter a catchy title (5-200 characters)",
				}),
			},
		});

		const result = await extra.server.elicitInput({
			mode: "form",
			message: "# Create New Blog Post\n\nPlease provide the post details:",
			requestedSchema: formSchema,
		});

		if (result.action !== "accept") {
			return {
				content: [{ type: "text", text: "Blog creation cancelled" }],
				isError: false,
			};
		}

		const postData = result.content;
		
		return {
			content: [{ type: "text", text: `Blog post "${postData.title}" created` }],
			_meta: { timestamp: new Date().toISOString() },
		};
	},
};
```

### Pattern 4: Dynamic Schema from External Source

```typescript
import { z } from "zod";
import { FormGenerator } from "../utils/form-generator.js";

export const CreateDynamicResourceTool = {
	name: "create_dynamic_resource",
	description: "Create resource using dynamic schema",
	inputSchema: {
		source: z.string().describe("Data source name"),
		resourceType: z.string().describe("Type of resource to create"),
	},
	execute: async (args: { source: string; resourceType: string }, extra: any) => {
		try {
			// Fetch schema from external API
			const schema = await fetchSchema(args.source, args.resourceType);
			
			const formSchema = FormGenerator.generateFormSchema(schema, {
				includeTimestamps: false,
				includeIds: false,
			});

			const result = await extra.server.elicitInput({
				mode: "form",
				message: `Create ${args.resourceType} from ${args.source}:`,
				requestedSchema: formSchema,
			});

			if (result.action !== "accept") {
				return {
					content: [{ type: "text", text: "Operation cancelled" }],
					isError: false,
				};
			}

			// Create resource with result.content
			return {
				content: [{ type: "text", text: "Resource created successfully" }],
				_meta: { timestamp: new Date().toISOString() },
			};
		} catch (error) {
			// Fallback form
			const fallbackSchema = {
				type: "object",
				properties: {
					data: {
						type: "string",
						title: "Data JSON",
						description: "Enter data as JSON",
					},
				},
				required: ["data"],
			};

			const result = await extra.server.elicitInput({
				mode: "form",
				message: "No schema found. Please provide data:",
				requestedSchema: fallbackSchema,
			});

			if (result.action !== "accept") {
				return {
					content: [{ type: "text", text: "Cancelled" }],
					isError: false,
				};
			}

			const data = JSON.parse(result.content.data);
			return {
				content: [{ type: "text", text: "Resource created with custom data" }],
				_meta: { timestamp: new Date().toISOString() },
			};
		}
	},
};
```

### Pattern 5: Filter/Search Form

```typescript
import { z } from "zod";
import { FormGenerator } from "../utils/form-generator.js";

export const SearchUsersTool = {
	name: "search_users",
	description: "Search users with filters",
	inputSchema: {},
	execute: async (args: any, extra: any) => {
		const filterSchema = {
			type: "object",
			properties: {
				name: { type: "string", description: "User name (partial match)" },
				minAge: { type: "number", minimum: 0, maximum: 150 },
				maxAge: { type: "number", minimum: 0, maximum: 150 },
				role: {
					type: "string",
					enum: ["admin", "user", "guest"],
					description: "User role",
				},
				active: { type: "boolean", default: true },
			},
		};

		const formSchema = FormGenerator.generateFormSchema(filterSchema, {
			includeTimestamps: false,
			includeIds: false,
		});

		const result = await extra.server.elicitInput({
			mode: "form",
			message: "Enter search filters:",
			requestedSchema: formSchema,
		});

		if (result.action !== "accept") {
			return {
				content: [{ type: "text", text: "Search cancelled" }],
				isError: false,
			};
		}

		const filters = result.content;
		// Build query from filters and search
		const users = await searchUsers(filters);
		
		return {
			content: [{ type: "text", text: JSON.stringify(users, null, 2) }],
			_meta: { timestamp: new Date().toISOString() },
		};
	},
};
```

---

## Section 6: FormGenerator Rules and Patterns

### Rules to Follow

1. Always import FormGenerator from "../utils/form-generator.js"
2. Define your data schema before calling elicitInput
3. Always pass options { includeTimestamps: false, includeIds: false } for user input forms
4. Use fieldTransformations for custom field overrides (passwords, special validation)
5. Always check result.action === "accept" before processing data
6. Handle decline and cancel actions with friendly messages and isError: false
7. Use result.content directly - it's already validated against your schema

### When to Use Each Pattern

- **Pattern 1 (Simple Form)**: Creating resources, collecting user data, multi-field input
- **Pattern 2 (Confirmation)**: Delete operations, destructive actions, approval workflows
- **Pattern 3 (Nested Data)**: Complex objects with arrays, blog posts, user profiles with addresses
- **Pattern 4 (Dynamic Schema)**: External APIs, database schemas, configurable forms
- **Pattern 5 (Search/Filter)**: Query builders, search interfaces, report filters

---

## Project Structure Reference

```
src/
├── tools/
│   ├── create-user/
│   │   └── index.ts
│   ├── delete-resource/
│   │   └── index.ts
│   ├── create-blog-post/
│   │   └── index.ts
│   └── index.ts
├── resources/
│   └── index.ts
├── utils/
│   └── form-generator.ts
└── server.ts
```