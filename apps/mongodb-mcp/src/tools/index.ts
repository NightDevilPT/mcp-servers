// apps/mongodb-mcp/src/tools/index.ts

import { AddFieldsTool } from "./data-administration/add-fields";
import { RemoveFieldsTool } from "./data-administration/remove-field";
import { ListCollectionsTool } from "./data-administration/list-collection";
import { ListDatabasesTool } from "./data-administration/list-databases";
import { DropCollectionTool } from "./data-administration/drop-collection";
import { DropDatabasesTool } from "./data-administration/drop-database";
import { DatabaseStatsTool } from "./data-administration/database-stats";
import { CollectionStatsTool } from "./data-administration/collection-stats";
import { CreateDatabaseTool } from "./data-administration/create-database";
import { CreateCollectionTool } from "./data-administration/create-collection";
import { RenameCollectionTool } from "./data-administration/rename-collection";
import { ManageIndexesTool } from "./data-administration/manage-indexes";

export const tools = [
	// DATABASE
	CreateDatabaseTool,
	ListDatabasesTool,
	DatabaseStatsTool,
	DropDatabasesTool,

	// COLLECTION
	CreateCollectionTool,
	DropCollectionTool,
	ListCollectionsTool,
	AddFieldsTool,
	RemoveFieldsTool,
	RenameCollectionTool,
	CollectionStatsTool,
	ManageIndexesTool
];
