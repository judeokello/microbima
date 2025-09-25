# MicroBima Agent Registration

A modern Next.js web application for agent registration, built with the latest technologies and designed to consume APIs from the MicroBima internal API.

## Tech Stack

- **Framework**: Next.js 15 (App Router), TypeScript, Tailwind CSS v4
- **Components**: Shadcn UI
- **Validation**: Zod
- **Forms & State**: React Hook Form, Zustand
- **Data Table**: TanStack Table
- **Tooling**: ESLint, Prettier, Husky

## Features

- Modern, responsive design with customizable theme presets
- Multiple dashboard layouts and authentication screens
- Pre-built UI components and data tables
- Role-based access control (planned)
- Multi-tenant support (planned)

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Installation

From the monorepo root:

```bash
pnpm install
```

### Development

Start the development server:

```bash
pnpm --filter @microbima/agent-registration dev
```

The app will be available at `http://localhost:3001`

### Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env.local
```

Update the environment variables in `.env.local`:

- `NEXT_PUBLIC_API_BASE_URL`: Base URL for the internal API
- `NEXT_PUBLIC_INTERNAL_API_BASE_URL`: Internal API endpoint
- `NEXTAUTH_SECRET`: Secret for authentication (if using NextAuth)

### Building for Production

```bash
pnpm --filter @microbima/agent-registration build
```

### Running in Production

```bash
pnpm --filter @microbima/agent-registration start
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (external)/        # External pages (landing, etc.)
│   ├── (main)/           # Main application pages
│   │   ├── auth/         # Authentication pages
│   │   └── dashboard/    # Dashboard pages
│   └── layout.tsx        # Root layout
├── components/           # Reusable UI components
│   ├── ui/              # Shadcn UI components
│   └── data-table/      # Data table components
├── config/              # App configuration
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions
├── stores/              # Zustand stores
└── types/               # TypeScript type definitions
```

## API Integration

This application is designed to consume APIs from the MicroBima internal API. The API endpoints are configured through environment variables and can be customized based on your deployment setup.

## Deployment

The application can be deployed independently or as part of the monorepo. For standalone deployment, ensure all environment variables are properly configured in your deployment environment.

## Contributing

This project follows the MicroBima development standards and error handling patterns. Please refer to the main project documentation for coding standards and best practices.