@echo off
REM Setup script to create .env files from examples (Windows)

echo Setting up environment files...

REM Backend .env
if not exist "backend\.env" (
    if exist "backend\env.example" (
        copy "backend\env.example" "backend\.env" >nul
        echo ✓ Created backend\.env from env.example
    ) else (
        echo Creating backend\.env...
        (
            echo # Server Configuration
            echo PORT=5000
            echo NODE_ENV=development
            echo.
            echo # MongoDB
            echo MONGODB_URI=mongodb://localhost:27017/lms
            echo.
            echo # JWT Secret
            echo JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
            echo.
            echo # Stripe Payment
            echo STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
            echo STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
            echo.
            echo # Email Configuration (Nodemailer)
            echo SMTP_HOST=smtp.gmail.com
            echo SMTP_PORT=587
            echo SMTP_USER=your-email@gmail.com
            echo SMTP_PASS=your-app-password
            echo.
            echo # Zoom API (Optional)
            echo ZOOM_API_KEY=your_zoom_api_key
            echo ZOOM_API_SECRET=your_zoom_api_secret
            echo ZOOM_ACCESS_TOKEN=your_zoom_access_token
            echo.
            echo # Frontend URL
            echo FRONTEND_URL=http://localhost:3000
        ) > "backend\.env"
        echo ✓ Created backend\.env
    )
) else (
    echo ⚠ backend\.env already exists, skipping...
)

REM Frontend .env
if not exist "frontend\.env" (
    if exist "frontend\env.example" (
        copy "frontend\env.example" "frontend\.env" >nul
        echo ✓ Created frontend\.env from env.example
    ) else (
        echo Creating frontend\.env...
        echo VITE_API_URL=http://localhost:5000/api > "frontend\.env"
        echo ✓ Created frontend\.env
    )
) else (
    echo ⚠ frontend\.env already exists, skipping...
)

echo.
echo Setup complete! Please edit the .env files with your configuration.
echo Minimum required for backend\.env:
echo   - MONGODB_URI
echo   - JWT_SECRET

pause

