import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import * as schema from './schema'

export type DbClient = BaseSQLiteDatabase<'async', unknown, typeof schema>

const d1Cache = new WeakMap<object, ReturnType<typeof drizzleD1>>()

/** Pre-initialized local dev DB instance. Set via setLocalDb(). */
let localDbInstance: DbClient | null = null

/**
 * Set the local development DB instance.
 * Call this once at app startup (e.g., in hooks.server.ts) for local dev.
 * Production uses D1 via platform.env.DB — no local DB needed.
 */
export function setLocalDb(db: DbClient) {
	localDbInstance = db
}

export function getDb(platform?: App.Platform): DbClient {
	// Cloudflare Workers — D1
	if (platform?.env?.DB) {
		const d1 = platform.env.DB
		let cached = d1Cache.get(d1)
		if (!cached) {
			cached = drizzleD1(d1, { schema })
			d1Cache.set(d1, cached)
		}
		return cached as unknown as DbClient
	}

	// Local dev — pre-initialized libSQL
	if (localDbInstance) return localDbInstance

	throw new Error(
		'No database available. In production, ensure platform.env.DB is set. ' +
		'For local dev, call setLocalDb() in hooks.server.ts.'
	)
}
