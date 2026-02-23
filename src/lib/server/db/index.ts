import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from './schema';

export type DbClient = BaseSQLiteDatabase<'async', unknown, typeof schema>;

const d1Cache = new WeakMap<object, ReturnType<typeof drizzleD1>>();
let libsqlInstance: ReturnType<typeof drizzleLibsql> | null = null;

export function getDb(platform?: App.Platform): DbClient {
	// Cloudflare Workers — D1
	if (platform?.env?.DB) {
		const d1 = platform.env.DB;
		let cached = d1Cache.get(d1);
		if (!cached) {
			cached = drizzleD1(d1, { schema });
			d1Cache.set(d1, cached);
		}
		return cached as unknown as DbClient;
	}

	// Local dev — libSQL
	const url = process.env.DATABASE_URL;
	if (!url) throw new Error('No database. Set DATABASE_URL or deploy to Cloudflare.');
	if (!libsqlInstance) {
		libsqlInstance = drizzleLibsql(createClient({ url }), { schema });
	}
	return libsqlInstance as unknown as DbClient;
}
