import { z } from "zod";
import { IGithubEmojis } from "../../types/github-types";

export const GetEmojisTool = {
	name: "get_emojis",
	description: "Retrieve all available GitHub emoji characters and their URLs for use in comments and descriptions",
	schema: {
		inputSchema: {},
	},
	execute: async () => {
		try {
			const response = await fetch("https://api.github.com/emojis");

			if (!response.ok) {
				throw new Error(
					`GitHub API error: ${response.status} ${response.statusText}`,
				);
			}

			const data: IGithubEmojis = await response.json();

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(data, null, 2),
					},
				],
				_meta: {
					emoji_count: Object.keys(data).length,
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
