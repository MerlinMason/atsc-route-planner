# Floating Location Search Panel - Feature Tickets

## Feature Summary

Add a floating left panel that provides location search functionality with landmark support. Users can search for named locations (e.g., "Wolfenstow Town Hall") and place them as start points, end points, or named landmarks along their route. This complements the existing map-click functionality and provides a more accessible way to plan routes using known locations.

## User Stories

### Primary User Stories
- **As a route planner**, I want to search for a specific location by name so that I can easily set my start or end point without having to know the exact coordinates
- **As a route planner**, I want to add named checkpoints to my route (like "Town Hall", "Pub", "Viewpoint") so that I can plan routes that visit specific points of interest
- **As a route planner**, I want to see a list of my current route points in the search panel so that I can easily manage and modify my route

### Secondary User Stories
- **As a route sharer**, I want checkpoint names to be preserved in shared route URLs so that others can see the intended points of interest
- **As a route planner**, I want to be able to insert checkpoints between existing points so that I can add interesting stops to an existing route
- **As a user with accessibility needs**, I want to use keyboard navigation in the search interface so that I can operate the application without relying solely on mouse interactions

## Implementation Tickets

### Phase 1: Foundation & Type System

#### Ticket 1: Extend RoutePoint Type System ✅ COMPLETED
**Priority:** High
**Estimate:** 2 hours
**Status:** ✅ COMPLETED
**Description:** Extend the RoutePoint type to support landmarks with names
- [x] Update RoutePoint type in `src/components/routePoints.tsx` to include `name?: string` property
- [x] Add new `checkpoint` type to the type union: `"start" | "waypoint" | "end" | "checkpoint"`
- [x] Create CheckpointPoint utility type for type safety
- [x] Update all existing RoutePoint usage to handle optional name property

#### Ticket 2: Update GraphHopper Schema
**Priority:** High
**Estimate:** 1 hour
**Status:** ✅ COMPLETED
**Description:** Update GraphHopper schemas to support checkpoint data
- [x] Modify RoutePointSchema in `src/lib/graphhopper.ts` to include optional name field
- [x] Update CalculateRouteSchema to handle checkpoint points
- [x] Ensure backward compatibility with existing route data
- [x] Update TypeScript types for API responses

### Phase 2: Core Components

#### Ticket 3: Create useGeocoding Hook
**Priority:** High
**Estimate:** 3 hours
**Status:** ✅ COMPLETED
**Description:** Create a custom hook for debounced geocoding with search functionality
- [x] Create `src/hooks/useGeocoding.ts` with debounced search
- [x] Integrate with existing tRPC geocoding endpoint
- [x] Add result caching for performance
- [x] Implement legacy relevance sorting algorithm from archive code
- [x] Handle loading and error states

**Implementation Notes:**
- Used `react-use` `useDebounce` hook for clean debouncing logic
- Created shared `src/lib/geo-utils.ts` for geographic calculations
- Eliminated code duplication by consolidating distance calculation functions
- Implemented with TypeScript for full type safety
- Applied relevance scoring algorithm from legacy code with improvements
- Added race condition protection and proper error handling

#### Ticket 4: Create LocationSearchPanel Component ✅ COMPLETED
**Priority:** High
**Estimate:** 4 hours
**Status:** ✅ COMPLETED
**Description:** Build the main floating panel component
- [x] Create `src/components/locationSearchPanel.tsx`
- [x] Implement search input with autocomplete dropdown using shadcn Command component
- [x] Add point type selector (Start/End/Checkpoint) with smart defaults
- [x] Create current route points list display
- [x] Add basic responsive styling with collapsible functionality
- [x] Integrate with useGeocoding hook

**Implementation Notes:**
- Used shadcn Command component for keyboard navigation and accessibility
- Implemented smart default point type selection based on route state
- Added duplicate result deduplication with semantic grouping
- Integrated automatic map positioning when points are added via search
- Created collapsible panel design for mobile-friendly UX

#### Ticket 5: Implement Checkpoint Icon System
**Priority:** Medium
**Estimate:** 2 hours
**Status:** TODO
**Description:** Extend the map icon system to support checkpoint markers
- [ ] Update `src/hooks/useMapIcons.ts` to create checkpoint icons
- [ ] Design checkpoint icon with place pin styling (different from waypoint)
- [ ] Add icon with checkpoint name labels
- [ ] Ensure visual distinction from existing waypoint markers

### Phase 3: Map Integration

