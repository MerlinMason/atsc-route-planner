# Floating Location Search Panel - Feature Tickets

## Feature Summary

Add a floating left panel that provides location search functionality with landmark support. Users can search for named locations (e.g., "Wolfenstow Town Hall") and place them as start points, end points, or named landmarks along their route. This complements the existing map-click functionality and provides a more accessible way to plan routes using known locations.

## User Stories

### Primary User Stories
- **As a route planner**, I want to search for a specific location by name so that I can easily set my start or end point without having to know the exact coordinates
- **As a route planner**, I want to add named landmarks to my route (like "Town Hall", "Pub", "Viewpoint") so that I can plan routes that visit specific points of interest
- **As a route planner**, I want to see a list of my current route points in the search panel so that I can easily manage and modify my route

### Secondary User Stories
- **As a route sharer**, I want landmark names to be preserved in shared route URLs so that others can see the intended points of interest
- **As a route planner**, I want to be able to insert landmarks between existing points so that I can add interesting stops to an existing route
- **As a user with accessibility needs**, I want to use keyboard navigation in the search interface so that I can operate the application without relying solely on mouse interactions

## Implementation Tickets

### Phase 1: Foundation & Type System

#### Ticket 1: Extend RoutePoint Type System ✅ COMPLETED
**Priority:** High
**Estimate:** 2 hours
**Status:** ✅ COMPLETED
**Description:** Extend the RoutePoint type to support landmarks with names
- [x] Update RoutePoint type in `src/components/routePoints.tsx` to include `name?: string` property
- [x] Add new `landmark` type to the type union: `"start" | "waypoint" | "end" | "landmark"`
- [x] Create LandmarkPoint utility type for type safety
- [x] Update all existing RoutePoint usage to handle optional name property

#### Ticket 2: Update GraphHopper Schema
**Priority:** High
**Estimate:** 1 hour
**Status:** TODO
**Description:** Update GraphHopper schemas to support landmark data
- [ ] Modify RoutePointSchema in `src/lib/graphhopper.ts` to include optional name field
- [ ] Update CalculateRouteSchema to handle landmark points
- [ ] Ensure backward compatibility with existing route data
- [ ] Update TypeScript types for API responses

### Phase 2: Core Components

#### Ticket 3: Create useGeocoding Hook
**Priority:** High
**Estimate:** 3 hours
**Status:** TODO
**Description:** Create a custom hook for debounced geocoding with search functionality
- [ ] Create `src/hooks/useGeocoding.ts` with debounced search
- [ ] Integrate with existing tRPC geocoding endpoint
- [ ] Add result caching for performance
- [ ] Implement legacy relevance sorting algorithm from archive code
- [ ] Handle loading and error states

#### Ticket 4: Create LocationSearchPanel Component
**Priority:** High
**Estimate:** 4 hours
**Status:** TODO
**Description:** Build the main floating panel component
- [ ] Create `src/components/locationSearchPanel.tsx`
- [ ] Implement search input with autocomplete dropdown
- [ ] Add point type selector (Start/End/Landmark)
- [ ] Create current route points list display
- [ ] Add basic responsive styling
- [ ] Integrate with useGeocoding hook

#### Ticket 5: Implement Landmark Icon System
**Priority:** Medium
**Estimate:** 2 hours
**Status:** TODO
**Description:** Extend the map icon system to support landmark markers
- [ ] Update `src/hooks/useMapIcons.ts` to create landmark icons
- [ ] Design landmark icon with place pin styling (different from waypoint)
- [ ] Add icon with landmark name labels
- [ ] Ensure visual distinction from existing waypoint markers

### Phase 3: Map Integration

#### Ticket 6: Add Landmark Support to RoutePoints Component
**Priority:** High
**Estimate:** 3 hours
**Status:** TODO
**Description:** Update RoutePoints component to handle landmark markers
- [ ] Modify `src/components/routePoints.tsx` to render landmark icons
- [ ] Add landmark name display in marker popover
- [ ] Implement name editing functionality for landmarks
- [ ] Handle landmark-specific interactions (drag, remove, rename)

