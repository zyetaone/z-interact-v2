import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export const POST: RequestHandler = async ({ request, platform, url }) => {
	const r2 = platform?.env?.R2_IMAGES;
	const publicUrl = platform?.env?.R2_PUBLIC_URL;
	if (!r2 || !publicUrl) error(500, 'R2 not configured');

	const formData = await request.formData();
	const file = formData.get('image');

	if (!(file instanceof File)) {
		error(400, 'No image file provided');
	}

	if (!ALLOWED_TYPES.includes(file.type)) {
		error(400, `Invalid file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(', ')}`);
	}

	if (file.size > MAX_SIZE) {
		error(400, `File too large. Maximum: ${MAX_SIZE / 1024 / 1024}MB`);
	}

	const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
	const rawExt =
		file.name
			.split('.')
			.pop()
			?.toLowerCase()
			.replace(/[^a-z0-9]/g, '') ?? 'png';
	const ext = ALLOWED_EXTENSIONS.includes(rawExt) ? rawExt : 'png';
	const filename = `${crypto.randomUUID()}.${ext}`;

	const buffer = await file.arrayBuffer();
	await r2.put(filename, buffer, {
		httpMetadata: { contentType: file.type }
	});

	// Local dev: serve via R2 proxy route. Production: use public R2 URL.
	const isLocal = url.hostname === 'localhost';
	const baseUrl = isLocal ? '/api/r2' : publicUrl;

	return json({ url: `${baseUrl}/${filename}` });
};
