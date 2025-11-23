# Subdomain Deployment Guide - POA Association

**Last Updated:** 2025-11-23
**Purpose:** Complete guide for setting up wildcard subdomain routing with Cloudflare

---

## Overview

Your app currently works with query parameter testing (`?subdomain=markland`). This guide will help you deploy with real subdomain routing like:
- `markland.poassociation.com`
- `whispering-pines.poassociation.com`
- `apex.poassociation.com`

---

## Prerequisites

- [x] Domain registered: `poassociation.com`
- [ ] Cloudflare account (free tier works!)
- [ ] Hosting platform that supports wildcard routing (see options below)
- [ ] App code deployed (subdomain functionality already implemented!)

---

## Step 1: Choose Hosting Platform

### ⚠️ Replit Limitations
Replit **does not support wildcard subdomains** on custom domains. You'll need to migrate to one of these platforms:

### Recommended Options

#### Option A: Vercel (Easiest, Next.js optimized)
- ✅ Free tier available
- ✅ Wildcard domains on Pro plan ($20/month)
- ✅ Auto SSL with Let's Encrypt
- ✅ Great for React/Vite apps
- ❌ Requires Pro for wildcard domains

**Deployment:**
```bash
npm install -g vercel
vercel login
vercel --prod
```

#### Option B: Railway (Great for full-stack apps)
- ✅ Free tier: $5/month credit
- ✅ Supports wildcard domains
- ✅ PostgreSQL included
- ✅ Easy Docker deployment
- ✅ Environment variables in dashboard

**Deployment:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

#### Option C: Fly.io (Most flexible)
- ✅ Free tier: 3 VMs included
- ✅ Full wildcard support
- ✅ Global edge deployment
- ✅ PostgreSQL add-on available

**Deployment:**
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Deploy
fly launch
fly deploy
```

#### Option D: DigitalOcean App Platform
- ✅ Simple deployment
- ✅ Wildcard subdomain support
- ✅ $5/month starter tier
- ✅ Managed PostgreSQL available

---

## Step 2: Cloudflare DNS Setup

### 2.1 Add Domain to Cloudflare

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click **"Add a Site"**
3. Enter `poassociation.com`
4. Choose **Free** plan
5. Cloudflare will scan existing DNS records

### 2.2 Update Nameservers at Domain Registrar

Cloudflare will provide 2 nameservers like:
```
ns1.cloudflare.com
ns2.cloudflare.com
```

Go to your domain registrar (GoDaddy, Namecheap, etc.) and update nameservers to Cloudflare's.

**⏱️ Wait 5-30 minutes** for nameserver propagation.

### 2.3 Configure DNS Records

Once nameservers are active, add these DNS records in Cloudflare:

#### If Using Vercel/Railway/Fly (CNAME):

| Type  | Name | Target                          | Proxy Status |
|-------|------|---------------------------------|--------------|
| CNAME | @    | your-app.vercel.app             | ☁️ Proxied   |
| CNAME | *    | your-app.vercel.app             | ☁️ Proxied   |
| CNAME | www  | your-app.vercel.app             | ☁️ Proxied   |

**Replace** `your-app.vercel.app` with:
- Vercel: `your-project.vercel.app`
- Railway: `your-app.railway.app`
- Fly.io: `your-app.fly.dev`

#### If Using VPS/DigitalOcean (A Record):

| Type | Name | Target         | Proxy Status |
|------|------|----------------|--------------|
| A    | @    | YOUR_SERVER_IP | ☁️ Proxied   |
| A    | *    | YOUR_SERVER_IP | ☁️ Proxied   |
| A    | www  | YOUR_SERVER_IP | ☁️ Proxied   |

### 2.4 SSL/TLS Configuration

1. In Cloudflare, go to **SSL/TLS** → **Overview**
2. Set SSL mode to **"Full (strict)"** or **"Full"**
3. Go to **SSL/TLS** → **Edge Certificates**
4. Ensure these are enabled:
   - ✅ **Always Use HTTPS** - ON
   - ✅ **Automatic HTTPS Rewrites** - ON
   - ✅ **Universal SSL** - Active (includes wildcard!)

**Cloudflare automatically provides a free wildcard SSL certificate!** 🎉

---

## Step 3: Update Environment Variables

### On Your Hosting Platform

Set these environment variables in your hosting dashboard:

```bash
# Database (if not using hosting platform's database)
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Session secret (generate a random string)
SESSION_SECRET=your-super-secret-random-string-here

