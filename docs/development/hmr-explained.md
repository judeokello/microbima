# Hot Module Replacement (HMR) Explained

## What is HMR?

**Hot Module Replacement (HMR)** is a development feature that allows you to update parts of your application without losing the application state or requiring a full page reload. When you save a file, only the changed modules are replaced in the running application, and the browser updates instantly.

## How HMR Works

### 1. **HMR Requests**
HMR requests are HTTP requests made by the browser to the development server to check for and receive code updates:

- **WebSocket Connection**: Modern HMR uses WebSocket connections for real-time communication
- **HTTP Polling**: Some setups use HTTP polling to check for updates
- **Update Payload**: When changes are detected, the server sends updated code modules to the browser

**Example HMR Request Flow:**
```
1. You save a file (e.g., `component.tsx`)
2. Next.js detects the change via file watcher
3. Next.js recompiles only the changed module
4. Browser receives HMR update via WebSocket
5. Browser replaces the old module with the new one
6. React re-renders only the changed component
7. Your application state is preserved!
```

### 2. **HMR Errors**
HMR errors occur when the hot reload process fails. Common causes:

#### **Module Update Failed**
- **Symptom**: Browser console shows "HMR update failed" or "Failed to reload"
- **Cause**: Syntax error, type error, or runtime error in the updated code
- **Solution**: Fix the error in your code, and HMR will retry automatically

#### **WebSocket Connection Lost**
- **Symptom**: "WebSocket connection closed" or "HMR connection lost"
- **Cause**: Network issues, server restart, or firewall blocking WebSocket
- **Solution**: Check network connection, restart dev server if needed

#### **Module Not Found**
- **Symptom**: "Cannot find module" or "Module not found" errors
- **Cause**: Import path errors, deleted files, or incorrect module resolution
- **Solution**: Fix import paths, ensure files exist

#### **Circular Dependency**
- **Symptom**: HMR updates cause infinite reload loops
- **Cause**: Circular imports between modules
- **Solution**: Refactor to remove circular dependencies

#### **State Loss**
- **Symptom**: Application state resets after HMR update
- **Cause**: Component remounting instead of updating (common with class components)
- **Solution**: Use functional components with hooks, or handle remounting gracefully

## HMR in Next.js (Agent Registration App)

### How Next.js HMR Works

1. **Turbopack**: Next.js uses Turbopack (or Webpack) to bundle modules
2. **File Watching**: Watches for file changes in `src/`, `app/`, `components/`, etc.
3. **Incremental Compilation**: Only recompiles changed files and their dependencies
4. **WebSocket Server**: Next.js dev server maintains WebSocket connections with browsers
5. **Module Replacement**: Sends updated modules to browsers via WebSocket

### HMR Indicators in Logs

When HMR is working correctly, you'll see:
- `✓ Compiled` - Module compiled successfully
- `○ Compiling` - Module is being compiled
- `Ready` - Server is ready to accept connections
- `Turbopack` - Using Turbopack bundler (faster HMR)

### Checking HMR Status

**Browser Console:**
- Open browser DevTools (F12)
- Check Console tab for HMR messages
- Look for: `[HMR] connected` or `[Fast Refresh]`

**Network Tab:**
- Open DevTools → Network tab
- Filter by "WS" (WebSocket)
- You should see a WebSocket connection to `/_next/webpack-hmr` or similar

**Logs:**
```bash
tail -f .agent-registration.log
# Look for compilation messages when you save files
```

## Troubleshooting HMR Issues

### HMR Not Working

1. **Check if dev server is running:**
   ```bash
   pnpm status
   ```

2. **Verify watch mode is enabled:**
   ```bash
   pnpm check:watch
   ```

3. **Check browser console for errors:**
   - Open DevTools → Console
   - Look for HMR-related errors

4. **Check network connectivity:**
   - Ensure WebSocket connections aren't blocked
   - Check firewall settings

5. **Restart dev server:**
   ```bash
   pnpm stop
   pnpm dev:all
   ```

### Common HMR Error Messages

| Error Message | Meaning | Solution |
|--------------|---------|----------|
| `[HMR] Failed to reload` | Module update failed | Fix syntax/type errors |
| `WebSocket connection closed` | Connection lost | Restart dev server |
| `Cannot find module` | Import error | Fix import paths |
| `Fast Refresh: full reload` | Component remounted | Check component structure |
| `HMR update failed: ...` | Update error | Check error details in console |

## HMR vs Full Reload

### Hot Module Replacement (HMR)
- ✅ Preserves application state
- ✅ Updates only changed modules
- ✅ Instant updates (milliseconds)
- ✅ No page refresh needed
- ✅ Better developer experience

### Full Page Reload
- ❌ Loses application state
- ❌ Reloads entire page
- ❌ Slower (seconds)
- ❌ Requires page refresh
- ⚠️ Used when HMR fails or for certain changes

## Best Practices

1. **Use Functional Components**: Better HMR support than class components
2. **Avoid Side Effects in Module Scope**: Can cause HMR issues
3. **Keep Components Pure**: Easier for HMR to update
4. **Handle Errors Gracefully**: Errors can break HMR, so catch and handle them
5. **Monitor Console**: Watch for HMR warnings/errors

## Related Documentation

- [Next.js Fast Refresh](https://nextjs.org/docs/architecture/fast-refresh)
- [Webpack HMR](https://webpack.js.org/concepts/hot-module-replacement/)
- [React Fast Refresh](https://github.com/facebook/react/blob/main/packages/react-refresh/README.md)

