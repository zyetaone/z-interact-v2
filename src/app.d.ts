interface D1Database {
	prepare(query: string): D1PreparedStatement;
	dump(): Promise<ArrayBuffer>;
	batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
	exec(query: string): Promise<D1ExecResult>;
}
interface D1PreparedStatement {
	bind(...values: unknown[]): D1PreparedStatement;
	first<T = unknown>(colName?: string): Promise<T | null>;
	run<T = unknown>(): Promise<D1Result<T>>;
	all<T = unknown>(): Promise<D1Result<T>>;
	raw<T = unknown>(): Promise<T[]>;
}
interface D1Result<T = unknown> {
	results?: T[];
	success: boolean;
	error?: string;
	meta: object;
}
interface D1ExecResult {
	count: number;
	duration: number;
}

interface R2Bucket {
	put(
		key: string,
		value: ArrayBuffer | ReadableStream | string,
		options?: R2PutOptions
	): Promise<R2Object>;
	get(key: string): Promise<R2ObjectBody | null>;
	delete(key: string | string[]): Promise<void>;
	list(options?: R2ListOptions): Promise<R2Objects>;
	head(key: string): Promise<R2Object | null>;
}
interface R2PutOptions {
	httpMetadata?: { contentType?: string; cacheControl?: string };
}
interface R2Object {
	key: string;
	size: number;
	etag: string;
}
interface R2ObjectBody extends R2Object {
	body: ReadableStream;
	arrayBuffer(): Promise<ArrayBuffer>;
	httpMetadata?: { contentType?: string; cacheControl?: string };
}
interface R2ListOptions {
	prefix?: string;
	limit?: number;
	cursor?: string;
}
interface R2Objects {
	objects: R2Object[];
	truncated: boolean;
	cursor?: string;
}

interface AiOptions {
	gateway?: { id: string; skipCache?: boolean; cacheTtl?: number };
	returnRawResponse?: boolean;
	[key: string]: unknown;
}
interface Ai {
	run(model: string, inputs: Record<string, unknown>, options?: AiOptions): Promise<unknown>;
	gateway(gatewayId: string): unknown;
}

interface Env {
	DB: D1Database;
	R2_IMAGES: R2Bucket;
	R2_PUBLIC_URL: string;
	FAL_API_KEY: string;
	ENVIRONMENT: string;
	AI?: Ai;
	CLOUDFLARE_ACCOUNT_ID?: string;
	CLOUDFLARE_AI_GATEWAY_ID?: string;
	CLOUDFLARE_AIG_TOKEN?: string;
	SEED_SECRET?: string;
	CLEANUP_SECRET?: string;
}

declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}
	}
}
export {};
