import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ cookies }) => {
	cookies.delete('session_id', { path: '/' });
	return new Response(null, { status: 204 });
};
