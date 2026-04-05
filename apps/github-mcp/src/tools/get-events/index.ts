import { z } from "zod";
import { IGithubEvent } from "../../types/github-types";

export const GetEventsTool = {
	name: "get_public_events",
	description: "Get the global public GitHub events timeline showing all public activity across GitHub",
	schema: {
		inputSchema: {
			per_page: z
				.number()
				.min(1)
				.max(100)
				.optional()
				.default(30)
				.describe("Results per page"),
			page: z
				.number()
				.min(1)
				.optional()
				.default(1)
				.describe("Page number"),
		},
	},
	execute: async ({
		per_page,
		page,
	}: {
		per_page?: number;
		page?: number;
	}) => {
		try {
			const params = new URLSearchParams();
			if (per_page) params.append("per_page", per_page.toString());
			if (page) params.append("page", page.toString());

			const url = `https://api.github.com/events${params.toString() ? `?${params}` : ""}`;
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(
					`GitHub API error: ${response.status} ${response.statusText}`,
				);
			}

			const data: IGithubEvent[] = await response.json();

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(data, null, 2),
					},
				],
				_meta: {
					event_count: data.length,
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
