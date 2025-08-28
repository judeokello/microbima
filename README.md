# MicroBima

Modern, API-first microinsurance platform designed for flexible products, fast onboarding, and robust partner integrations.

## 🏗️ Project Structure

```
microbima/
├── apps/                    # Application packages
│   ├── api/                # NestJS backend API
│   ├── web-admin/          # Next.js admin dashboard
│   └── mobile/             # React Native mobile app
├── packages/                # Shared packages
│   ├── sdk/                # Generated TypeScript SDK
│   ├── ui/                 # Shared UI components
│   └── core/               # Shared business logic
├── infra/                   # Infrastructure configuration
│   ├── docker/             # Docker configurations
│   └── fly/                # Fly.io deployment configs
├── openapi/                 # OpenAPI specifications
└── docs/                    # Documentation
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- Docker (for local development)
- Fly CLI (for deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd microbima
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Generate SDK**
   ```bash
   pnpm sdk:gen
   pnpm sdk:build
   ```

5. **Start development**
   ```bash
   pnpm dev
   ```

## 📚 Development

### Available Scripts

- `pnpm dev` - Start all applications in development mode
- `pnpm build` - Build all packages and applications
- `pnpm test` - Run tests across all packages
- `pnpm lint` - Run linting across all packages
- `pnpm sdk:gen` - Generate TypeScript SDK from OpenAPI spec
- `pnpm sdk:build` - Build the generated SDK
- `pnpm db:generate` - Generate Prisma client
- `pnpm db:migrate` - Run database migrations
- `pnpm db:seed` - Seed database with sample data

### Adding New Features

1. **Update OpenAPI specification** in `openapi/microbima.yaml`
2. **Regenerate SDK** with `pnpm sdk:gen`
3. **Implement backend logic** in `apps/api`
4. **Add frontend components** in `apps/web-admin` or `apps/mobile`
5. **Test integration** through the generated SDK

## 🔧 Architecture

### API Strategy

- **Internal APIs** (`/api/internal/*`) - For portal access
- **Public APIs** (`/api/v1/*`) - For partner integrations via Kong gateway

### Authentication

- **Internal APIs**: JWT authentication
- **Public APIs**: OIDC authentication through Kong

### Database

- **PostgreSQL** with Prisma ORM
- **Supabase** for hosting and real-time features

## 🚀 Deployment

### Fly.io

Applications are deployed to Fly.io with private networking:

- `microbima-api` - Backend API
- `microbima-web-admin` - Admin dashboard
- `microbima-mobile` - Mobile app backend

### Environment Variables

Set required environment variables in Fly.io:

```bash
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set JWT_SECRET="your-secret"
fly secrets set KONG_OIDC_CLIENT_ID="your-client-id"
```

## 📖 Documentation

- [Master Document](docs/microbima_master_document.md) - Complete technical blueprint
- [Development Plan](docs/devplan.md) - Step-by-step implementation guide
- [AI & Analytics Blueprint](docs/microbima_ai_analytics_blueprint.md) - AI IDE setup and analytics

## 🤝 Contributing

1. Follow the development plan in `docs/devplan.md`
2. Use the generated SDK for all API interactions
3. Follow TypeScript strict mode
4. Write tests for new features
5. Update OpenAPI spec when adding endpoints

## 📄 License

Private - All rights reserved
