# Connection Timeout Troubleshooting Guide

If you're experiencing connection timeouts when trying to register or use the application, follow these steps:

## Quick Checks

### 1. Verify Backend is Running

**For Render:**
- Go to your Render dashboard
- Check if your backend service status is "Live" (green)
- If it shows "Sleeping" or "Stopped", click "Manual Deploy" or wait for it to wake up
- **Note**: Free tier on Render spins down after 15 minutes of inactivity

**For Railway:**
- Check your Railway dashboard
- Ensure the service is running

**Test Backend Directly:**
- Open your backend URL in a browser: `https://your-backend.onrender.com`
- You should see JSON with API information
- Try the health endpoint: `https://your-backend.onrender.com/api/health`
- Should return: `{"status": "OK", "message": "LMS API is running"}`

### 2. Check Environment Variables

**In Vercel (Frontend):**
1. Go to your project → Settings → Environment Variables
2. Verify `VITE_API_URL` is set to: `https://your-backend.onrender.com/api`
3. Make sure there are no trailing slashes
4. **Important**: After updating, you must redeploy the frontend

**In Render (Backend):**
1. Go to your service → Environment
2. Verify all required variables are set:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `FRONTEND_URL` (should match your Vercel URL)
   - `SMTP_USER` and `SMTP_PASS` (for email)

### 3. Check Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Try to register
4. Look for error messages that show:
   - The API URL being used
   - Network errors
   - CORS errors

### 4. Common Issues and Solutions

#### Issue: "Connection timeout" or "ECONNABORTED"

**Possible Causes:**
- Backend is sleeping (Render free tier)
- Backend is down or crashed
- Network issues
- Backend URL is incorrect

**Solutions:**
1. **Wake up Render backend**: Visit your backend URL directly in a browser to wake it up
2. **Check backend logs**: In Render dashboard → Logs, check for errors
3. **Verify URL**: Ensure `VITE_API_URL` in Vercel matches your backend URL exactly
4. **Wait a moment**: First request after sleep can take 30-60 seconds

#### Issue: "ERR_NETWORK" or "Network Error"

**Possible Causes:**
- CORS not configured
- Backend URL is wrong
- Backend is not accessible

**Solutions:**
1. **Check CORS**: Verify `FRONTEND_URL` in backend matches your frontend URL
2. **Test backend directly**: Try accessing `https://your-backend.onrender.com/api/health` in browser
3. **Check browser console**: Look for CORS errors

#### Issue: Backend takes too long to respond

**Solutions:**
1. **First request after sleep**: Render free tier takes 30-60 seconds to wake up
2. **Upgrade Render plan**: Paid plans don't sleep
3. **Use Railway**: More reliable free tier alternative

## Step-by-Step Debugging

### Step 1: Test Backend Health

```bash
# In browser or using curl
curl https://your-backend.onrender.com/api/health
```

Expected response:
```json
{"status": "OK", "message": "LMS API is running"}
```

If this fails, your backend is not running or not accessible.

### Step 2: Check Frontend Environment

1. Open browser console
2. Type: `console.log(import.meta.env.VITE_API_URL)`
3. Should show: `https://your-backend.onrender.com/api`

If it shows `undefined` or wrong URL:
- Environment variable not set in Vercel
- Frontend not redeployed after setting variable

### Step 3: Test API Call Directly

Open browser console and run:
```javascript
fetch('https://your-backend.onrender.com/api/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

This will show if the backend is reachable from your browser.

### Step 4: Check Network Tab

1. Open DevTools → Network tab
2. Try to register
3. Look for the failed request
4. Check:
   - Request URL (should be your backend URL)
   - Status code
   - Error message
   - Timing (how long it took)

## Render Free Tier Limitations

**Important**: Render's free tier has limitations:
- Services sleep after 15 minutes of inactivity
- First request after sleep takes 30-60 seconds
- This can cause timeout errors

**Solutions:**
1. **Wait longer**: First request may take up to 60 seconds
2. **Wake up service**: Visit backend URL before using frontend
3. **Upgrade**: Consider Render paid plan ($7/month) or Railway ($5/month)
4. **Use Railway**: More reliable for production

## Quick Fixes

### Fix 1: Wake Up Backend Before Testing

1. Visit your backend URL: `https://your-backend.onrender.com`
2. Wait for it to load (may take 30-60 seconds)
3. Then try registration in your frontend

### Fix 2: Increase Timeout (Already Done)

The timeout is now set to 30 seconds. If backend takes longer, you may need to:
- Wake up the backend first
- Upgrade to a paid plan
- Use a different hosting service

### Fix 3: Verify Environment Variables

**Frontend (Vercel):**
```
VITE_API_URL=https://your-backend.onrender.com/api
```

**Backend (Render):**
```
FRONTEND_URL=https://your-frontend.vercel.app
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your-secret-key
```

## Still Having Issues?

1. **Check backend logs** in Render dashboard
2. **Check frontend logs** in Vercel dashboard
3. **Test backend directly** using curl or Postman
4. **Verify MongoDB connection** in backend logs
5. **Check CORS configuration** - ensure FRONTEND_URL matches your frontend domain

## Testing Checklist

- [ ] Backend health endpoint works: `/api/health`
- [ ] Backend root URL shows API info
- [ ] `VITE_API_URL` is set correctly in Vercel
- [ ] `FRONTEND_URL` is set correctly in Render
- [ ] Frontend has been redeployed after setting environment variables
- [ ] Backend is not sleeping (check Render dashboard)
- [ ] No CORS errors in browser console
- [ ] Network tab shows correct request URL

## Need More Help?

If issues persist:
1. Check the browser console for specific error messages
2. Check backend logs in Render for server-side errors
3. Verify all environment variables are set correctly
4. Test backend endpoints directly using Postman or curl

