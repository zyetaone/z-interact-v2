/// <reference types="@sveltejs/kit" />
/// <reference types="@sveltejs/adapter-cloudflare" />

declare namespace App {
	interface Platform {
		env?: {
			DB: D1Database
			R2_IMAGES: R2Bucket
			R2_PUBLIC_URL: string
			FAL_API_KEY: string
		}
	}
}
