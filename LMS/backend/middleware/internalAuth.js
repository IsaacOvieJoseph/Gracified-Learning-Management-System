const jwt = require('jsonwebtoken');
const User = require('../models/User');

const internalAuth = async (req, res, next) => {
  try {
    const internalApiKey = req.header('x-internal-api-key');
    if (!internalApiKey || internalApiKey !== process.env.INTERNAL_API_KEY) {
      return res.status(401).json({ message: 'Unauthorized internal access' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Internal server error for internal auth', error: error.message });
  }
};

module.exports = internalAuth;
