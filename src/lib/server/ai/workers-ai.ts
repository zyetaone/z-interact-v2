import { getRequestEvent } from '$app/server';

type WorkersAI = NonNullable<App.Platform['env']['AI']>;

/**
 * Get the Workers AI binding from the current request's platform env.
 * Returns null when the binding is not configured (e.g. local dev without wrangler).
 */
export function getWorkersAI(): WorkersAI | null {
	const platform = getRequestEvent()?.platform;
	return platform?.env?.AI ?? null;
}
