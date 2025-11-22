# Quick Start Guide - Fix Login Issues

## Step 1: Make sure MongoDB is running

**Option A: Local MongoDB**
- Start MongoDB service on your computer
- Default connection: `mongodb://localhost:27017/lms`

**Option B: MongoDB Atlas (Cloud)**
- Sign up at https://www.mongodb.com/cloud/atlas
- Create a free cluster
- Get connection string and update in `.env`

## Step 2: Create Backend .env file

```bash
cd backend
```

Create `.env` file with minimum required settings:

```env
MONGODB_URI=mongodb://localhost:27017/lms
JWT_SECRET=your-random-secret-key-here
PORT=5000
```

**Windows:**
```cmd
copy env.example .env
```

**Mac/Linux:**
```bash
cp env.example .env
```

Then edit `.env` and set:
- `MONGODB_URI` - Your MongoDB connection string
- `JWT_SECRET` - Any random string (e.g., `my-secret-key-123`)

## Step 3: Install Backend Dependencies

```bash
cd backend
npm install
```

## Step 4: Seed the Database

This creates the demo accounts:

```bash
cd backend
node seed.js
```

You should see:
```
Connected to MongoDB
Database seeded successfully!

Demo Accounts:
Root Admin: admin@lms.com / admin123
School Admin: schooladmin@lms.com / admin123
Teacher: teacher@lms.com / teacher123
Personal Teacher: personalteacher@lms.com / teacher123
Student: student@lms.com / student123
```

## Step 5: Start Backend Server

```bash
cd backend
npm run dev
```

You should see:
```
MongoDB Connected
Server running on port 5000
```

## Step 6: Start Frontend (in a new terminal)

```bash
cd frontend
npm install  # if not done already
npm run dev
```

## Step 7: Login

Go to http://localhost:3000 and login with:
- **Email:** `admin@lms.com`
- **Password:** `admin123`

Or any other demo account from Step 4.

## Troubleshooting Login Issues

### "Invalid credentials" error

1. **Check if backend is running:**
   - Open http://localhost:5000/api/health
   - Should show: `{"status":"OK","message":"LMS API is running"}`

2. **Check if database is seeded:**
   ```bash
   cd backend
   node seed.js
   ```
   If you see errors, check MongoDB connection.

3. **Verify MongoDB connection:**
   - Make sure MongoDB is running
   - Check `MONGODB_URI` in `backend/.env` is correct

4. **Check browser console (F12):**
   - Look for network errors
   - Check if API calls are reaching the backend

5. **Verify credentials:**
   - Use exact email: `admin@lms.com` (not `Admin@lms.com`)
   - Use exact password: `admin123`

### Backend not starting

- Check if port 5000 is already in use
- Verify `.env` file exists in `backend/` directory
- Check MongoDB connection string is correct

### Database connection error

- Make sure MongoDB is installed and running
- For local MongoDB: `mongod` should be running
- For MongoDB Atlas: Check connection string and network access

## Common Issues

**"Cannot connect to MongoDB"**
- Start MongoDB service
- Check connection string in `.env`
- Verify MongoDB is accessible

**"Port 5000 already in use"**
- Change `PORT` in `backend/.env` to another port (e.g., 5001)
- Update `VITE_API_URL` in `frontend/.env` accordingly

**"Module not found"**
- Run `npm install` in both `backend/` and `frontend/` directories

