#!/usr/bin/env node

import { tools } from "./tools/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Create MCP server instance
const server = new McpServer(
	{
		name: "github-mcp-server",
		version: "1.0.0",
	},
	{
		capabilities: {
			tools: {},
		},
	},
);

// Register all tools
for (const tool of tools) {
	server.registerTool(
		tool.name,
		{
			description: tool.description,
			inputSchema: tool.schema.inputSchema,
		},
		tool.execute,
	);
}

// Start the server
async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("GitHub MCP server running on stdio");
}

main().catch((error) => {
	console.error("Server error:", error);
});
