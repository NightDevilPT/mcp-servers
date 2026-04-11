import { tools } from "./tools/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

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

for (const tool of tools) {
	server.registerTool(
		tool.name,
		{
			description: tool.description,
			inputSchema: tool.inputSchema,
		},
		async (args: any, extra: any) => {
			return tool.execute(args, server);
		},
	);
}

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("MongoDB MCP server running on stdio");
}

main().catch((error) => {
	console.error("Server error:", error);
	process.exit(1);
});