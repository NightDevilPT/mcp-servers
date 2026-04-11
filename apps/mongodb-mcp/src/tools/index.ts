import { CreateDatabaseTool } from "./data-administration/create-database";
import { ListDatabasesTool } from "./data-administration/list-databases";
import { DropDatabasesTool } from "./data-administration/drop-database";

export const tools = [CreateDatabaseTool, ListDatabasesTool, DropDatabasesTool];
