import { deflate, inflate } from "pako";
import type { RoutePoint } from "~/lib/graphhopper";

/**
 * Encode route points to a compressed URL-safe string
 * Uses gzip compression + base64 encoding for maximum URL shortening
 */
export function encodeRouteToUrl(points: RoutePoint[]): string {
	try {
		// Convert to JSON string
		const jsonString = JSON.stringify(points);
		// Compress using pako
		const compressed = deflate(jsonString);
		// Convert to base64 for URL safety
		return btoa(String.fromCharCode(...compressed));
	} catch {
		return "";
	}
}

/**
 * Decode a compressed URL string back to route points
 * Handles base64 decoding + gzip decompression
 */
export function decodeRouteFromUrl(encoded: string): RoutePoint[] | null {
	try {
		// Decode from base64
		const compressed = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
		// Decompress using pako
		const decompressed = inflate(compressed, { to: "string" });
		// Parse JSON
		return JSON.parse(decompressed) as RoutePoint[];
	} catch {
		return null;
	}
}
