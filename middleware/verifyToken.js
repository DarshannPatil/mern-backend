const jwt = require('jsonwebtoken');
const Token = require('../models/token');

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. No token found.',
    });
  }

  try {
    // Verify token signature
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check token in database
    const storedToken = await Token.findOne({
      token,
      userId: decoded.id,
      isRefreshToken: false,
      blacklisted: false
    });

    if (!storedToken) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session. Please login again.',
      });
    }

    // Update last used timestamp if older than 1 minute
    if (Date.now() - storedToken.lastUsedAt > 60000) {
      storedToken.lastUsedAt = new Date();
      await storedToken.save();
    }

    // Attach user to request
    req.user = {
      id: decoded.id,
      role: decoded.role,
    };

    next();
  } catch (err) {
    console.error('Token verification error:', err);
    
    const errorResponse = {
      success: false,
      error: 'Invalid authentication token',
      code: 'AUTH_FAILED'
    };

    if (err.name === 'TokenExpiredError') {
      errorResponse.error = 'Session expired. Please refresh your token.';
      errorResponse.code = 'TOKEN_EXPIRED';
    }

    res.status(401).json(errorResponse);
  }
};

module.exports = verifyToken;