# All Terrain Route Planner

A modern web application for planning outdoor routes with elevation profiles, interactive mapping, and route sharing capabilities. Built for adventure cycling and outdoor enthusiasts who need detailed route planning with elevation data.

Features seamless user interactions including right-click context menus, animated UI transitions, and optimized GPX exports that import cleanly into Strava and other fitness platforms.

## Features

- **Interactive Route Planning**: Click or right-click to place waypoints and automatically calculate routes
- **Context Menu**: Right-click anywhere on the map to add start points, end points, or waypoints
- **Elevation Profiles**: View detailed elevation charts with gain/loss statistics and surface data
- **Multiple Surface Types**: Support for on/off-rad preferences
- **Route Management**: Save, load, duplicate, and delete routes with user accounts
- **GPX Export**: Download clean routes in standard GPX format optimized for Strava and GPS devices
- **Route Sharing**: Generate shareable URLs for routes
- **Authentication**: Seamless Google OAuth integration with contextual feedback
- **Real-time Updates**: Live route calculation with undo/redo functionality
- **Reverse Routes**: Quickly reverse your planned route direction
- **Smart Location Search**: Geocoding with distance-aware search results

## Technology Stack

Built with the [T3 Stack](https://create.t3.gg/) and modern web technologies:

### Core Framework
- **[Next.js 15](https://nextjs.org)** - React framework with App Router and Server Components
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe development
- **[Tailwind CSS v4](https://tailwindcss.com)** - Utility-first CSS framework

### Backend & Database
- **[tRPC](https://trpc.io)** - End-to-end typesafe APIs
- **[Drizzle ORM](https://orm.drizzle.team)** - Type-safe database toolkit
- **[PostgreSQL](https://www.postgresql.org/)** - Production database (Neon)

### Authentication & State
- **[NextAuth.js v5](https://next-auth.js.org)** - Authentication with Google OAuth and server actions
- **React Context** - Client-side state management with URL persistence
- **Smart UI Feedback** - Contextual authentication prompts and toast notifications

### Mapping & APIs
- **[Leaflet](https://leafletjs.com/)** - Interactive maps with react-leaflet
- **[GraphHopper API](https://www.graphhopper.com/)** - Route calculation and optimization
- **[Mapbox](https://www.mapbox.com/)** - Map tiles and elevation data

### UI Components
- **[shadcn/ui](https://ui.shadcn.com/)** - Reusable UI components built on Radix UI
- **[Lucide React](https://lucide.dev/)** - Beautiful icon library
- **[Recharts](https://recharts.org/)** - Data visualization for elevation charts

### Development Tools
- **[Biome](https://biomejs.dev/)** - Fast linting and formatting
- **[Turbo](https://turbo.build/)** - Build system and development server

## Getting Started

### Prerequisites
- Node.js 18+ and pnpm
- PostgreSQL database (local Docker or Neon)
- API keys for GraphHopper and Mapbox
- Google OAuth credentials for authentication

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd All_Terrain_Route_Planner
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Fill in your API keys and database URL
```

4. Start the database (if using local Docker):
```bash
./start-database.sh
```

5. Push database schema:
```bash
pnpm db:push
```

6. Start the development server:
```bash
pnpm dev
```

### Development Commands

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm typecheck` - Run TypeScript checks
- `pnpm check` - Run linting and formatting checks
- `pnpm check:write` - Fix auto-fixable issues
- `pnpm db:studio` - Open database GUI

## Deployment

The application is deployed on [Vercel](https://vercel.com/) with a [Neon](https://neon.tech/) PostgreSQL database.
