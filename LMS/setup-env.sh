#!/bin/bash

# Setup script to create .env files from examples

echo "Setting up environment files..."

# Backend .env
if [ ! -f "backend/.env" ]; then
    if [ -f "backend/env.example" ]; then
        cp backend/env.example backend/.env
        echo "✓ Created backend/.env from env.example"
    else
        echo "Creating backend/.env..."
        cat > backend/.env << EOF
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/lms

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Stripe Payment
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key

# Email Configuration (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Zoom API (Optional)
ZOOM_API_KEY=your_zoom_api_key
ZOOM_API_SECRET=your_zoom_api_secret
ZOOM_ACCESS_TOKEN=your_zoom_access_token

# Frontend URL
FRONTEND_URL=http://localhost:3000
EOF
        echo "✓ Created backend/.env"
    fi
else
    echo "⚠ backend/.env already exists, skipping..."
fi

# Frontend .env
if [ ! -f "frontend/.env" ]; then
    if [ -f "frontend/env.example" ]; then
        cp frontend/env.example frontend/.env
        echo "✓ Created frontend/.env from env.example"
    else
        echo "Creating frontend/.env..."
        echo "VITE_API_URL=http://localhost:5000/api" > frontend/.env
        echo "✓ Created frontend/.env"
    fi
else
    echo "⚠ frontend/.env already exists, skipping..."
fi

echo ""
echo "Setup complete! Please edit the .env files with your configuration."
echo "Minimum required for backend/.env:"
echo "  - MONGODB_URI"
echo "  - JWT_SECRET"

