# 🚀 MicroBima Development Scripts Guide

This guide explains how to use the development scripts for the MicroBima project.

## 📁 **Where to Run Scripts**

### ✅ **Run from Project Root**
```bash
cd /home/judeokello/Projects/microbima/
pnpm dev:all    # ✅ Works
pnpm dev:api    # ✅ Works  
pnpm dev:agent  # ✅ Works
pnpm stop       # ✅ Works
pnpm status     # ✅ Works
```

### ✅ **Run from API Directory**
```bash
cd /home/judeokello/Projects/microbima/apps/api/
pnpm dev:all    # ✅ Works
pnpm dev:api    # ✅ Works  
pnpm dev:agent  # ✅ Works
pnpm stop       # ✅ Works
pnpm status     # ✅ Works
```

### ✅ **Run from Agent Registration Directory**
```bash
cd /home/judeokello/Projects/microbima/apps/agent-registration/
pnpm dev:all    # ✅ Works
pnpm dev:api    # ✅ Works  
pnpm dev:agent  # ✅ Works
pnpm stop       # ✅ Works
pnpm status     # ✅ Works
```

**The scripts work from project root and both application directories using relative paths.**

### 🔧 **How It Works**

The scripts are available in three locations:

1. **Project Root** (`/home/judeokello/Projects/microbima/`):
   - Direct script execution: `./start-dev.sh`
   - pnpm scripts: `pnpm dev:all`

2. **API Directory** (`/home/judeokello/Projects/microbima/apps/api/`):
   - Relative path execution: `../../start-dev.sh`
   - pnpm scripts: `pnpm dev:all`

3. **Agent Registration Directory** (`/home/judeokello/Projects/microbima/apps/agent-registration/`):
   - Relative path execution: `../../start-dev.sh`
   - pnpm scripts: `pnpm dev:all`

**All scripts point to the same shell scripts in the project root using relative paths.**

---

## 🔧 **Available Commands**

| Command | Description | Port | Behavior |
|---------|-------------|------|----------|
| `pnpm dev:all` | Start both applications | 3000, 3001 | Smart startup with port checking |
| `pnpm dev:api` | Start API only | 3001 | Fails if port occupied |
| `pnpm dev:agent` | Start Agent Registration only | 3000 | Fails if port occupied |
| `pnpm stop` | Stop all applications | - | Kills processes on both ports |
| `pnpm status` | Check application status | - | Shows detailed status |

---

## 🚨 **Port Conflict Behavior**

### **Scenario 1: Both Applications Already Running**
```bash
$ pnpm dev:all
🚀 Starting MicroBima Development Environment...
⚠️  Port 3001 is already in use (API might be running)
⚠️  Port 3000 is already in use (Agent Registration might be running)
✅ Both applications appear to be already running!
📡 API: http://localhost:3001
🌐 Agent Registration: http://localhost:3000
🛑 Use 'pnpm stop' to stop all applications first
```

### **Scenario 2: Only API Running, Start Both**
```bash
$ pnpm dev:all
🚀 Starting MicroBima Development Environment...
⚠️  Port 3001 is already in use (API might be running)
⏭️  Skipping API startup (already running)
🌐 Starting Agent Registration app...
✅ Both applications are running!
```

### **Scenario 3: Only Agent Running, Start Both**
```bash
$ pnpm dev:all
🚀 Starting MicroBima Development Environment...
⚠️  Port 3000 is already in use (Agent Registration might be running)
🔧 Starting API server...
⏭️  Skipping Agent Registration startup (already running)
✅ Both applications are running!
```

### **Scenario 4: Start Individual App When Port Occupied**
```bash
$ pnpm dev:api
🔧 Starting API server on port 3001...
⚠️  Port 3001 is already in use!
🔍 Checking what's using the port...
node    3102212  root   17u  IPv4 1234567      0t0  TCP *:3001 (LISTEN)
🛑 Please stop the existing process or use 'pnpm stop'
```