# Node environment
NODE_ENV=production

# Super admin emails (semicolon separated)
SUPER_ADMIN_EMAILS=your-email@example.com;admin@poassociation.com

# Replit OAuth (if still using)
REPL_ID=your-repl-id
ISSUER_URL=https://replit.com/oidc
```

### Generate Session Secret

```bash
# Use this command to generate a secure random string:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 4: Database Migration

### Option A: Keep Using Neon PostgreSQL
Your existing `DATABASE_URL` should work fine. No changes needed!

### Option B: Use Hosting Platform's Database

#### Railway:
```bash
railway add postgresql
# Copy the DATABASE_URL from dashboard
```

#### Fly.io:
```bash
fly postgres create
fly postgres attach
```

### Run Database Push

After deployment, ensure schema is up to date:

```bash
npm run db:push
```

---

## Step 5: Configure Custom Domain in Hosting Platform

### Vercel

1. Go to **Settings** → **Domains**
2. Add both:
   - `poassociation.com`
   - `*.poassociation.com` (requires Pro plan)
3. Vercel will provide CNAME targets

### Railway

1. Go to **Settings** → **Domains**
2. Click **"Custom Domain"**
3. Add `poassociation.com`
4. Add wildcard: `*.poassociation.com`
5. Railway shows DNS configuration needed

### Fly.io

1. Add certificate:
   ```bash
   fly certs create poassociation.com
   fly certs create *.poassociation.com
   ```
2. Fly will show DNS records to add

---

## Step 6: Test Subdomain Routing

### Test DNS Propagation

```bash
# Check if wildcard DNS is working
dig markland.poassociation.com
dig whispering-pines.poassociation.com

# Should show your hosting platform's IP or CNAME
```

### Test in Browser

1. **Test Main Domain:**
   ```
   https://poassociation.com
   ```
   Should show landing page

2. **Test Demo Subdomain:**
   ```
   https://poassociation.com/demo
   ```
   Enter TEST2024, log in as Emily

3. **Test Markland Subdomain:**
   ```
   https://markland.poassociation.com/dashboard
   ```
   Should auto-select Markland POA tenant
   - ✅ Tenant switcher should be hidden
   - ✅ Header should show "markland.poassociation.com"

4. **Test Whispering Pines Subdomain:**
   ```
   https://whispering-pines.poassociation.com/dashboard
   ```
   Should auto-select Whispering Pines HOA tenant

5. **Test Apex Management Subdomain:**
   ```
   https://apex.poassociation.com/dashboard
   ```
   Should auto-select Apex Management company

### Check Browser Console

Open DevTools → Network tab:
- Verify requests to `/api/subdomain` return correct subdomain
- Check that session cookies are being sent
- Ensure no CORS errors

---

## Step 7: Update Demo Codes (If Needed)

If you want to provision new demo codes for production:

```bash
# SSH into your production server or use hosting CLI
node -e "
const { storage } = require('./dist/storage.js');
// Create new demo code
storage.createDemoCode({
  code: 'PROD2024',
  label: 'Production Demo',
  validFrom: new Date(),
  validUntil: new Date('2025-12-31'),
  maxUses: 100
}).then(console.log);
"
```

Or use the Super Admin UI at:
```
https://poassociation.com/admin/demo-codes
```

---

## Troubleshooting

