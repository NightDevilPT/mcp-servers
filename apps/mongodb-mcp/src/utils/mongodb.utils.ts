// apps/mongodb-mcp/src/utils/mongodb.utils.ts

import { MongoClient, ClientSession } from "mongodb";
import { MCPError, validateEnvVar } from "./mcp-error.utils";

export class MongoDBUtils {
	private static client: MongoClient | null = null;
	private static session: ClientSession | null = null;

	static getMongoURI(): string {
		const uri = process.env.MONGODB_URI;
		validateEnvVar("MONGODB_URI", uri);
		return uri!;
	}

	static async getClient(): Promise<MongoClient> {
		if (this.client) {
			return this.client;
		}

		try {
			this.client = new MongoClient(this.getMongoURI());
			await this.client.connect();
			return this.client;
		} catch (error) {
			throw new MCPError(
				`MongoDB connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				true,
				"MONGODB_CONNECTION_FAILED",
			);
		}
	}

	static async testConnection(): Promise<boolean> {
		try {
			const client = await this.getClient();
			await client.db().admin().ping();
			return true;
		} catch (error) {
			throw new MCPError(
				`Connection test failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				true,
				"CONNECTION_TEST_FAILED",
			);
		}
	}

	static async closeConnection(): Promise<void> {
		if (this.session) {
			await this.session.endSession();
			this.session = null;
		}
		if (this.client) {
			await this.client.close();
			this.client = null;
		}
	}

	// Check if replica set is available for transactions
	static async isReplicaSetAvailable(): Promise<boolean> {
		try {
			const client = await this.getClient();
			const admin = client.db().admin();
			const buildInfo = await admin.buildInfo();

			// Check if it's a replica set member
			const isReplicaSet = buildInfo.version && buildInfo.gitVersion;

			// Try to start a session to see if transactions are supported
			const session = client.startSession();
			await session.endSession();
			return true;
		} catch (error) {
			return false;
		}
	}

	// Execute operation with transaction support
	static async withTransaction<T>(
		operation: (session: ClientSession) => Promise<T>,
		options?: {
			useTransaction?: boolean;
			retryCount?: number;
		},
	): Promise<T> {
		const useTransaction = options?.useTransaction !== false;
		const retryCount = options?.retryCount || 3;

		if (!useTransaction) {
			// No transaction, just execute operation
			return await operation(null as any);
		}

		// Check if transactions are supported
		const canUseTransactions = await this.isReplicaSetAvailable();

		if (!canUseTransactions) {
			// Transactions not supported (standalone MongoDB), execute without transaction
			console.error(
				"Warning: Transactions not supported (standalone MongoDB). Operation will run without transaction.",
			);
			return await operation(null as any);
		}

		const client = await this.getClient();
		let session: ClientSession | null = null;
		let retries = 0;

		while (retries < retryCount) {
			try {
				session = client.startSession();
				let result: T;

				// Execute with transaction
				await session.withTransaction(async (session) => {
					result = await operation(session);
				});

				await session.endSession();
				return result!;
			} catch (error) {
				if (session) {
					await session.endSession();
				}

				// Check if error is retryable
				if (this.isRetryableError(error) && retries < retryCount - 1) {
					retries++;
					await this.delay(100 * Math.pow(2, retries)); // Exponential backoff
					continue;
				}

				throw new MCPError(
					`Transaction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
					true,
					"TRANSACTION_FAILED",
				);
			}
		}

		throw new MCPError(
			`Transaction failed after ${retryCount} retries`,
			true,
			"TRANSACTION_FAILED",
		);
	}

	// Execute multiple operations in a single transaction
	static async withTransactionBatch<T>(
		operations: Array<(session: ClientSession) => Promise<T>>,
		options?: {
			stopOnError?: boolean;
			retryCount?: number;
		},
	): Promise<T[]> {
		const stopOnError = options?.stopOnError !== false;
		const retryCount = options?.retryCount || 3;

		return await this.withTransaction(
			async (session) => {
				const results: T[] = [];

				for (let i = 0; i < operations.length; i++) {
					try {
						const result = await operations[i](session);
						results.push(result);
					} catch (error) {
						if (stopOnError) {
							throw error;
						}
						// If not stopping on error, push null and continue
						results.push(null as any);
					}
				}

				return results;
			},
			{ retryCount },
		);
	}

	// Start a manual transaction (advanced use cases)
	static async startTransaction(): Promise<ClientSession> {
		const client = await this.getClient();

		if (!(await this.isReplicaSetAvailable())) {
			throw new MCPError(
				"Transactions require a MongoDB replica set. Current connection is standalone.",
				true,
				"TRANSACTIONS_NOT_SUPPORTED",
			);
		}

		const session = client.startSession();
		session.startTransaction();
		this.session = session;
		return session;
	}

	// Commit manual transaction
	static async commitTransaction(): Promise<void> {
		if (!this.session) {
			throw new MCPError(
				"No active transaction to commit",
				true,
				"NO_ACTIVE_TRANSACTION",
			);
		}

		await this.session.commitTransaction();
		await this.session.endSession();
		this.session = null;
	}

	// Abort manual transaction
	static async abortTransaction(): Promise<void> {
		if (!this.session) {
			throw new MCPError(
				"No active transaction to abort",
				true,
				"NO_ACTIVE_TRANSACTION",
			);
		}

		await this.session.abortTransaction();
		await this.session.endSession();
		this.session = null;
	}

	// Helper to check if error is retryable
	private static isRetryableError(error: any): boolean {
		const retryableErrors = [
			"UnknownTransactionCommitResult",
			"TransientTransactionError",
			"NetworkTimeout",
			"ConnectionClosed",
			"InterruptedDueToReplStateChange",
		];

		const errorMessage = error?.message || "";
		return retryableErrors.some((err) => errorMessage.includes(err));
	}

	// Helper for delay
	private static delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