#### Ticket 6: Add Checkpoint Support to RoutePoints Component
**Priority:** High
**Estimate:** 3 hours
**Status:** TODO
**Description:** Update RoutePoints component to handle checkpoint markers
- [ ] Modify `src/components/routePoints.tsx` to render checkpoint icons
- [ ] Add checkpoint name display in marker popover
- [ ] Implement name editing functionality for checkpoints
- [ ] Handle checkpoint-specific interactions (drag, remove, rename)

#### Ticket 7: Extend MapContext for Search Functionality ✅ COMPLETED
**Priority:** High
**Estimate:** 4 hours
**Status:** ✅ COMPLETED
**Description:** Add search and landmark functionality to MapContext
- [x] Add search-related state to `src/contexts/mapContext.tsx`
- [x] Implement `setPointFromSearch()` action for geocoding results
- [x] Add landmark insertion functionality (uses existing `findBestInsertionIndex`)
- [x] Point type selection handled in LocationSearchPanel component
- [x] Automatic map positioning after search point insertion

**Implementation Notes:**
- Reused existing helper functions (`createRoutePoint`, `addEndPoint`, `findBestInsertionIndex`)
- Used DRY principle by leveraging `RoutePoint["type"]` instead of duplicating type definitions
- Integrated automatic map bounds fitting using existing `positionMap` function
- Maintained consistency with existing map interaction patterns

### Phase 4: Data Persistence & URL State

#### Ticket 8: Update Route Encoding for Checkpoints
**Priority:** Medium
**Estimate:** 3 hours
**Status:** TODO
**Description:** Extend route encoding to support checkpoint names in URLs
- [ ] Modify `src/lib/route-encoding.ts` to encode/decode checkpoint names
- [ ] Ensure backward compatibility with existing route URLs
- [ ] Update URL state management in MapContext
- [ ] Test shareable URLs with checkpoint data

#### Ticket 9: Update Database Schema Support
**Priority:** Low
**Estimate:** 2 hours
**Status:** TODO
**Description:** Ensure database can store checkpoint route data
- [ ] Verify existing JSON route data field supports checkpoint names
- [ ] Update route saving/loading to preserve checkpoint names
- [ ] Test database operations with checkpoint routes
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

#### Ticket 11: Add Checkpoint Insertion Logic
**Priority:** Medium
**Estimate:** 2 hours
**Status:** TODO
**Description:** Implement smart checkpoint insertion between existing points
- [ ] Add logic to insert checkpoints at optimal positions in route
- [ ] Use existing `findBestInsertionIndex` algorithm for placement
- [ ] Handle checkpoint insertion from search results
- [ ] Update route calculation to include new checkpoint points

#### Ticket 12: Integration with RouteMap ✅ COMPLETED
**Priority:** Low
**Estimate:** 1 hour
**Status:** ✅ COMPLETED
**Description:** Integrate LocationSearchPanel into the main RouteMap component
- [x] Add LocationSearchPanel to `src/components/routeMap.tsx`
- [x] Ensure proper component ordering and z-index stacking
- [x] Test with existing components (FloatingMenu, ElevationDrawer)
- [x] Verify mobile responsiveness with collapsible design

### Phase 6: Testing & Polish

#### Ticket 13: Comprehensive Testing
**Priority:** Medium
**Estimate:** 2 hours
**Status:** TODO
**Description:** Test the complete feature end-to-end
- [ ] Test search functionality with various location queries
- [ ] Verify checkpoint creation, editing, and deletion
- [ ] Test route sharing with checkpoints
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
- [x] Users can search for locations by name and place them on the map
- [x] Checkpoints can be added with custom names and appear differently from waypoints
- [x] Search panel is responsive and doesn't interfere with existing functionality
- [ ] Checkpoint data is preserved in route URLs and database saves (TODO: Ticket 8)
- [x] Feature integrates seamlessly with existing map interactions
- [x] All existing functionality continues to work unchanged

## Completed Features
- ✅ **Smart Location Search**: Full text search with geocoding and deduplication
- ✅ **Keyboard Navigation**: Complete keyboard accessibility using Command component
- ✅ **Smart Point Type Selection**: Automatic selection based on route state
- ✅ **Auto Map Positioning**: Map automatically fits bounds to show full route
- ✅ **Mobile-Friendly Design**: Collapsible panel for responsive experience
- ✅ **Checkpoint Support**: Full support for named checkpoints on routes
- ✅ **Integration**: Seamless integration with existing map functionality