#### Ticket 7: Extend MapContext for Search Functionality
**Priority:** High
**Estimate:** 4 hours
**Status:** TODO
**Description:** Add search and landmark functionality to MapContext
- [ ] Add search-related state to `src/contexts/mapContext.tsx`
- [ ] Implement `setPointFromSearch()` action for geocoding results
- [ ] Add `insertLandmark()` function for mid-route insertion
- [ ] Create `selectedPointType` state for insertion mode
- [ ] Update existing map click handlers to respect point type selection

### Phase 4: Data Persistence & URL State

#### Ticket 8: Update Route Encoding for Landmarks
**Priority:** Medium
**Estimate:** 3 hours
**Status:** TODO
**Description:** Extend route encoding to support landmark names in URLs
- [ ] Modify `src/lib/route-encoding.ts` to encode/decode landmark names
- [ ] Ensure backward compatibility with existing route URLs
- [ ] Update URL state management in MapContext
- [ ] Test shareable URLs with landmark data

#### Ticket 9: Update Database Schema Support
**Priority:** Low
**Estimate:** 2 hours
**Status:** TODO
**Description:** Ensure database can store landmark route data
- [ ] Verify existing JSON route data field supports landmark names
- [ ] Update route saving/loading to preserve landmark names
- [ ] Test database operations with landmark routes
- [ ] Update any validation schemas if needed

### Phase 5: UI Polish & Integration

#### Ticket 10: Style Floating Panel
**Priority:** Medium
**Estimate:** 3 hours
**Status:** TODO
**Description:** Implement proper styling and positioning for the search panel
- [ ] Position panel on left side of map with proper z-index
- [ ] Add collapsible functionality for mobile devices
- [ ] Implement smooth animations and transitions
- [ ] Ensure panel doesn't conflict with existing FloatingMenu
- [ ] Add proper focus management and accessibility features

#### Ticket 11: Add Landmark Insertion Logic
**Priority:** Medium
**Estimate:** 2 hours
**Status:** TODO
**Description:** Implement smart landmark insertion between existing points
- [ ] Add logic to insert landmarks at optimal positions in route
- [ ] Use existing `findBestInsertionIndex` algorithm for placement
- [ ] Handle landmark insertion from search results
- [ ] Update route calculation to include new landmark points

#### Ticket 12: Integration with RouteMap
**Priority:** Low
**Estimate:** 1 hour
**Status:** TODO
**Description:** Integrate LocationSearchPanel into the main RouteMap component
- [ ] Add LocationSearchPanel to `src/components/routeMap.tsx`
- [ ] Ensure proper component ordering and z-index stacking
- [ ] Test with existing components (FloatingMenu, ElevationDrawer)
- [ ] Verify mobile responsiveness

### Phase 6: Testing & Polish

#### Ticket 13: Comprehensive Testing
**Priority:** Medium
**Estimate:** 2 hours
**Status:** TODO
**Description:** Test the complete feature end-to-end
- [ ] Test search functionality with various location queries
- [ ] Verify landmark creation, editing, and deletion
- [ ] Test route sharing with landmarks
- [ ] Verify backward compatibility with existing routes
- [ ] Test responsive behavior on mobile devices
- [ ] Test keyboard navigation and accessibility

#### Ticket 14: Documentation & Cleanup
**Priority:** Low
**Estimate:** 1 hour
**Status:** TODO
**Description:** Final documentation and code cleanup
- [ ] Update component documentation
- [ ] Clean up any unused imports or code
- [ ] Verify TypeScript compliance
- [ ] Run linting and formatting checks

## Total Estimated Effort: ~33 hours

## Dependencies
- Phase 1 must be completed before Phase 2
- Ticket 3 (useGeocoding hook) should be completed before Ticket 4 (LocationSearchPanel)
- Phase 2 should be largely complete before starting Phase 3
- Phase 4 can be worked on in parallel with Phase 3
- Phase 5 depends on Phases 1-3 being complete

## Success Criteria
- [ ] Users can search for locations by name and place them on the map
- [ ] Landmarks can be added with custom names and appear differently from waypoints
- [ ] Search panel is responsive and doesn't interfere with existing functionality
- [ ] Landmark data is preserved in route URLs and database saves
- [ ] Feature integrates seamlessly with existing map interactions
- [ ] All existing functionality continues to work unchanged
