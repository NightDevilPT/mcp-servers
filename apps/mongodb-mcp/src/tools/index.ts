import { ListCollectionsTool } from "./data-administration/list-collection";
import { ListDatabasesTool } from "./data-administration/list-databases";
import { DropCollectionTool } from "./data-administration/drop-collection";
import { DropDatabasesTool } from "./data-administration/drop-database";
import { CreateDatabaseTool } from "./data-administration/create-database";
import { CreateCollectionTool } from "./data-administration/create-collection";
import { AddFieldsTool } from "./data-administration/add-fields";
import { RemoveFieldsTool } from "./data-administration/remove-field";

export const tools = [
	CreateDatabaseTool,
	ListDatabasesTool,
	DropDatabasesTool,
	CreateCollectionTool,
	DropCollectionTool,
	ListCollectionsTool,
	AddFieldsTool,
	RemoveFieldsTool,
];
