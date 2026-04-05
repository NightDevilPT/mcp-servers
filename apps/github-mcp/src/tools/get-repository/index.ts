import { z } from "zod";
import { IGithubRepository } from "../../types/github-types";

export const GetRepositoryTool = {
	name: "get_repository",
	description: "Retrieve detailed repository information including stats, languages, topics, and metadata",
	schema: {
		inputSchema: {
			owner: z.string().describe("Repository owner's username"),
			repo: z.string().describe("Repository name"),
		},
	},
	execute: async ({ owner, repo }: { owner: string; repo: string }) => {
		try {
			const response = await fetch(
				`https://api.github.com/repos/${owner}/${repo}`,
			);

			if (!response.ok) {
				if (response.status === 404) {
					throw new Error(`Repository '${owner}/${repo}' not found`);
				}
				throw new Error(
					`GitHub API error: ${response.status} ${response.statusText}`,
				);
			}

			const data: IGithubRepository = await response.json();

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(data, null, 2),
					},
				],
				_meta: {
					repository: data.full_name,
					stars: data.stargazers_count,
					forks: data.forks_count,
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
