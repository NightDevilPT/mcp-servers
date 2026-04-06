Here's a rephrased version of your text:

---

**Create a comprehensive document specifying the required tool definitions for the MongoDB MCP.**

**MongoDB MCP Server – Tasks & Design Considerations**

Based on your concept for the MongoDB MCP and the provided guidelines, the following outlines what can be developed, along with key points requiring discussion or modification prior to implementation.

## 1. Capabilities of a MongoDB MCP Server

The server can provide tools for performing actions and resources for exposing data. Typical MongoDB operations include:

### 🔧 Tools (Actions)

| Category | Example Tools |
|----------|----------------|
| **CRUD** | `insert_one`, `insert_many`, `find_one`, `find_many`, `update_one`, `update_many`, `replace_one`, `delete_one`, `delete_many` |
| **Aggregation** | `aggregate` (with pipeline passed as a JSON string) |
| **Index management** | `create_index`, `drop_index`, `list_indexes` |
| **Database administration** | `list_collections`, `create_collection`, `drop_collection`, `rename_collection`, `collection_stats` |
| **Bulk operations** | `bulk_write` |
| **Session / transactions** (if replica set enabled) | `start_transaction`, `commit_transaction`, `abort_transaction` |