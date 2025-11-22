const mongoose = require('mongoose');
const User = require('./models/User');
const Classroom = require('./models/Classroom');
const dotenv = require('dotenv');

dotenv.config();

async function seedDatabase() {
  try {
    // Force lowercase database name to avoid case mismatch
    let mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms';
    // Replace uppercase LMS with lowercase lms
    mongoUri = mongoUri.replace(/\/LMS$/, '/lms');
    
    console.log('Connecting to:', mongoUri);
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Classroom.deleteMany({});
    console.log('Cleared existing data');

    // Create demo users
    const rootAdmin = new User({
      name: 'Root Admin',
      email: 'admin@lms.com',
      password: 'admin123',
      role: 'root_admin'
    });

    const schoolAdmin = new User({
      name: 'School Admin',
      email: 'schooladmin@lms.com',
      password: 'admin123',
      role: 'school_admin'
    });

    const teacher = new User({
      name: 'John Teacher',
      email: 'teacher@lms.com',
      password: 'teacher123',
      role: 'teacher'
    });

    const personalTeacher = new User({
      name: 'Personal Teacher',
      email: 'personalteacher@lms.com',
      password: 'teacher123',
      role: 'personal_teacher'
    });

    const student = new User({
      name: 'Jane Student',
      email: 'student@lms.com',
      password: 'student123',
      role: 'student'
    });

    await rootAdmin.save();
    await schoolAdmin.save();
    await teacher.save();
    await personalTeacher.save();
    await student.save();

    console.log('✓ Users created');

    // Create demo classrooms
    const classroom1 = new Classroom({
      name: 'Advanced Mathematics',
      description: 'Learn advanced mathematical concepts',
      teacherId: teacher._id,
      schedule: 'Mon/Wed 10:00 AM',
      capacity: 30,
      pricing: {
        type: 'per_class',
        amount: 299
      },
      isPaid: true
    });

    const classroom2 = new Classroom({
      name: 'Physics Fundamentals',
      description: 'Introduction to physics principles',
      teacherId: personalTeacher._id,
      schedule: 'Tue/Thu 2:00 PM',
      capacity: 25,
      pricing: {
        type: 'per_class',
        amount: 249
      },
      isPaid: true
    });

    await classroom1.save();
    await classroom2.save();

    console.log('✓ Classrooms created');

    console.log('\n✓ Database seeded successfully!');
    console.log('\nDemo Accounts:');
    console.log('Root Admin: admin@lms.com / admin123');
    console.log('School Admin: schooladmin@lms.com / admin123');
    console.log('Teacher: teacher@lms.com / teacher123');
    console.log('Personal Teacher: personalteacher@lms.com / teacher123');
    console.log('Student: student@lms.com / student123');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error.message);
    process.exit(1);
  }
}

seedDatabase();

