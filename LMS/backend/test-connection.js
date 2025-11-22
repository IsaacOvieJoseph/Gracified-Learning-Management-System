const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

async function testConnection() {
  try {
    console.log('Testing MongoDB connection...');
    console.log('MONGODB_URI:', process.env.MONGODB_URI || 'mongodb://localhost:27017/lms');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lms', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✓ MongoDB Connected!');
    
    // Check if users exist
    const userCount = await User.countDocuments();
    console.log(`\nUsers in database: ${userCount}`);
    
    if (userCount === 0) {
      console.log('\n⚠ WARNING: No users found in database!');
      console.log('You need to run: node seed.js');
    } else {
      // List users
      const users = await User.find().select('email role');
      console.log('\nExisting users:');
      users.forEach(u => {
        console.log(`  - ${u.email} (${u.role})`);
      });
    }
    
    // Test login
    const testUser = await User.findOne({ email: 'admin@lms.com' });
    if (testUser) {
      console.log('\n✓ Test user "admin@lms.com" exists');
      const testPassword = await testUser.comparePassword('admin123');
      if (testPassword) {
        console.log('✓ Password "admin123" is correct');
      } else {
        console.log('✗ Password "admin123" is INCORRECT');
      }
    } else {
      console.log('\n✗ Test user "admin@lms.com" NOT FOUND');
      console.log('   Run: node seed.js to create demo accounts');
    }
    
    await mongoose.disconnect();
    console.log('\n✓ Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ ERROR:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\nMongoDB connection refused. Make sure:');
      console.error('1. MongoDB is installed and running');
      console.error('2. MongoDB service is started');
      console.error('3. Connection string is correct in .env file');
    }
    process.exit(1);
  }
}

testConnection();

