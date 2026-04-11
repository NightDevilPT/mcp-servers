// src/tools/index.ts
import { CreateCollectionTool } from "./db-administration/create-collection/index";
import { ListCollectionsTool } from "./db-administration/list-collections/index";
import { DropCollectionTool } from "./db-administration/drop-collection/index";
import { RenameCollectionTool } from "./db-administration/rename-collection/index";
import { CollectionStatsTool } from "./db-administration/collection-stats/index";
import { DropAllCollectionsTool } from "./db-administration/drop_all_collections/index";
import { InsertOneTool } from "./crud/insert-one/index";

export const tools = [
	CreateCollectionTool,
	ListCollectionsTool,
	DropCollectionTool,
	RenameCollectionTool,
	CollectionStatsTool,
	DropAllCollectionsTool,
	InsertOneTool,
];
