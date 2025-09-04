# Supabase Local Development Access Guide

This guide provides comprehensive information on accessing and managing your locally installed Supabase instance for the MicroBima project.

## 📋 Overview

The MicroBima project uses Supabase as the local development database. This document covers all the ways to access, manage, and interact with your local Supabase instance.

## 🚀 Quick Start

### 1. Start Supabase Locally
```bash
cd /home/judeokello/Projects/microbima
supabase start
```

### 2. Access Supabase Studio
Open your browser and navigate to:
```
http://127.0.0.1:54323
```

## 🔗 Service Endpoints

### **Primary Services**

| Service | URL | Port | Description |
|---------|-----|------|-------------|
| **Supabase Studio** | `http://127.0.0.1:54323` | 54323 | Main dashboard for database management |
| **API Server** | `http://127.0.0.1:54321` | 54321 | REST API and GraphQL endpoints |
| **Database** | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` | 54322 | Direct PostgreSQL connection |

### **Additional Services**

| Service | URL | Port | Description |
|---------|-----|------|-------------|
| **Email Testing (Inbucket)** | `http://127.0.0.1:54324` | 54324 | Email testing interface |
| **Analytics** | `http://127.0.0.1:54327` | 54327 | Analytics dashboard |
| **Edge Functions** | `http://127.0.0.1:54321/functions/v1/` | 54321 | Edge functions runtime |

## 🗄️ Database Access Methods

### 1. Supabase Studio (Recommended for Development)

**URL**: `http://127.0.0.1:54323`

**Features**:
- Visual database browser
- SQL query editor
- Table data viewer and editor
- Schema management
- Real-time subscriptions
- Authentication management
- Storage management

**Access Steps**:
1. Start Supabase: `supabase start`
2. Open browser to `http://127.0.0.1:54323`
3. No authentication required for local development

### 2. Direct PostgreSQL Connection

**Connection String**:
```
postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

**Connection Details**:
- **Host**: `127.0.0.1` (or `localhost`)
- **Port**: `54322`
- **Database**: `postgres`
- **Username**: `postgres`
- **Password**: `postgres`

**Tools that support this connection**:
- **psql** (command line)
- **pgAdmin** (GUI)
- **DBeaver** (GUI)
- **TablePlus** (GUI)
- **DataGrip** (JetBrains)

### 3. API Access

**Base URL**: `http://127.0.0.1:54321`

**Authentication**: 
- **API Key**: Available in Supabase Studio → Settings → API
- **Service Role Key**: For admin operations
- **Anon Key**: For public operations

## 🛠️ Common Operations

### Starting and Stopping Supabase

```bash
# Start Supabase
supabase start

# Stop Supabase
supabase stop

# Check status
supabase status

# Reset database (⚠️ Destroys all data)
supabase db reset
```

### Database Management

```bash
# Run migrations
supabase db push

# Generate migration from schema changes
supabase db diff --schema public

# Create new migration
supabase migration new <migration_name>

# Apply specific migration
supabase migration up <migration_id>
```

### Schema Management

```bash
# Generate TypeScript types
supabase gen types typescript --local > apps/api/src/types/database.types.ts

# Generate Go types
supabase gen types go --local > apps/api/src/types/database.types.go

# Generate Python types
supabase gen types python --local > apps/api/src/types/database.types.py
```

## 📊 Database Schema Information

### Current Tables (MicroBima Project)

Based on the Prisma schema, the following tables should exist:

1. **Partners**
   - `id` (Primary Key)
   - `partner_name`
   - `website`
   - `office_location`
   - `is_active`
   - `created_at`
   - `updated_at`

2. **PartnerApiKeys**
   - `id` (Primary Key)
   - `partner_id` (Foreign Key)
   - `api_key` (Hashed)
   - `is_active`
   - `created_at`
   - `updated_at`

3. **Customers** (Principal Members)
   - `id` (Primary Key)
   - `partner_id` (Foreign Key)
   - `partner_customer_id`
   - `first_name`
   - `middle_name`
   - `last_name`
   - `date_of_birth`
   - `gender`
   - `national_id`
   - `phone_number`
   - `email`
   - `address` (JSON)
   - `occupation`
   - `marital_status`
   - `emergency_contact` (JSON)
   - `status`
   - `created_at`
   - `updated_at`

