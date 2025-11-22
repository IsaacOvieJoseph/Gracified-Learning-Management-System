const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  classes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
  }],
}, { timestamps: true });

const School = mongoose.model('School', schoolSchema);

module.exports = School;

