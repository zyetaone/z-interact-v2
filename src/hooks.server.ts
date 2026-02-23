import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// Security headers
	response.headers.set(
		'Content-Security-Policy',
		[
			"default-src 'self'",
			"img-src 'self' https://fal.media https://v3.fal.media https://*.r2.dev https://storage.googleapis.com data: blob:",
			"script-src 'self' 'unsafe-inline'",
			"style-src 'self' 'unsafe-inline'",
			"connect-src 'self' https://queue.fal.run https://fal.run https://*.fal.ai",
			"font-src 'self'",
			"frame-ancestors 'none'",
			"base-uri 'self'"
		].join('; ')
	);

	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

	return response;
};
