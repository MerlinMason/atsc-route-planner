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
│   ├── api/             # API routes (auth, tRPC)
│   └── _components/     # App-specific components
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

Tables are prefixed with `all_terrain_route_planner_` for multi-project database support. Current schema includes users, accounts, sessions, and verification tokens for authentication.

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

**Local Database**: Run `./start-database.sh` to start PostgreSQL container. Script handles container creation, password generation, and port management.

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
- [x] **User Location**: Geolocation API integration
- [ ] **Elevation Profiles**: Chart showing route elevation changes
- [ ] **Route Statistics**: Distance, elevation gain/loss, estimated time
- [ ] **Address Search**: Geocoding for location lookup
- [ ] **Route Sharing**: Public route URLs
- [ ] **Route Saving**: User accounts with saved routes


#### UI/UX Improvements
- [ ] **Responsive Design**: Mobile-first responsive layout
- [ ] **Dark Mode**: Toggle between light/dark themes
- [ ] **Keyboard Shortcuts**: Power user actions using cmdK library

#### Technical Debt
- [ ] **Error Handling**: Comprehensive error boundaries and user feedback
- [ ] **Performance**: Code splitting, lazy loading, image optimization
- [ ] **Testing**: Unit tests for components and API endpoints
