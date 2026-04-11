export interface SuccessResponse {
	content: Array<{
		type: "text";
		text: string;
	}>;
	_meta?: {
		timestamp: string;
		[key: string]: any;
	};
	[key: string]: any;
}

export function createSuccessResponse(
	message: string,
	additionalData?: any,
	metaData?: any
): SuccessResponse {
	const responseData = {
		success: true,
		message,
		...additionalData,
	};

	return {
		content: [
			{
				type: "text" as const,
				text: JSON.stringify(responseData, null, 2),
			},
		],
		_meta: {
			timestamp: new Date().toISOString(),
			...metaData,
		},
	};
}

export function createCollectionResponse(
	database: string,
	collection: string,
	message: string,
	additionalData?: any
): SuccessResponse {
	return createSuccessResponse(
		message,
		{
			database,
			collection,
			...additionalData,
		},
		{
			database,
			collection,
		}
	);
}

export function createDatabaseResponse(
	database: string,
	message: string,
	additionalData?: any
): SuccessResponse {
	return createSuccessResponse(
		message,
		{
			database,
			...additionalData,
		},
		{
			database,
		}
	);
}

export function createListResponse<T>(
	database: string,
	items: T[],
	itemType: string,
	message?: string
): SuccessResponse {
	const defaultMessage = `Found ${items.length} ${itemType} in database '${database}'`;
	
	return createSuccessResponse(
		message || defaultMessage,
		{
			database,
			[itemType]: items,
			[`total${itemType.charAt(0).toUpperCase() + itemType.slice(1)}`]: items.length,
		},
		{
			database,
			[`${itemType}Count`]: items.length,
		}
	);
}
