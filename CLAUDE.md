# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Package Manager**: Use `pnpm` for all package operations.

**Development**:
- `pnpm dev` - Start development server with Turbo
- `pnpm build` - Build production version
- `pnpm preview` - Build and start production server locally
- `pnpm typecheck` - Run TypeScript type checking

**Code Quality**:
- `pnpm check` - Run Biome linting and formatting checks
- `pnpm check:write` - Fix auto-fixable issues
- `pnpm check:unsafe` - Fix issues including unsafe transformations

**Database**:
- `./start-database.sh` - Start local PostgreSQL Docker container
- `pnpm db:generate` - Generate Drizzle schema migrations
- `pnpm db:push` - Push schema changes to database
- `pnpm db:migrate` - Run pending migrations
- `pnpm db:studio` - Open Drizzle Studio database GUI

You should expect that the development server is already running on port 3000, there's no need to start it yourself.

## Architecture Overview

This is a **T3 Stack** application (Next.js + tRPC + Tailwind + TypeScript) that represents a rebuild of a legacy route planning application found in `/archive`.

**Key Technologies**:
- **Next.js 15** with App Router and React Server Components
- **NextAuth.js 5.0 beta** for authentication (Google OAuth configured)
- **Drizzle ORM** with PostgreSQL database
- **tRPC** for type-safe API endpoints
- **shadcn/ui** component system with Radix UI primitives
- **Tailwind CSS v4** for styling
- **Biome** for linting and formatting
- **Leaflet** for mapping
- **GraphHopper API** for routing
- **Mapbox API** for elevation data
- **Lucide React** for icons

## Project Structure

```
src/
├── app/                 # Next.js App Router
│   └── api/             # API routes (auth, tRPC)
├── components/          # Reusable UI components (shadcn/ui)
├── lib/                 # Utility functions and configurations
├── server/              # Server-side code
│   ├── api/             # tRPC routers and procedures
│   ├── auth/            # NextAuth.js configuration
│   └── db/              # Database schema and connection
├── styles/              # Global CSS
└── trpc/                # tRPC client configuration
```

## Database Schema

Tables are prefixed with `all_terrain_route_planner_` for multi-project database support. Current schema includes:

**Authentication Tables**:
- `users` - User account information
- `accounts` - OAuth provider accounts
- `sessions` - User sessions
- `verification_tokens` - Email verification tokens

**Application Tables**:
- `routes` - Saved user routes with title, route data (JSON), distance, elevation gain, timestamps, and user ownership

## Authentication System

Uses NextAuth.js v5 with:
- Google OAuth provider
- Database adapter (Drizzle)
- Session-based authentication
- Type-safe session handling

Access authenticated user via `auth()` server function or `useSession()` client hook.

## Development Environment

**Required Environment Variables**:
- `AUTH_SECRET` - NextAuth.js secret
- `AUTH_GOOGLE_CLIENT_ID` - Google OAuth client ID
- `AUTH_GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `DATABASE_URL` - PostgreSQL connection string
- `GRAPHHOPPER_API_KEY` - GraphHopper routing API key
- `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` - Mapbox map tiles access token

**Local Database**: Run `./start-database.sh` to start PostgreSQL container. Script handles container creation, password generation, and port management.

## Application Architecture

**State Management**:
- **URL-based Route State**: Route points and routeId stored in URL search parameters for shareable links
- **React Context**: `MapContext` provides centralized state for map interactions, route data, and UI state
- **History Management**: Undo/redo functionality with reducer pattern for atomic state updates
- **Cache Strategy**: tRPC queries with manual invalidation for real-time data updates

**Key Components**:
- `RouteMap` - Main Leaflet map with route visualization and interactions
- `ElevationChart` - Recharts-based elevation profile with interactive tooltips
- `FloatingMenu` - Action buttons for route operations (save, share, export, etc.)
- `SaveRouteDialog` / `MyRoutesDialog` - Route management interfaces
- `LocationHandler` - Automatic map positioning based on user location and route bounds

**API Structure**:
- `routePlanner` tRPC router handles all route-related operations
- Protected procedures for user route management with ownership validation
- Public procedures for route calculation and geocoding
- GraphHopper API integration for routing and GPX export

**Utility Functions**:
- `route-utils.ts` - Centralized formatting functions for distance, elevation, and dates
- `graphhopper.ts` - API client and response validation for routing services
- `geometry.ts` - Mathematical calculations for route interactions

## Code Style

- **TypeScript strict mode** enabled
- **Biome** handles all linting and formatting
- Use `cn()` utility for conditional class names
- Follow existing patterns in `/components` for new UI components
- Server Components by default, use 'use client' only when necessary
- Use `type` over `interface` for types
- Components should be named exports with name matching the file name
- Use arrow functions for React components
- Use comments sparingly, favor self-documenting code - never comment just to explain what you have changed


## Legacy Application Context

The `/archive` directory contains a feature-rich JavaScript route planning application with mapping, elevation charts, GPX handling, and Google Drive integration. This rebuild modernizes those features using current web development practices.

## Migration Progress

### Setup

- [x] **Project Setup**: T3 Stack initialized with Next.js 15, tRPC, Tailwind CSS v4
- [x] **Authentication**: NextAuth.js 5.0 beta with Google OAuth configured
- [x] **Database**: PostgreSQL with Drizzle ORM, user/session tables
- [x] **Environment Configuration**: API keys and secrets properly configured
- [x] **Basic Map Component**: Leaflet integration with react-leaflet
- [x] **Map Styling**: Mapbox outdoor tiles matching legacy design
- [x] **Route Calculation Backend**: GraphHopper API integration via tRPC
- [x] **Route Display**: Polyline rendering for calculated routes
- [x] **Custom Map Icons**: Lucide-based markers for start/end points
- [x] **Map Interaction**: Click to place start/end points and calculate routes
- [x] **Code Organization**: GraphHopper utilities extracted to separate module
- [x] **Clean Architecture**: Removed unused template files, organized imports

### Navigation

- [x] **Waypoint System**: Add intermediate waypoints via map clicks
- [x] **Waypoint Mid-route Management**: Click to add additional waypoints between existing points
- [x] **Waypoint Removal**: Click to remove waypoints
- [x] **Waypoint Moving**: Drag to move, click to remove waypoints
- [x] **Undo/Redo**: Track changes for undo/redo functionality

#### Core Mapping Features
- [x] **Route Export**: GPX file generation and download
- [x] **User Location**: Geolocation API integration with automatic map positioning
- [x] **Elevation Profiles**: Interactive charts showing route elevation changes with gain/loss statistics
- [x] **Route Sharing**: Public route URLs with persistent URL state
- [x] **Route Statistics**: Distance, elevation gain/loss displayed in charts and route cards
- [x] **Route Saving**: Complete user route management system
- [x] **Route Loading**: Load, edit, duplicate, and delete saved routes
- [x] **Route Management UI**: Dialogs for saving/loading routes with proper UX
- [x] **Cache Management**: Automatic cache invalidation for real-time updates
- [ ] **Address Search**: Geocoding for location lookup


#### UI/UX Improvements
- [ ] **Responsive Design**: Mobile-first responsive layout
- [ ] **Dark Mode**: Toggle between light/dark themes
- [ ] **Keyboard Shortcuts**: Power user actions using cmdK library

#### Technical Debt
- [ ] **Error Handling**: Comprehensive error boundaries and user feedback
- [ ] **Performance**: Code splitting, lazy loading, image optimization
- [ ] **Testing**: Unit tests for components and API endpoints
