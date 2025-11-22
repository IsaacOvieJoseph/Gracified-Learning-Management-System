const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
  },
  planType: {
    type: String,
    enum: ['trial', 'pay_as_you_go', 'weekly', 'monthly', 'yearly'],
    required: true,
  },
  price: {
    type: Number,
    default: 0, // 0 for trial/pay-as-you-go, actual price for others
  },
  durationDays: {
    type: Number,
    default: 0, // For monthly/yearly, calculate days. For trial (2 weeks = 14 days)
  },
  revenueSharePercentage: {
    type: Number,
    default: 0, // Only for pay-as-you-go
  },
  features: [{
    type: String,
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);

module.exports = SubscriptionPlan;
