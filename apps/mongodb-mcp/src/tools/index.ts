// src/tools/index.ts
import { CreateCollectionTool } from "./create-collection/index";
import { ListCollectionsTool } from "./list-collections/index";
import { DropCollectionTool } from "./drop-collection/index";
import { RenameCollectionTool } from "./rename-collection/index";
import { CollectionStatsTool } from "./collection-stats/index";

export const tools = [
	CreateCollectionTool,
	ListCollectionsTool,
	DropCollectionTool,
	RenameCollectionTool,
	CollectionStatsTool,
];
