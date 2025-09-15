export type LatLngPoint = {
	lat: number;
	lng: number;
};

/**
 * Calculate the distance from a point to a line segment
 * Uses simple Euclidean distance calculation
 */
export const calculateDistanceToSegment = (
	point: LatLngPoint,
	segmentStart: LatLngPoint,
	segmentEnd: LatLngPoint,
): number => {
	const dx = segmentEnd.lng - segmentStart.lng;
	const dy = segmentEnd.lat - segmentStart.lat;

	if (dx === 0 && dy === 0) {
		// Segment is a point
		const pointDx = point.lng - segmentStart.lng;
		const pointDy = point.lat - segmentStart.lat;
		return Math.sqrt(pointDx * pointDx + pointDy * pointDy);
	}

	// Calculate the projection of the point onto the line segment
	const t = Math.max(
		0,
		Math.min(
			1,
			((point.lng - segmentStart.lng) * dx +
				(point.lat - segmentStart.lat) * dy) /
				(dx * dx + dy * dy),
		),
	);

	const projectionX = segmentStart.lng + t * dx;
	const projectionY = segmentStart.lat + t * dy;

	const distX = point.lng - projectionX;
	const distY = point.lat - projectionY;

	return Math.sqrt(distX * distX + distY * distY);
};