### Issue: Subdomain not detected

**Check:**
1. DNS propagation: `dig markland.poassociation.com`
2. Server logs for subdomain middleware output
3. Cloudflare proxy status (should be ☁️ Proxied)

**Solution:**
- Wait for DNS propagation (up to 24 hours, usually < 1 hour)
- Verify wildcard record exists in Cloudflare
- Clear browser cache

### Issue: SSL certificate errors

**Check:**
- Cloudflare SSL mode is "Full" or "Full (strict)"
- Universal SSL is active in Cloudflare
- Hosting platform has SSL certificate

**Solution:**
- Wait 15-30 minutes for Cloudflare SSL to activate
- Ensure hosting platform supports SSL
- Try "Full" mode instead of "Full (strict)"

### Issue: 401 Unauthorized errors

**Check:**
- `NODE_ENV=production` is set
- Session secret is configured
- Cookie settings allow HTTPS

**Solution:**
- Verify environment variables in hosting dashboard
- Check that `secure` flag is true in production (session cookie config)
- Ensure `sameSite: 'lax'` is set

### Issue: Wrong tenant selected

**Check:**
- Browser console shows correct subdomain
- `/api/subdomain` endpoint returns expected value
- Tenant subdomain in database matches URL

**Solution:**
- Verify tenant subdomains in database
- Check case sensitivity (should be case-insensitive)
- Clear localStorage and cookies

---

## Rollback Plan

If something goes wrong:

1. **Revert DNS:**
   - Remove wildcard CNAME in Cloudflare
   - Point @ record back to Replit

2. **Use Query Parameter:**
   - App still works with `?subdomain=markland`
   - Users can access via query param until fixed

3. **Check Logs:**
   ```bash
   # Railway
   railway logs

   # Vercel
   vercel logs

   # Fly.io
   fly logs
   ```

---

## Post-Deployment Checklist

- [ ] DNS records configured in Cloudflare
- [ ] Nameservers updated at registrar
- [ ] SSL/TLS set to "Full (strict)" in Cloudflare
- [ ] Universal SSL active and showing wildcard certificate
- [ ] App deployed to hosting platform
- [ ] Environment variables configured
- [ ] Database migrated (`npm run db:push`)
- [ ] Custom domain added in hosting platform
- [ ] Tested main domain: `poassociation.com`
- [ ] Tested wildcard: `markland.poassociation.com`
- [ ] Tenant switcher hidden when using subdomain
- [ ] Session cookies working (check `/api/debug/session`)
- [ ] Demo codes working
- [ ] Super admin access working

---

## Quick Reference

### Cloudflare DNS Records
```
Type    Name    Target                      Proxy
CNAME   @       your-app.railway.app        ☁️ Proxied
CNAME   *       your-app.railway.app        ☁️ Proxied
CNAME   www     your-app.railway.app        ☁️ Proxied
```

### Testing Commands
```bash
# Test DNS
dig markland.poassociation.com

# Test SSL
curl -I https://markland.poassociation.com

# Test subdomain detection
curl https://markland.poassociation.com/api/subdomain

# Check database
npm run db:push
```

### Useful Links
- [Cloudflare Dashboard](https://dash.cloudflare.com)
- [Railway Dashboard](https://railway.app/dashboard)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [Fly.io Dashboard](https://fly.io/dashboard)

---

## Need Help?

**Common Issues:**
1. DNS not propagating → Wait 1-24 hours, check with `dig`
2. SSL errors → Verify Cloudflare SSL mode is "Full"
3. Subdomain not working → Check wildcard CNAME exists
4. 401 errors → Verify `NODE_ENV=production` and session secret

**Resources:**
- Cloudflare SSL docs: https://developers.cloudflare.com/ssl/
- DNS propagation checker: https://www.whatsmydns.net/

---

**Good luck with deployment! 🚀**

You can always fall back to `?subdomain=markland` query parameters if you run into issues.
