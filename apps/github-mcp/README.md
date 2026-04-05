# GitHub MCP Server
GitHub MCP server for interacting with GitHub API.

## What is an MCP Server?

## MCP Info
| Attribute | Details |
|-----------|---------|
| Package Name | github-mcp |
| Author | MCP Practice |
| Repository | https://github.com/NightDevilPT/mcp-servers/tree/main/apps/github-mcp |
| Version | 1.0.0 |
| Node Version | Compatible with Node.js 18+ |
| License | ISC License |

## Available Tools (14)

| Tools provided by this Server | Short Description |
|-------------------------------|-------------------|
| get_user_info | Get GitHub user information by username |
| search_repositories | Search GitHub repositories by query |
| search_users | Search GitHub users by query |
| get_repository | Get detailed information about a specific GitHub repository |
| get_user_repositories | Get repositories for a specific GitHub user |
| get_organization | Get information about a GitHub organization |
| get_organization_repositories | Get repositories for a GitHub organization |
| get_rate_limit | Get current GitHub API rate limit status |
| get_emojis | Get all GitHub emojis |
| get_public_events | Get public GitHub events |
| get_public_gists | Get public GitHub gists |
| search_code | Search code in GitHub repositories |
| search_issues | Search issues and pull requests in GitHub repositories |
| search_commits | Search commits in GitHub repositories |

## Tools Details

### Tool: get_user_info
Get GitHub user information by username

**Parameters** | Type | Description
---|---|---
username | string | The username of the user to get information for (e.g., 'nightdevilpt')

This tool is read-only. It does not modify its environment.

This tool interacts with external entities.

### Tool: search_repositories
Search GitHub repositories by query

**Parameters** | Type | Description
---|---|---
q | string | The search query. Example: 'q=tetris+language:assembly'
sort | string optional | Sort field (stars, forks, help-wanted-issues, updated)
order | string optional | Sort order (desc or asc)
per_page | number optional | Results per page (max 100), default 30
page | number optional | Page number, default 1

This tool is read-only. It does not modify its environment.

This tool interacts with external entities.

### Tool: search_users
Search GitHub users by query

**Parameters** | Type | Description
---|---|---
q | string | The search query. Example: 'q=tom+repos:>42+followers:>1000'
sort | string optional | Sort field (followers, repositories, joined)
order | string optional | Sort order (desc or asc)
per_page | number optional | Results per page (max 100), default 30
page | number optional | Page number, default 1

This tool is read-only. It does not modify its environment.

This tool interacts with external entities.

### Tool: get_repository
Get detailed information about a specific GitHub repository

**Parameters** | Type | Description
---|---|---
owner | string | Repository owner's username
repo | string | Repository name

This tool is read-only. It does not modify its environment.

This tool interacts with external entities.

### Tool: get_user_repositories
Get repositories for a specific GitHub user

**Parameters** | Type | Description
---|---|---
username | string | GitHub username
type | string optional | Repository type (all, owner, member), default owner
sort | string optional | Sort field (created, updated, pushed, full_name), default created
direction | string optional | Sort direction (asc or desc), default desc
per_page | number optional | Results per page (max 100), default 30
page | number optional | Page number, default 1

This tool is read-only. It does not modify its environment.

This tool interacts with external entities.

### Tool: get_organization
Get information about a GitHub organization

**Parameters** | Type | Description
---|---|---
org | string | Organization name

This tool is read-only. It does not modify its environment.

This tool interacts with external entities.

### Tool: get_organization_repositories
Get repositories for a GitHub organization

**Parameters** | Type | Description
---|---|---
org | string | Organization name
type | string optional | Repository type (all, public, private, forks, sources, member), default all
sort | string optional | Sort field (created, updated, pushed, full_name), default created
direction | string optional | Sort direction (asc or desc), default desc
per_page | number optional | Results per page (max 100), default 30
page | number optional | Page number, default 1

This tool is read-only. It does not modify its environment.

This tool interacts with external entities.

### Tool: get_rate_limit
Get current GitHub API rate limit status

This tool is read-only. It does not modify its environment.

This tool interacts with external entities.

### Tool: get_emojis
Get all GitHub emojis

This tool is read-only. It does not modify its environment.

This tool interacts with external entities.

### Tool: get_public_events
Get public GitHub events

**Parameters** | Type | Description
---|---|---
per_page | number optional | Results per page (max 100), default 30
page | number optional | Page number, default 1

This tool is read-only. It does not modify its environment.

This tool interacts with external entities.

### Tool: get_public_gists
Get public GitHub gists

**Parameters** | Type | Description
---|---|---
per_page | number optional | Results per page (max 100), default 30
page | number optional | Page number, default 1

This tool is read-only. It does not modify its environment.

This tool interacts with external entities.

### Tool: search_code
Search code in GitHub repositories

**Parameters** | Type | Description
---|---|---
q | string | Search query. Example: 'q=addClass+repo:jquery/jquery'
sort | string optional | Sort field (indexed)
order | string optional | Sort order (desc or asc)
per_page | number optional | Results per page (max 100), default 30
page | number optional | Page number, default 1

This tool is read-only. It does not modify its environment.

This tool interacts with external entities.

### Tool: search_issues
Search issues and pull requests in GitHub repositories

**Parameters** | Type | Description
---|---|---
q | string | Search query. Example: 'q=windows+label:bug+language:python'
sort | string optional | Sort field (comments, reactions, reactions-+1, reactions--1, reactions-smile, reactions-thinking_face, reactions-heart, reactions-tada, interactions, created, updated)
order | string optional | Sort order (desc or asc)
per_page | number optional | Results per page (max 100), default 30
page | number optional | Page number, default 1

This tool is read-only. It does not modify its environment.

This tool interacts with external entities.

### Tool: search_commits
Search commits in GitHub repositories

**Parameters** | Type | Description
---|---|---
q | string | Search query. Example: 'q=fix+language:python+repo:facebook/react'
sort | string optional | Sort field (committer-date, author-date)
order | string optional | Sort order (desc or asc)
per_page | number optional | Results per page (max 100), default 30
page | number optional | Page number, default 1

This tool is read-only. It does not modify its environment.

This tool interacts with external entities.

## Use this MCP Server

```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": [
        "path/to/github-mcp/dist/server.js"
      ]
    }
  }
}
```

## Installation and Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```
4. Add the server configuration to your MCP client configuration

## Development

- **Build**: `npm run build`
- **Inspect**: `npm run inspect` (uses MCP Inspector for debugging)

## Dependencies

- `@modelcontextprotocol/sdk`: MCP SDK for building MCP servers
- `zod`: TypeScript-first schema validation
- `typescript`: TypeScript compiler

## License

ISC License
