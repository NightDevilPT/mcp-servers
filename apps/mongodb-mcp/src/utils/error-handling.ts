export interface ErrorResponse {
	content: Array<{
		type: "text";
		text: string;
	}>;
	isError: true;
	[key: string]: any;
}

export function createMongoDBUriError(): ErrorResponse {
	return {
		content: [
			{
				type: "text" as const,
				text: "Error: MONGODB_URI environment variable is not set",
			},
		],
		isError: true,
	};
}

export function createAuthenticationError(database: string): ErrorResponse {
	return {
		content: [
			{
				type: "text" as const,
				text: `Error: Authentication failed for database '${database}'. Check URI credentials.`,
			},
		],
		isError: true,
	};
}

export function createDatabaseNotFoundError(database: string): ErrorResponse {
	return {
		content: [
			{
				type: "text" as const,
				text: `Error: Database '${database}' not found.`,
			},
		],
		isError: true,
	};
}

export function createCollectionNotFoundError(
	collection: string,
	database: string,
): ErrorResponse {
	return {
		content: [
			{
				type: "text" as const,
				text: `Error: Collection '${collection}' does not exist in database '${database}'`,
			},
		],
		isError: true,
	};
}

export function createCollectionAlreadyExistsError(
	collection: string,
	database: string,
): ErrorResponse {
	return {
		content: [
			{
				type: "text" as const,
				text: `Error: Collection '${collection}' already exists in database '${database}'. Please choose a different collection name.`,
			},
		],
		isError: true,
	};
}

export function createUnauthorizedError(
	operation: string,
	target: string,
): ErrorResponse {
	return {
		content: [
			{
				type: "text" as const,
				text: `Error: Unauthorized to ${operation} '${target}'. Please check your database permissions.`,
			},
		],
		isError: true,
	};
}

export function createGenericError(message: string): ErrorResponse {
	return {
		content: [
			{
				type: "text" as const,
				text: `Error: ${message}`,
			},
		],
		isError: true,
	};
}

export function handleMongoError(
	error: any,
	database?: string,
	collection?: string,
): ErrorResponse | null {
	switch (error.code) {
		case 18:
			return createAuthenticationError(database || "unknown");
		case 26:
			return createDatabaseNotFoundError(database || "unknown");
		case 48:
			return createCollectionAlreadyExistsError(
				collection || "unknown",
				database || "unknown",
			);
		case 13:
			return createUnauthorizedError(
				"access",
				collection || database || "resource",
			);
		default:
			if (error.message?.includes("does not exist")) {
				return createCollectionNotFoundError(
					collection || "unknown",
					database || "unknown",
				);
			}
			return null;
	}
}
