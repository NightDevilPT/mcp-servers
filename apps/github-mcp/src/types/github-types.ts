// Repository types
export interface IGithubRepository {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  private: boolean;
  owner: IGithubUserInfo;
  html_url: string;
  description: string | null;
  fork: boolean;
  url: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  homepage: string | null;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  forks_count: number;
  open_issues_count: number;
  master_branch?: string;
  default_branch: string;
  license: IGithubLicense | null;
  topics: string[];
  visibility: string;
  forks: number;
  open_issues: number;
  watchers: number;
}

export interface IGithubLicense {
  key: string;
  name: string;
  spdx_id: string;
  url: string;
  node_id: string;
}

// Search types
export interface IGithubSearchResponse<T> {
  total_count: number;
  incomplete_results: boolean;
  items: T[];
}

export interface IGithubSearchRepoResponse extends IGithubSearchResponse<IGithubRepository> {}

export interface IGithubSearchUserResponse extends IGithubSearchResponse<IGithubUserInfo> {}

export interface IGithubSearchCodeResponse extends IGithubSearchResponse<IGithubCodeItem> {}

export interface IGithubSearchIssuesResponse extends IGithubSearchResponse<IGithubIssue> {}

export interface IGithubSearchCommitsResponse extends IGithubSearchResponse<IGithubCommit> {}

// Code search item
export interface IGithubCodeItem {
  name: string;
  path: string;
  sha: string;
  url: string;
  git_url: string;
  html_url: string;
  repository: IGithubRepository;
  score: number;
}

// Issue types
export interface IGithubIssue {
  id: number;
  node_id: string;
  url: string;
  repository_url: string;
  labels_url: string;
  comments_url: string;
  events_url: string;
  html_url: string;
  number: number;
  state: string;
  title: string;
  body: string | null;
  user: IGithubUserInfo;
  labels: IGithubLabel[];
  assignee: IGithubUserInfo | null;
  assignees: IGithubUserInfo[];
  milestone: IGithubMilestone | null;
  locked: boolean;
  active_lock_reason: string | null;
  comments: number;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  closed_by: IGithubUserInfo | null;
  author_association: string;
}

export interface IGithubLabel {
  id: number;
  node_id: string;
  url: string;
  name: string;
  description: string | null;
  color: string;
  default: boolean;
}

export interface IGithubMilestone {
  url: string;
  html_url: string;
  labels_url: string;
  id: number;
  node_id: string;
  number: number;
  state: string;
  title: string;
  description: string | null;
  creator: IGithubUserInfo;
  open_issues: number;
  closed_issues: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  due_on: string | null;
}

// Commit types
export interface IGithubCommit {
  url: string;
  sha: string;
  node_id: string;
  html_url: string;
  comments_url: string;
  commit: {
    url: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
    comment_count: number;
    tree: {
      sha: string;
      url: string;
    };
  };
  author: IGithubUserInfo | null;
  committer: IGithubUserInfo | null;
  parents: {
    url: string;
    sha: string;
  }[];
}

// Organization types
export interface IGithubOrganization {
  login: string;
  id: number;
  node_id: string;
  url: string;
  repos_url: string;
  events_url: string;
  hooks_url: string;
  issues_url: string;
  members_url: string;
  public_members_url: string;
  avatar_url: string;
  description: string | null;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  twitter_username: string | null;
  is_verified: boolean;
  has_organization_projects: boolean;
  has_repository_projects: boolean;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  html_url: string;
  created_at: string;
  updated_at: string;
  type: string;
}

// Event types
export interface IGithubEvent {
  id: string;
  type: string;
  actor: {
    id: number;
    login: string;
    display_login: string;
    gravatar_id: string;
    url: string;
    avatar_url: string;
  };
  repo: {
    id: number;
    name: string;
    url: string;
  };
  payload: any;
  public: boolean;
  created_at: string;
  org?: {
    id: number;
    login: string;
    gravatar_id: string;
    url: string;
    avatar_url: string;
  };
}

// Rate limit types
export interface IGithubRateLimit {
  resources: {
    core: IGithubRateLimitResource;
    search: IGithubRateLimitResource;
    graphql: IGithubRateLimitResource;
    integration_manifest: IGithubRateLimitResource;
  };
  rate: IGithubRateLimitResource;
}

export interface IGithubRateLimitResource {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}

// Gist types
export interface IGithubGist {
  url: string;
  forks_url: string;
  commits_url: string;
  id: string;
  node_id: string;
  git_pull_url: string;
  git_push_url: string;
  html_url: string;
  files: Record<string, {
    filename: string;
    type: string;
    language: string;
    raw_url: string;
    size: number;
    content?: string;
  }>;
  public: boolean;
  created_at: string;
  updated_at: string;
  description: string | null;
  comments: number;
  user: IGithubUserInfo | null;
  comments_url: string;
  owner: IGithubUserInfo;
  forks: any[];
  history: any[];
  truncated: boolean;
}

// Emoji types
export interface IGithubEmojis {
  [key: string]: string;
}

// Extend existing user info
export interface IGithubUserInfo {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  user_view_type: string;
  site_admin: boolean;
  name: string | null;
  company: string | null;
  blog: string;
  location: string | null;
  email: string | null;
  hireable: boolean | null;
  bio: string | null;
  twitter_username: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}