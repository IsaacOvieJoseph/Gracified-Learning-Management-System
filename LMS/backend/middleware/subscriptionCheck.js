const subscriptionCheck = async (req, res, next) => {
  const user = req.user;

  // Only apply checks for School Admin and Personal Teacher
  if (user.role === 'school_admin' || user.role === 'personal_teacher') {
    // If on trial, check if trial period has expired
    if (user.subscriptionStatus === 'trial') {
      if (user.trialEndDate && user.trialEndDate < Date.now()) {
        return res.status(403).json({ message: 'Your trial period has expired. Please choose a subscription plan to continue.', trialExpired: true });
      }
    }
    // If not on trial, and not active/pay_as_you_go, deny access
    else if (user.subscriptionStatus !== 'active' && user.subscriptionStatus !== 'pay_as_you_go') {
      return res.status(403).json({ message: 'You do not have an active subscription. Please choose a plan.', subscriptionRequired: true });
    }
  }

  next();
};

module.exports = subscriptionCheck;
