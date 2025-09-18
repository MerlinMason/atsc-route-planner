# All Terrain Route Planner

A modern web application for planning outdoor routes with elevation profiles, interactive mapping, and route sharing capabilities. Built for adventure cycling, and outdoor enthusiasts who need detailed route planning with elevation data.

## Features

- **Interactive Route Planning**: Click to place waypoints and automatically calculate routes
- **Elevation Profiles**: View detailed elevation charts with gain/loss statistics
- **Multiple Vehicle Types**: Support for hiking, cycling, and other outdoor activities
- **Route Management**: Save, load, duplicate, and delete routes with user accounts
- **GPX Export**: Download routes in standard GPX format for GPS devices
- **Route Sharing**: Generate shareable URLs for routes
- **Real-time Updates**: Live route calculation with undo/redo functionality
- **Responsive Design**: Works on desktop and mobile devices

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
- **[NextAuth.js v5](https://next-auth.js.org)** - Authentication with Google OAuth
- **React Context** - Client-side state management with URL persistence

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

The application is designed for deployment on [Vercel](https://vercel.com/) with a [Neon](https://neon.tech/) PostgreSQL database. See the T3 Stack [deployment guide](https://create.t3.gg/en/deployment/vercel) for detailed instructions.

## Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), take a look at the following resources:

- [Documentation](https://create.t3.gg/)
- [Learn the T3 Stack](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available) — Check out these awesome tutorials

You can check out the [create-t3-app GitHub repository](https://github.com/t3-oss/create-t3-app) — your feedback and contributions are welcome!

## How do I deploy this?

Follow our deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify) and [Docker](https://create.t3.gg/en/deployment/docker) for more information.
