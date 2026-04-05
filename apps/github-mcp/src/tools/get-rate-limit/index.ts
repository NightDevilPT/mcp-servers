import { z } from "zod";
import { IGithubRateLimit } from "../../types/github-types";

export const GetRateLimitTool = {
	name: "get_rate_limit",
	description: "Check current GitHub API rate limits for core, search, GraphQL, and integration endpoints",
	schema: {
		inputSchema: {},
	},
	execute: async () => {
		try {
			const response = await fetch("https://api.github.com/rate_limit");

			if (!response.ok) {
				throw new Error(
					`GitHub API error: ${response.status} ${response.statusText}`,
				);
			}

			const data: IGithubRateLimit = await response.json();

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(data, null, 2),
					},
				],
				_meta: {
					core_remaining: data.resources.core.remaining,
					core_limit: data.resources.core.limit,
					search_remaining: data.resources.search.remaining,
					timestamp: new Date().toISOString(),
				} as Record<string, unknown>,
			};
		} catch (error) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Error: ${error instanceof Error ? error.message : "Unknown error occurred"}`,
					},
				],
				isError: true,
			};
		}
	},
};
