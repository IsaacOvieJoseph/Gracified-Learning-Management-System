const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  classroomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom',
    required: true
  },
  order: {
    type: Number,
    default: 0
  },
  materials: [{
    type: {
      type: String,
      enum: ['video', 'document', 'link', 'text']
    },
    url: String,
    title: String,
    content: String
  }],
  isPaid: {
    type: Boolean,
    default: false
  },
  price: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Topic', topicSchema);

