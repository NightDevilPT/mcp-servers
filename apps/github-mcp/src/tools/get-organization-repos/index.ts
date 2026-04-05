import { z } from "zod";
import { IGithubRepository } from "../../types/github-types";

export const GetOrganizationReposTool = {
	name: "get_organization_repositories",
	description: "Retrieve all repositories belonging to a GitHub organization with filtering and sorting options",
	schema: {
		inputSchema: {
			org: z.string().describe("Organization name"),
			type: z
				.enum([
					"all",
					"public",
					"private",
					"forks",
					"sources",
					"member",
				])
				.optional()
				.default("all")
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
		org,
		type,
		sort,
		direction,
		per_page,
		page,
	}: {
		org: string;
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

			const url = `https://api.github.com/orgs/${org}/repos${params.toString() ? `?${params}` : ""}`;
			const response = await fetch(url);

			if (!response.ok) {
				if (response.status === 404) {
					throw new Error(`Organization '${org}' not found`);
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
					organization: org,
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
