import { CreateDatabaseTool } from "./data-administration/create-database";
import { CreateCollectionTool } from "./data-administration/create-collection";
import { DropDatabasesTool } from "./data-administration/drop-database";
import { DropCollectionTool } from "./data-administration/drop-collection";
import { ListDatabasesTool } from "./data-administration/list-databases";
import { ListCollectionsTool } from "./data-administration/list-collection";
import { UpdateCollectionTool } from "./data-administration/update-collection";
import { UpdateDatabaseTool } from "./data-administration/update-database";

export const tools = [
	CreateDatabaseTool,
	ListDatabasesTool,
	UpdateDatabaseTool,
	DropDatabasesTool,
	CreateCollectionTool,
	DropCollectionTool,
	ListCollectionsTool,
	UpdateCollectionTool,
];
