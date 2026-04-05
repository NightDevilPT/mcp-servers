
import { SearchRepositoriesTool } from "./search-repositories/index";
import { SearchUsersTool } from "./search-users/index";
import { GetRepositoryTool } from "./get-repository/index";
import { GetUserReposTool } from "./get-user-repos/index";
import { GetOrganizationTool } from "./get-organization/index";
import { GetOrganizationReposTool } from "./get-organization-repos/index";
import { GetRateLimitTool } from "./get-rate-limit/index";
import { GetEmojisTool } from "./get-emojis/index";
import { GetEventsTool } from "./get-events/index";
import { GetPublicGistsTool } from "./get-public-gists/index";
import { SearchCodeTool } from "./search-code/index";
import { SearchIssuesTool } from "./search-issues/index";
import { SearchCommitsTool } from "./search-commits/index";
import { GetUserInfoTool } from "./get-user";

// Export all tools as an array
export const tools = [
	GetUserInfoTool,
	SearchRepositoriesTool,
	SearchUsersTool,
	GetRepositoryTool,
	GetUserReposTool,
	GetOrganizationTool,
	GetOrganizationReposTool,
	GetRateLimitTool,
	GetEmojisTool,
	GetEventsTool,
	GetPublicGistsTool,
	SearchCodeTool,
	SearchIssuesTool,
	SearchCommitsTool,
];
