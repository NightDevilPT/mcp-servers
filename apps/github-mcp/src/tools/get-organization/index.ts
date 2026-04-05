import { z } from "zod";
import { IGithubOrganization } from "../../types/github-types";

export const GetOrganizationTool = {
	name: "get_organization",
	description: "Get comprehensive organization information including profile, member count, and statistics",
	schema: {
		inputSchema: {
			org: z.string().describe("Organization name"),
		},
	},
	execute: async ({ org }: { org: string }) => {
		try {
			const response = await fetch(`https://api.github.com/orgs/${org}`);

			if (!response.ok) {
				if (response.status === 404) {
					throw new Error(`Organization '${org}' not found`);
				}
				throw new Error(
					`GitHub API error: ${response.status} ${response.statusText}`,
				);
			}

			const data: IGithubOrganization = await response.json();

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(data, null, 2),
					},
				],
				_meta: {
					organization: data.login,
					public_repos: data.public_repos,
					members: data.followers,
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
