# Ngrok Setup Guide for M-Pesa Testing

## What is Ngrok?

**Ngrok is a tunneling service** that creates a secure tunnel from the internet to your local machine. It's like giving your localhost a public URL that M-Pesa can reach.

### How It Works

```
┌─────────────────┐         ┌──────────┐         ┌─────────────────┐
│   M-Pesa API    │  ────>  │  Ngrok   │  ────>  │  Your Localhost  │
│   (Safaricom)   │         │  Tunnel  │         │  (localhost:3001)│
└─────────────────┘         └──────────┘         └─────────────────┘
```

1. **You start ngrok**: It creates a public URL (e.g., `https://abc123.ngrok.io`)
2. **Ngrok forwards requests**: Any request to `https://abc123.ngrok.io` gets forwarded to your `localhost:3001`
3. **M-Pesa sends callbacks**: M-Pesa can now reach your local API through the ngrok URL

### Important: Ngrok Does NOT Replace M-Pesa Credentials

**You still need ALL M-Pesa credentials:**
- ✅ `MPESA_CONSUMER_KEY` - Required to authenticate with M-Pesa API
- ✅ `MPESA_CONSUMER_SECRET` - Required to authenticate with M-Pesa API
- ✅ `MPESA_BUSINESS_SHORT_CODE` - Your business identifier
- ✅ `MPESA_PASSKEY` - Required for STK Push password generation

**Ngrok only solves ONE problem**: Making your localhost accessible to M-Pesa's servers.

**Why you need ngrok:**
- M-Pesa servers are on the internet
- Your localhost (`http://localhost:3001`) is only accessible on your machine
- M-Pesa needs to send callbacks to your API when payments happen
- Ngrok bridges this gap by giving you a public URL

## M-Pesa Sandbox Business Short Code

**For M-Pesa Sandbox (testing):**
- **Business Short Code**: `174379` (this is the standard test shortcode)

**For M-Pesa Production:**
- **Business Short Code**: Your actual business shortcode from Safaricom (different for each business)

## Setup Instructions

### Step 1: Install Ngrok

**Linux (Fedora):**
```bash
# Download ngrok
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz

# Extract
tar -xzf ngrok-v3-stable-linux-amd64.tgz

# Move to /usr/local/bin (or keep in your PATH)
sudo mv ngrok /usr/local/bin/

# Verify installation
ngrok version
```

**Alternative: Using package manager (if available)**
```bash
# Check if available in your package manager
dnf search ngrok
# Or
flatpak install ngrok
```

### Step 1.5: Configure Ngrok with Your Authtoken

**Important**: Ngrok requires authentication. You need to add your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken

```bash
# Add your authtoken (replace YOUR_AUTHTOKEN with your actual token)
ngrok config add-authtoken YOUR_AUTHTOKEN

# Verify configuration
ngrok config check
```

**Where to get your authtoken:**
1. Go to https://dashboard.ngrok.com/get-started/your-authtoken
2. Sign up or log in
3. Copy your authtoken
4. Run the command above

### Step 2: Start Your API Locally

```bash
cd /home/judeokello/Projects/microbima/apps/api
pnpm start:dev
```

Your API should be running on `http://localhost:3001` (or whatever port you configured).

### Step 3: Start Ngrok Tunnel

**In a new terminal window:**

```bash
# Start ngrok tunnel pointing to your API port
ngrok http 3001
```

**Output will look like:**
```
ngrok                                                                        

Session Status                online
Account                       Your Account (Plan: Free)
Version                       3.x.x
Region                        United States (us)
Latency                       45ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok-free.app -> http://localhost:3001

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

**Important**: Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

### Step 4: Update Your .env File

Add the ngrok URL to your callback URLs:

```bash
# In apps/api/.env
MPESA_STK_PUSH_CALLBACK_URL=https://abc123.ngrok-free.app/api/public/mpesa/stk-push/callback
MPESA_IPN_CONFIRMATION_URL=https://abc123.ngrok-free.app/api/public/mpesa/confirmation
```

**Note**: 
- The ngrok URL changes every time you restart ngrok (unless you have a paid plan with fixed domain)
- You'll need to update your `.env` file each time you restart ngrok
- Or use ngrok's web interface at `http://127.0.0.1:4040` to see requests in real-time

### Step 5: Restart Your API

After updating `.env`, restart your API to pick up the new callback URLs:

```bash
# Stop your API (Ctrl+C) and restart
cd /home/judeokello/Projects/microbima/apps/api
pnpm start:dev
```

## Testing the Setup

### 1. Test Ngrok is Working

```bash
# In another terminal, test that ngrok is forwarding requests
curl https://abc123.ngrok-free.app/api/health
```

You should get a response from your local API.

### 2. Test STK Push

```bash
curl -X POST https://abc123.ngrok-free.app/api/internal/mpesa/stk-push/test \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "254722000000",
    "amount": 100.00,
    "accountReference": "POL123456",
    "transactionDesc": "Test payment"
  }'
```

### 3. Monitor Requests

Open ngrok's web interface in your browser:
```
http://127.0.0.1:4040
```

This shows:
- All incoming requests
- Request/response details
- Replay requests for debugging

## Important Notes

### Free Ngrok Limitations

1. **URL Changes**: Free ngrok URLs change every time you restart ngrok
   - **Solution**: Update `.env` file each time, or get a paid plan for fixed domain

2. **Session Timeout**: Free sessions may timeout after inactivity
   - **Solution**: Keep ngrok running while testing

3. **Request Limits**: Free tier has request limits
   - **Solution**: Usually fine for testing, upgrade if needed

### Ngrok Alternatives

If ngrok doesn't work for you, alternatives:
- **localtunnel**: `npx localtunnel --port 3001`
- **serveo**: `ssh -R 80:localhost:3001 serveo.net`
- **Cloudflare Tunnel**: Free, more stable
- **Deploy to staging**: Use your staging environment for testing

### Production/Staging

**You don't need ngrok for staging/production** because:
- Your API is already publicly accessible (e.g., `maishapoa-staging-internal-api.fly.dev`)
- Just use the actual Fly.io URL in your callback URLs

## Troubleshooting

### Error: "ngrok: command not found"
- **Solution**: Make sure ngrok is in your PATH or use full path: `/usr/local/bin/ngrok`

### Error: "Tunnel not found"
- **Solution**: Make sure ngrok is running and pointing to the correct port

### Error: "Connection refused"
- **Solution**: Make sure your API is running on the port ngrok is forwarding to (3001)

### M-Pesa callbacks not received
- **Solution**: 
  1. Check ngrok is running
  2. Verify callback URLs in `.env` match ngrok URL
  3. Check ngrok web interface (`http://127.0.0.1:4040`) to see if requests are arriving
  4. Check your API logs for incoming requests

## Quick Reference

```bash
# Start ngrok
ngrok http 3001

# View ngrok web interface
open http://127.0.0.1:4040

# Test ngrok is working
curl https://your-ngrok-url.ngrok-free.app/api/health

# Update .env with ngrok URL
MPESA_STK_PUSH_CALLBACK_URL=https://your-ngrok-url.ngrok-free.app/api/public/mpesa/stk-push/callback
MPESA_IPN_CONFIRMATION_URL=https://your-ngrok-url.ngrok-free.app/api/public/mpesa/confirmation
```

