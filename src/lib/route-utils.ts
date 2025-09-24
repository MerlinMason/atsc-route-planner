/**
 * Utility functions for route data formatting and manipulation
 */

export const formatDistance = (distanceInMeters: number): string => {
	if (distanceInMeters < 1000) {
		return `${Math.round(distanceInMeters)}m`;
	}
	return `${(distanceInMeters / 1000).toFixed(1)}km`;
};

export const formatElevation = (elevationInMeters: number): string => {
	return `${Math.round(elevationInMeters)}m`;
};

export const formatDate = (date: Date): string => {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(date);
};
