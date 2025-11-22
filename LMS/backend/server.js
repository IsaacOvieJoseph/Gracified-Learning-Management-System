const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Load models to ensure they are registered with Mongoose
require('./models/User');
require('./models/Classroom');
require('./models/Assignment');
require('./models/Topic');
require('./models/Payment');
require('./models/Notification');
require('./models/School'); // Load School model
require('./models/Tutorial'); // Load Tutorial model
require('./models/SubscriptionPlan'); // Load SubscriptionPlan model
require('./models/UserSubscription'); // Load UserSubscription model

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/classrooms', require('./routes/classrooms'));
app.use('/api/topics', require('./routes/topics'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/zoom', require('./routes/zoom'));
app.use('/api/whiteboard', require('./routes/whiteboard'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/notifications/inapp', require('./routes/notifications-inapp'));
app.use('/api/schools', require('./routes/schools'));
app.use('/api/subscription-plans', require('./routes/subscriptionPlans')); // New subscription plans route
app.use('/api/user-subscriptions', require('./routes/userSubscriptions')); // New user subscriptions route

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'LMS API is running' });
});

// Connect to MongoDB
const connectDB = async () => {
  try {
    // Fix case sensitivity issue - use lowercase 'lms'
    let mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
    mongoUri = mongoUri.replace(/\/LMS$/, '/lms');
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

