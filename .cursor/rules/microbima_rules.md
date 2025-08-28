# Microbima – Project Rules for AI (Cursor)


## Monorepo shape
- Single-root monorepo.
- Apps live in `apps/*` (e.g., `web-admin`, `mobile`, `api`).
- Shared code in `packages/*` (e.g., `sdk`, `ui`, `core`).
- Infra in `infra/*`.


## Source of truth for API contracts
- OpenAPI spec at `openapi/microbima.yaml` (or backend URL like `http://localhost:8000/openapi.json`).
- Always import request/response types from `@microbima/sdk`.
- Never use server-only/DB (Prisma) types in client code.


## Generated SDK
- Generate TS client + types with `openapi-typescript-codegen`.
- Output to `packages/sdk/src/gen`.
- Public entrypoint is `packages/sdk/src/index.ts`.
- Treat `src/gen` as **generated – do not edit**.


## Preferred imports
```ts
import { PoliciesService, type Policy } from "@microbima/sdk";