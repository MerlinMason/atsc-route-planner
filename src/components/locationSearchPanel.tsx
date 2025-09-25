"use client";

import {
	ArrowDownUp,
	Flag,
	Info,
	MapPinCheckInside,
	MapPinPlusInside,
	Search,
	X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useLocalStorage } from "react-use";
import { Button } from "~/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/card";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "~/components/command";
import { AppInfoDialog } from "~/components/dialogs/appInfoDialog";
import { Switch } from "~/components/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/tooltip";
import { useMap } from "~/contexts/mapContext";
import { type GeocodeHit, useGeocoding } from "~/hooks/useGeocoding";
import type { RoutePoint } from "~/lib/graphhopper";
import { formatDistance } from "~/lib/route-utils";

type PointType = RoutePoint["type"];

const RECENT_SEARCHES_LIMIT = 5;
const SEARCH_RESULTS_LIMIT = 10;

export const LocationSearchPanel = () => {
	const [searchQuery, setSearchQuery] = useState("");
	const [isCollapsed, setIsCollapsed] = useState(false);
	const [manuallySelectedType, setManuallySelectedType] =
		useState<PointType | null>(null);
	const [isSearchFocused, setIsSearchFocused] = useState(false);

	// Recent searches stored in localStorage
	const [recentSearches, setRecentSearches] = useLocalStorage<GeocodeHit[]>(
		"route-planner-recent-searches",
		[],
	);

	// Save a search result to recent searches (with deduplication)
	const saveToRecentSearches = useCallback(
		(result: GeocodeHit) => {
			// Remove any existing entry with the same name and coordinates
			const filtered = (recentSearches ?? []).filter(
				(search) =>
					!(
						search.name === result.name &&
						search.point.lat === result.point.lat &&
						search.point.lng === result.point.lng
					),
			);

			// Add new search to beginning and limit to n items
			const updated = [result, ...filtered].slice(0, RECENT_SEARCHES_LIMIT);
			setRecentSearches(updated);
		},
		[recentSearches, setRecentSearches],
	);

	const {
		routePoints,
		userLocation,
		handleRemovePoint,
		setPointFromSearch,
		preferOffRoad,
		setPreferOffRoad,
		reverseRoute,
	} = useMap();

	// Smart default point type selection based on current route state
	const defaultPointType = useMemo((): PointType => {
		if (routePoints.length === 0) return "start";
		if (routePoints.length === 1) return "end";
		return "checkpoint";
	}, [routePoints.length]);

	// Use manual selection if available, otherwise use smart default
	const selectedPointType = manuallySelectedType ?? defaultPointType;

	// Stable user location for geocoding
	const stableUserLocation = useMemo(() => {
		const hasUserLocation = userLocation.latitude && userLocation.longitude;
		return hasUserLocation &&
			userLocation.latitude !== null &&
			userLocation.longitude !== null
			? { lat: userLocation.latitude, lng: userLocation.longitude }
			: undefined;
	}, [userLocation.latitude, userLocation.longitude]);

	// Get the route start point for distance filtering
	const routeStartPoint = useMemo(() => {
		const startPoint = routePoints.find((point) => point.type === "start");
		return startPoint
			? { lat: startPoint.lat, lng: startPoint.lng }
			: undefined;
	}, [routePoints]);

	// Use geocoding hook with user location for distance display
	const { search, results, isLoading, error, clearResults } = useGeocoding({
		debounceMs: 300,
		userLocation: stableUserLocation,
		routeStartPoint,
		limit: SEARCH_RESULTS_LIMIT,
	});

	const handleSearchChange = useCallback(
		(value: string) => {
			setSearchQuery(value);
			search(value);
		},
		[search],
	);

	const handleClearSearch = useCallback(() => {
		setSearchQuery("");
		clearResults();
	}, [clearResults]);

	const handleSelectResult = useCallback(
		(result: GeocodeHit) => {
			setPointFromSearch(result.point, selectedPointType, result.name);
			saveToRecentSearches(result);
			handleClearSearch();
		},
		[
			selectedPointType,
			setPointFromSearch,
			saveToRecentSearches,
			handleClearSearch,
		],
	);

	const pointTypeOptions = [
		{ value: "start" as const, label: "Start", icon: Flag },
		{
			value: "checkpoint" as const,
			label: "Checkpoint",
			icon: MapPinPlusInside,
		},
		{ value: "end" as const, label: "End", icon: MapPinCheckInside },
	];

	if (isCollapsed) {
		return (
			<Button
				variant="outline"
				size="icon"
				onClick={() => setIsCollapsed(false)}
				className="fixed top-4 left-4 z-50 size-12 rounded-lg border border-background bg-background/50 shadow-lg backdrop-blur-sm"
			>
				<Search size={20} />
			</Button>
		);
	}

	return (
		<Card className="fixed top-4 left-4 z-50 max-h-[calc(100dvh-300px)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto border border-background bg-background/60 shadow-lg backdrop-blur-sm">
			<CardHeader>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-1">
						<CardTitle>ATSC Route Planner</CardTitle>
						<Tooltip>
							<TooltipTrigger asChild>
								<AppInfoDialog>
									<Button variant="ghost" size="icon" icon={Info} />
								</AppInfoDialog>
							</TooltipTrigger>
							<TooltipContent side="bottom">About this app</TooltipContent>
						</Tooltip>
					</div>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setIsCollapsed(true)}
						icon={X}
					/>
				</div>
			</CardHeader>

			<CardContent>
				{/* Point Type Selector */}

				<div className="mb-2 font-medium text-sm">Add</div>
				<div className="mb-4 flex gap-1">
					{pointTypeOptions.map(({ value, label, icon: Icon }) => (
						<Button
							key={value}
							variant={selectedPointType === value ? "default" : "outline"}
							size="sm"
							onClick={() => setManuallySelectedType(value)}
							className="flex-1"
							icon={Icon}
						>
							{label}
						</Button>
					))}
				</div>

				{/* Search Command */}

				<Command className="relative" shouldFilter={false} loop>
					<CommandInput
						placeholder="Waltham Forest Town Hall..."
						value={searchQuery}
						onValueChange={handleSearchChange}
						onFocus={() => setIsSearchFocused(true)}
						onBlur={() => setTimeout(() => setIsSearchFocused(false), 100)}
					/>

					{(searchQuery || (isSearchFocused && !searchQuery)) && (
						<CommandList>
							{searchQuery ? (
								// Show search results when typing
								<>
									<CommandEmpty className="px-2 py-1 text-left text-sm">
										{isLoading
											? "Searching..."
											: error
												? error
												: "No locations found"}
									</CommandEmpty>

									{results.length > 0 && (
										<CommandGroup>
											{results.map((result, index) => (
												<SearchResult
													key={`${result.point.lat}-${result.point.lng}-${index}-${searchQuery}`}
													result={result}
													onSelect={() => handleSelectResult(result)}
													showDistance={true}
												/>
											))}
										</CommandGroup>
									)}
								</>
							) : (
								// Show recent searches when focused but no query
								<>
									{recentSearches && recentSearches.length > 0 ? (
										<CommandGroup heading="Recent searches">
											{recentSearches.map((recent, index) => (
												<SearchResult
													key={`recent-${recent.point.lat}-${recent.point.lng}-${index}`}
													result={recent}
													onSelect={() => handleSelectResult(recent)}
													showDistance={false}
												/>
											))}
										</CommandGroup>
									) : (
										<CommandEmpty className="px-2 py-1 text-left text-sm">
											Start typing to search for locations...
										</CommandEmpty>
									)}
								</>
							)}
						</CommandList>
					)}
				</Command>

				<div className="space-y-6 pt-6">
					{/* Vehicle Preference Switch */}
					<label
						htmlFor="prefer-off-road"
						className="flex cursor-pointer items-center justify-between font-medium text-sm"
					>
						Prefer off-road
						<Switch
							id="prefer-off-road"
							checked={preferOffRoad}
							onCheckedChange={setPreferOffRoad}
						/>
					</label>

					{/* Current Route Points */}
					{routePoints.length > 0 && (
						<>
							<div className="mb-2 flex items-center justify-between">
								<div className="font-medium text-sm">Current route</div>
								{routePoints.length >= 2 && (
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												onClick={reverseRoute}
												className="h-7 w-7"
											>
												<ArrowDownUp size={14} />
											</Button>
										</TooltipTrigger>
										<TooltipContent side="bottom">Reverse route</TooltipContent>
									</Tooltip>
								)}
							</div>

							<div className="space-y-1">
								{routePoints
									.filter((point) => point.type !== "waypoint")
									.map((point) => {
										// Find the original index in the full routePoints array
										const originalIndex = routePoints.findIndex(
											(p) =>
												p.lat === point.lat &&
												p.lng === point.lng &&
												p.type === point.type,
										);

										return (
											<div
												key={`${point.type}-${originalIndex}`}
												className="flex items-center gap-2 rounded-md bg-accent/60 px-2 py-1"
											>
												{point.type === "start" && <Flag size={14} />}
												{point.type === "end" && (
													<MapPinCheckInside size={14} />
												)}
												{point.type === "checkpoint" && (
													<MapPinPlusInside size={14} />
												)}

												<div className="flex-grow truncate font-medium text-sm">
													{point.name ||
														`${point.type.charAt(0).toUpperCase() + point.type.slice(1)}`}
												</div>

												<Button
													variant="ghost"
													size="icon"
													onClick={() => handleRemovePoint(originalIndex)}
													className="h-6 w-6 text-muted-foreground hover:text-destructive"
												>
													<X size={12} />
												</Button>
											</div>
										);
									})}
							</div>
						</>
					)}
				</div>
			</CardContent>
		</Card>
	);
};

type SearchResultProps = {
	result: GeocodeHit;
	onSelect: () => void;
	showDistance: boolean;
};

const SearchResult = ({
	result,
	onSelect,
	showDistance,
}: SearchResultProps) => {
	return (
		<CommandItem
			value={`${result.name} ${result.city || ""} ${result.state || ""}`}
			onSelect={onSelect}
			className="cursor-pointer"
		>
			<div className="flex flex-col">
				<div className="font-medium text-sm">{result.name}</div>
				{(result.city || result.state || result.country) && (
					<div className="text-muted-foreground text-xs">
						{[result.city, result.state].filter(Boolean).join(", ")}
						{showDistance && result.distanceToUser && (
							<span className="ml-2">
								({formatDistance(result.distanceToUser)})
							</span>
						)}
					</div>
				)}
			</div>
		</CommandItem>
	);
};
