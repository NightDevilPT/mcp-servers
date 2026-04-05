import { z } from "zod";
import { IGithubRepository } from "../../types/github-types";

export const GetUserReposTool = {
	name: "get_user_repositories",
	description: "Get all repositories for a specific user with filtering by ownership type and sorting options",
	schema: {
		inputSchema: {
			username: z.string().describe("GitHub username"),
			type: z
				.enum(["all", "owner", "member"])
				.optional()
				.default("owner")
				.describe("Repository type"),
			sort: z
				.enum(["created", "updated", "pushed", "full_name"])
				.optional()
				.default("created")
				.describe("Sort field"),
			direction: z
				.enum(["asc", "desc"])
				.optional()
				.default("desc")
				.describe("Sort direction"),
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
		username,
		type,
		sort,
		direction,
		per_page,
		page,
	}: {
		username: string;
		type?: string;
		sort?: string;
		direction?: string;
		per_page?: number;
		page?: number;
	}) => {
		try {
			const params = new URLSearchParams();
			if (type) params.append("type", type);
			if (sort) params.append("sort", sort);
			if (direction) params.append("direction", direction);
			if (per_page) params.append("per_page", per_page.toString());
			if (page) params.append("page", page.toString());

			const url = `https://api.github.com/users/${username}/repos${params.toString() ? `?${params}` : ""}`;
			const response = await fetch(url);

			if (!response.ok) {
				if (response.status === 404) {
					throw new Error(`User '${username}' not found`);
				}
				throw new Error(
					`GitHub API error: ${response.status} ${response.statusText}`,
				);
			}

			const data: IGithubRepository[] = await response.json();

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(data, null, 2),
					},
				],
				_meta: {
					username,
					repository_count: data.length,
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
