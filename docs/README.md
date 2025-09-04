# MicroBima Documentation

Welcome to the MicroBima project documentation. This guide will help you understand the project structure, architecture, and development practices.

## 📚 Documentation Structure

### 🏗️ Architecture Decisions
- [ADR 001: Entity-DTO Mapping Strategy](architecture/decisions/001-entity-dto-mapping-strategy.md)
- [ADR 002: Naming Conventions](architecture/decisions/002-naming-conventions.md)
- [ADR 003: Entity Design Patterns](architecture/decisions/003-entity-design-patterns.md)

### 💻 Development Guidelines
- [Coding Standards](development/coding-standards.md)
- [Quick Reference Guide](quick-reference/development-guide.md)

### 🧪 API Testing
- [API Testing Guide](API_Testing_Guide.md)
- [Postman Collection](MicroBima_API_Collection.postman_collection.json)

## 🚀 Quick Start

1. **Read the [Quick Reference Guide](quick-reference/development-guide.md)** for immediate development guidance
2. **Review [Coding Standards](development/coding-standards.md)** for best practices
3. **Check [Architecture Decisions](architecture/decisions/)** for design rationale
4. **Test the APIs** using the [Postman Collection](MicroBima_API_Collection.postman_collection.json) and [Testing Guide](API_Testing_Guide.md)

## 📋 Key Decisions Summary

### Entity Design
- **Full Mapping**: All Prisma fields included in entities
- **Business Logic**: Domain methods in entities
- **Validation**: Server-side validation methods
- **No Database Operations**: Keep in services

### Naming Conventions
- **Database**: `snake_case` tables, `camelCase` columns
- **Entities**: `PascalCase` classes, `camelCase` properties
- **DTOs**: `PascalCase` + `Dto` suffix

### Response Format
- **Success**: `{ status, correlationId?, message?, data? }`
- **Error**: `{ status, correlationId?, error, message, details? }`

## 🔄 Data Flow

```
External API → DTOs → Controllers → Services → Entities → Prisma → Database
```

## 📝 Contributing to Documentation

1. **Update ADRs** when making architectural decisions
2. **Add examples** to coding standards
3. **Keep quick reference** up to date
4. **Document new patterns** as they emerge

## 🤝 Need Help?

- Check the [Quick Reference Guide](quick-reference/development-guide.md)
- Review [Coding Standards](development/coding-standards.md)
- Look at existing code examples
- Ask questions in team discussions
