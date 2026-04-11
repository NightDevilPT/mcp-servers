import { Db, MongoClient } from "mongodb";

export async function validateDatabaseExists(client: MongoClient, databaseName: string): Promise<boolean> {
	try {
		const dbList = await client.db().admin().listDatabases();
		return dbList.databases.some((d) => d.name === databaseName);
	} catch (error) {
		return false;
	}
}

export async function validateCollectionExists(db: Db, collectionName: string): Promise<boolean> {
	try {
		const collections = await db.listCollections({ name: collectionName }).toArray();
		return collections.length > 0;
	} catch (error) {
		return false;
	}
}

export function validateCollectionName(name: string): { valid: boolean; error?: string } {
	if (!name || name.trim() === "") {
		return { valid: false, error: "Collection name cannot be empty" };
	}

	if (name.includes("$")) {
		return { valid: false, error: "Collection name cannot contain '$'" };
	}

	if (name.includes(".")) {
		return { valid: false, error: "Collection name cannot contain '.'" };
	}

	if (name.length > 255) {
		return { valid: false, error: "Collection name cannot exceed 255 characters" };
	}

	return { valid: true };
}

export function validateDatabaseName(name: string): { valid: boolean; error?: string } {
	if (!name || name.trim() === "") {
		return { valid: false, error: "Database name cannot be empty" };
	}

	if (name.includes("$")) {
		return { valid: false, error: "Database name cannot contain '$'" };
	}

	if (name.includes(".")) {
		return { valid: false, error: "Database name cannot contain '.'" };
	}

	if (name.length > 64) {
		return { valid: false, error: "Database name cannot exceed 64 characters" };
	}

	return { valid: true };
}
