export class MCPError extends Error {
	constructor(
		public message: string,
		public isError: boolean = true,
		public code?: string,
	) {
		super(message);
		this.name = "MCPError";
	}
}

export function validateEnvVar(
	varName: string,
	varValue: string | undefined,
): void {
	if (!varValue) {
		throw new MCPError(
			`Environment variable ${varName} is not set.`,
			true,
			"MISSING_ENV_VAR",
		);
	}
}

export function createSuccessResponse(data: any, message?: string) {
	return {
		content: [
			{ type: "text" as const, text: JSON.stringify(data, null, 2) },
		],
		isError: false,
		_meta: {
			timestamp: new Date().toISOString(),
			message: message || "Success",
		},
	};
}

export function createErrorResponse(message: string, code?: string) {
	return {
		content: [{ type: "text" as const, text: message }],
		isError: true,
		_meta: { code: code || "ERROR", timestamp: new Date().toISOString() },
	};
}
