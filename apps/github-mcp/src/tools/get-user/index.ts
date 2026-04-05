import { z } from "zod";
import { IGithubUserInfo } from "../../types/github-types";

export const GetUserInfoTool = {
	name: "get_user_info",
	description: "Get comprehensive user profile information including bio, location, followers, and public repositories",
	schema: {
		inputSchema: {
			username: z
				.string()
				.describe(
					"The username of the user to get information for (e.g., 'nightdevilpt')",
				),
		},
	},
	execute: async ({ username }: { username: string }) => {
		try {
			const response = await fetch(
				`https://api.github.com/users/${username}`,
			);

			if (!response.ok) {
				if (response.status === 404) {
					throw new Error(`User '${username}' not found`);
				}
				throw new Error(
					`GitHub API error: ${response.status} ${response.statusText}`,
				);
			}

			const data: IGithubUserInfo = await response.json();

			// Return formatted response for MCP with proper typing
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(data, null, 2),
					},
				],
				_meta: {
					userData: data,
					timestamp: new Date().toISOString(),
					username: username,
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
