# Hot Reload Development Guide

This guide explains how hot reload works in the MicroBima development environment and how to troubleshoot issues.

## Overview

Hot reload allows you to see code changes instantly without manually rebuilding or restarting the development server. The MicroBima project uses:

- **NestJS API**: Watch mode with TypeScript compiler (fast rebuilds)
- **Next.js Agent Registration**: Hot Module Replacement (HMR) with Turbopack

## Quick Start

1. Start the development environment:
   ```bash
   pnpm dev:all
   ```

2. Make changes to your code files

3. Changes should automatically reload within seconds

## How It Works

### NestJS API (Port 3001)

- Uses `nest start --watch` which monitors file changes
- TypeScript compiler mode (faster than webpack)
- Automatically restarts the server when files change
- Watch mode is configured in `apps/api/nest-cli.json`

### Next.js Agent Registration (Port 3000)

- Uses `next dev --turbopack` for fast hot reload
- Hot Module Replacement (HMR) updates the browser without full page reload
- Standalone output is disabled in development (only enabled in production)
- Configuration in `apps/agent-registration/next.config.mjs`

## Troubleshooting

### Hot Reload Not Working

1. **Run the diagnostic script:**
   ```bash
   ./scripts/check-watch-mode.sh
   ```

2. **Check file watcher limits (Linux):**
   ```bash
   ./scripts/check-file-watcher-limits.sh
   ```

3. **Verify processes are running:**
   ```bash
   pnpm status
   ```

4. **Check logs for watch mode messages:**
   ```bash
   # API logs
   tail -f .api.log
   
   # Agent Registration logs
   tail -f .agent-registration.log
   ```

### Common Issues

#### Issue: Changes require full rebuild (~5 minutes)

**Cause:** Next.js `output: 'standalone'` was enabled in development

**Solution:** This has been fixed - standalone output is now only enabled in production. If you still see this issue:

1. Stop all processes: `pnpm stop`
2. Restart: `pnpm dev:all`
3. Verify: `./scripts/check-watch-mode.sh`

#### Issue: File changes not detected

**Cause:** File watcher limits too low (Linux)

**Solution:**
```bash
# Check current limit
cat /proc/sys/fs/inotify/max_user_watches

# Increase temporarily
sudo sysctl fs.inotify.max_user_watches=524288

# Make permanent (add to /etc/sysctl.conf)
echo "fs.inotify.max_user_watches=524288" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

#### Issue: Processes not starting in watch mode

**Cause:** Scripts may not be passing watch flags correctly

**Solution:**
1. Check `apps/api/package.json` - `start:dev` should include `--watch`
2. Check `apps/agent-registration/package.json` - `dev` should use `next dev`
3. Restart: `pnpm stop && pnpm dev:all`

## Configuration Files

### Next.js Configuration
- **File:** `apps/agent-registration/next.config.mjs`
- **Key Setting:** `output: 'standalone'` is conditional (production only)

### NestJS Configuration
- **File:** `apps/api/nest-cli.json`
- **Key Setting:** `webpack: false` (uses faster TypeScript compiler)

### Development Scripts
- **File:** `start-dev.sh`, `start-api.sh`, `start-agent.sh`
- **Function:** Manage processes and ensure watch mode is active

## Best Practices

1. **Always use development scripts:**
   - `pnpm dev:all` - Start both apps
   - `pnpm dev:api` - Start API only
   - `pnpm dev:agent` - Start Agent Registration only

2. **Monitor logs during development:**
   - Keep a terminal open with `tail -f .api.log` or `.agent-registration.log`
   - Watch for reload messages when you make changes

3. **Test hot reload after setup:**
   - Make a small change (e.g., add a comment)
   - Verify the change appears within seconds
   - If not, run the diagnostic script

4. **File watcher limits:**
   - Check limits periodically, especially after system updates
   - Large projects may need higher limits

## Diagnostic Tools

### Check Watch Mode Status
```bash
./scripts/check-watch-mode.sh
```

This script checks:
- File watcher limits
- Next.js configuration
- NestJS configuration
- Running processes
- Watch mode indicators in logs

### Check File Watcher Limits
```bash
./scripts/check-file-watcher-limits.sh
```

This script:
- Shows current inotify limits
- Recommends optimal values
- Provides instructions for increasing limits

## Performance Expectations

- **Initial startup:** 10-30 seconds (first compilation)
- **Hot reload (NestJS):** 1-3 seconds (server restart)
- **Hot reload (Next.js):** <1 second (HMR update)
- **Full rebuild:** Should NOT happen in development

If you're experiencing 5-minute builds, something is wrong. Run the diagnostic script.

## Related Documentation

- [Development Guide](../quick-reference/development-guide.md)
- [Error Handling Guide](./error-handling-guide.md)
- [Coding Standards](./coding-standards.md)

