const mongoose = require('mongoose');

const callSessionSchema = new mongoose.Schema({
  classroomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', required: true },
  startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  link: { type: String, required: true },
  startedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('CallSession', callSessionSchema);
