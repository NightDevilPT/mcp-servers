// src/tools/index.ts
import { CreateCollectionTool } from "./create-collection/index.js";
import { ListCollectionsTool } from "./list-collections/index.js";
import { DropCollectionTool } from "./drop-collection/index.js";
import { RenameCollectionTool } from "./rename-collection/index.js";
import { CollectionStatsTool } from "./collection-stats/index.js";

export const tools = [CreateCollectionTool, ListCollectionsTool, DropCollectionTool, RenameCollectionTool, CollectionStatsTool];