4. **Dependants**
   - `id` (Primary Key)
   - `customer_id` (Foreign Key)
   - `first_name`
   - `middle_name`
   - `last_name`
   - `date_of_birth`
   - `gender`
   - `relationship`
   - `created_at`
   - `updated_at`

5. **Beneficiaries**
   - `id` (Primary Key)
   - `customer_id` (Foreign Key)
   - `first_name`
   - `middle_name`
   - `last_name`
   - `date_of_birth`
   - `gender`
   - `relationship`
   - `benefit_percentage`
   - `created_at`
   - `updated_at`

## 🔍 Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Check what's using the port
sudo lsof -i :54322

# Kill the process
sudo kill -9 <PID>

# Or use different ports
supabase start --port 54330
```

#### 2. Database Connection Refused
```bash
# Check if Supabase is running
supabase status

# Restart if needed
supabase stop
supabase start
```

#### 3. Migration Issues
```bash
# Reset and reapply migrations
supabase db reset

# Or check migration status
supabase migration list
```

#### 4. Studio Not Loading
- Clear browser cache
- Try different browser
- Check if port 54323 is accessible
- Restart Supabase: `supabase stop && supabase start`

### Logs and Debugging

```bash
# View Supabase logs
supabase logs

# View specific service logs
supabase logs --service db
supabase logs --service api
supabase logs --service studio

# Follow logs in real-time
supabase logs --follow
```

## 🔐 Security Considerations

### Local Development
- **No authentication required** for Supabase Studio
- **Default credentials** are used (postgres/postgres)
- **All data is local** and not shared

### Production Considerations
- Change default passwords
- Use environment variables for sensitive data
- Enable SSL/TLS for production
- Implement proper authentication

## 📝 Environment Variables

### Required for API Connection
```bash
# Database URL for the API
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# Supabase API URL
SUPABASE_URL="http://127.0.0.1:54321"

# Supabase API Keys (get from Studio)
SUPABASE_ANON_KEY="your_anon_key_here"
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here"
```

### Optional Configuration
```bash
# Custom ports
SUPABASE_DB_PORT=54322
SUPABASE_API_PORT=54321
SUPABASE_STUDIO_PORT=54323

# Custom project ID
SUPABASE_PROJECT_ID="microbima"
```

## 🚀 Development Workflow

### 1. Daily Development
```bash
# Start your day
supabase start

# Open Studio
open http://127.0.0.1:54323

# Start API server
cd apps/api
npm run start:dev
```

### 2. Schema Changes
```bash
# Make changes to Prisma schema
# Generate migration
supabase db diff --schema public

# Apply migration
supabase db push

# Update types
supabase gen types typescript --local > apps/api/src/types/database.types.ts
```

### 3. Testing
```bash
# Run API tests
cd apps/api
npm test

# Run integration tests
npm run test:integration

# Test with Postman collection
# Import docs/MicroBima_API_Collection.postman_collection.json
```

## 📚 Useful Commands Reference

### Supabase CLI Commands
```bash
# Project management
supabase init
supabase start
supabase stop
supabase status
supabase reset

# Database operations
supabase db push
supabase db pull
supabase db diff
supabase migration new <name>
supabase migration up
supabase migration down

# Code generation
supabase gen types typescript --local
supabase gen types go --local
supabase gen types python --local

# Logs and debugging
supabase logs
supabase logs --follow
supabase logs --service <service>

# Edge functions
supabase functions new <name>
supabase functions serve
supabase functions deploy
```

### Database Queries (psql)
```sql
-- Connect to database
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

-- List all tables
\dt

-- Describe table structure
\d table_name

-- View table data
SELECT * FROM table_name LIMIT 10;

-- Check database size
SELECT pg_size_pretty(pg_database_size('postgres'));

-- List all databases
\l

-- Exit psql
\q
```

## 🔗 External Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NestJS Documentation](https://docs.nestjs.com/)

## 📞 Support

If you encounter issues:

1. **Check Supabase status**: `supabase status`
2. **View logs**: `supabase logs`
3. **Restart services**: `supabase stop && supabase start`
4. **Check port availability**: `sudo lsof -i :54322`
5. **Review this guide** for common solutions

---

**Last Updated**: January 2024  
**Project**: MicroBima Customer Onboarding  
**Environment**: Local Development
