# Troubleshooting Guide

## Blank Page Issues

### 1. Check Browser Console
Open your browser's developer tools (F12) and check the Console tab for any errors.

### 2. Verify Dependencies are Installed
```bash
cd frontend
npm install
```

### 3. Check if Backend is Running
The frontend needs the backend API to be running. Make sure:
- Backend server is running on port 5000
- MongoDB is connected
- Backend `.env` file is configured

### 4. Check Environment Variables
Make sure `frontend/.env` exists with:
```
VITE_API_URL=http://localhost:5000/api
```

### 5. Clear Browser Cache
- Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
- Or clear browser cache and reload

### 6. Check PostCSS/Tailwind Configuration
Make sure `postcss.config.js` exists in the frontend directory.

### 7. Common Issues

#### Issue: "Cannot find module"
**Solution:** Run `npm install` in the frontend directory

#### Issue: "Network Error" or "Connection Refused"
**Solution:** 
- Make sure backend is running: `cd backend && npm run dev`
- Check backend is on port 5000
- Verify `VITE_API_URL` in frontend/.env

#### Issue: White screen with no errors
**Solution:**
- Check browser console for React errors
- Verify all imports are correct
- Make sure all page components exist

#### Issue: "useAuth must be used within AuthProvider"
**Solution:** This should be fixed now, but if you see this:
- Make sure `App.jsx` wraps everything in `<AuthProvider>`
- Check that components use `useAuth()` hook, not `useContext(AuthContext)`

### 8. Development Server Issues

If `npm run dev` doesn't work:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Try again
npm run dev
```

### 9. Check File Structure
Make sure these files exist:
- `frontend/src/main.jsx`
- `frontend/src/App.jsx`
- `frontend/src/index.css`
- `frontend/index.html`
- `frontend/vite.config.js`
- `frontend/tailwind.config.js`
- `frontend/postcss.config.js`

### 10. Port Already in Use
If port 3000 is already in use:
- Change port in `vite.config.js`:
```js
server: {
  port: 3001, // or any available port
}
```

## Still Having Issues?

1. Check the browser console for specific error messages
2. Verify all dependencies are installed: `npm list`
3. Make sure Node.js version is 16 or higher: `node --version`
4. Try deleting `node_modules` and `package-lock.json`, then reinstall

