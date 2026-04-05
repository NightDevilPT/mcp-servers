import { z } from "zod";
import { IGithubSearchRepoResponse } from "../../types/github-types";

export const SearchRepositoriesTool = {
	name: "search_repositories",
	description: "Search GitHub repositories with filters for language, stars, forks, creation date, and more",
	schema: {
		inputSchema: {
			q: z
				.string()
				.describe(
					"The search query. Example: 'q=tetris+language:assembly'",
				),
			sort: z
				.enum(["stars", "forks", "help-wanted-issues", "updated"])
				.optional()
				.describe("Sort field"),
			order: z
				.enum(["desc", "asc"])
				.optional()
				.describe("Sort order (desc or asc)"),
			per_page: z
				.number()
				.min(1)
				.max(100)
				.optional()
				.default(30)
				.describe("Results per page (max 100)"),
			page: z
				.number()
				.min(1)
				.optional()
				.default(1)
				.describe("Page number"),
		},
	},
	execute: async ({
		q,
		sort,
		order,
		per_page,
		page,
	}: {
		q: string;
		sort?: string;
		order?: string;
		per_page?: number;
		page?: number;
	}) => {
		try {
			const params = new URLSearchParams({ q });
			if (sort) params.append("sort", sort);
			if (order) params.append("order", order);
			if (per_page) params.append("per_page", per_page.toString());
			if (page) params.append("page", page.toString());

			const response = await fetch(
				`https://api.github.com/search/repositories?${params}`,
			);

			if (!response.ok) {
				throw new Error(
					`GitHub API error: ${response.status} ${response.statusText}`,
				);
			}

			const data: IGithubSearchRepoResponse = await response.json();

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(data, null, 2),
					},
				],
				_meta: {
					total_count: data.total_count,
					query: q,
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