---

## 📊 **Status Checking**

### **Check Application Status**
```bash
$ pnpm status
🔍 MicroBima Development Environment Status
==========================================

✅ API Server (Port 3001): RUNNING
   Process: node 3102212
   URL: http://localhost:3001
   Health: ✅ Healthy

✅ Agent Registration (Port 3000): RUNNING
   Process: node 3102213
   URL: http://localhost:3000
   Health: ✅ Responding

📊 Summary:
🎉 Both applications are running!
🚀 Ready for development
```

### **Health Checks**
- **API Server**: Tests `/api/health` endpoint
- **Agent Registration**: Tests root URL response
- **Status**: Shows if services are responding properly

---

## 🛑 **Stopping Applications**

### **Stop All Applications**
```bash
$ pnpm stop
🛑 Stopping MicroBima Development Environment...
🔧 Stopping API server (port 3001)...
🌐 Stopping Agent Registration app (port 3000)...
🧹 Cleaning up remaining processes...
✅ Development environment stopped!
```

### **What Gets Stopped**
- Processes on port 3000 (Agent Registration)
- Processes on port 3001 (API Server)
- Any remaining `nest start`, `next dev`, or `pnpm dev` processes

---

## 🔄 **Common Workflows**

### **Start Fresh Development Session**
```bash
# 1. Stop any running applications
pnpm stop

# 2. Start both applications
pnpm dev:all

# 3. Check status
pnpm status
```

### **Start Individual Application**
```bash
# Start only API for backend development
pnpm dev:api

# Start only Agent Registration for frontend development
pnpm dev:agent
```

### **Quick Status Check**
```bash
# Check what's running
pnpm status
```

### **Emergency Stop**
```bash
# Kill everything and start fresh
pnpm stop
pnpm dev:all
```

---

## 🔧 **Script Details**

### **start-dev.sh** (Smart Startup)
- Checks if ports are already in use
- Skips startup for already running applications
- Starts only what's needed
- Provides detailed feedback

### **start-api.sh** (API Only)
- Checks port 3001 availability
- Shows process details if port is occupied
- Fails gracefully with helpful error message

### **start-agent.sh** (Agent Only)
- Checks port 3000 availability
- Shows process details if port is occupied
- Fails gracefully with helpful error message

### **stop-dev.sh** (Clean Shutdown)
- Kills processes on both ports
- Cleans up any remaining development processes
- Provides confirmation of shutdown

### **check-status.sh** (Status Monitoring)
- Shows detailed status of both applications
- Performs health checks
- Provides summary and recommendations
- Lists available commands

---

## 💡 **Tips & Best Practices**

1. **Always run from project root** - Scripts won't work from subdirectories
2. **Use `pnpm status`** - Check what's running before starting new processes
3. **Use `pnpm stop`** - Clean shutdown prevents port conflicts
4. **Use `pnpm dev:all`** - Smart startup handles partial running states
5. **Check logs** - If something fails, check the terminal output for details

---

## 🆘 **Troubleshooting**

### **Port Still Occupied After Stop**
```bash
# Check what's using the port
lsof -i:3000
lsof -i:3001

# Kill specific process
kill -9 <PID>
```

### **Scripts Not Found**
```bash
# Make sure you're in one of these directories:
pwd
# Should show one of:
# /home/judeokello/Projects/microbima/
# /home/judeokello/Projects/microbima/apps/api/
# /home/judeokello/Projects/microbima/apps/agent-registration/

# Check if scripts exist from project root
ls -la *.sh

# Check if scripts are accessible from subdirectories
ls -la ../../*.sh
```

### **Permission Denied**
```bash
# Make scripts executable
chmod +x *.sh
```

### **API Not Responding**
```bash
# Check if API is actually running
curl http://localhost:3001/api/health

# Check API logs in the terminal where you started it
```
