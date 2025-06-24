//authenticate.js in middleware 
const jwt = require('jsonwebtoken');
const Token = require('../models/token');

const auth = async (req, res, next) => {
  try {
    // 1. Get token from header
    const authHeader = req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    // 2. Extract and verify token
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Check database for valid token
    const storedToken = await Token.findOne({
      token,
      userId: decoded.id,
      blacklisted: false
    });

    if (!storedToken) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // 4. Check token expiration
    if (decoded.exp * 1000 < Date.now()) {
      await Token.findByIdAndUpdate(storedToken._id, { blacklisted: true });
      return res.status(401).json({ error: 'Token expired' });
    }

    // 5. Update token usage timestamp
    await Token.findByIdAndUpdate(storedToken._id, { 
      lastUsedAt: new Date() 
    });

    // 6. Attach user to request
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    
    const errorResponse = err.name === 'TokenExpiredError' 
      ? { error: 'Session expired', code: 'TOKEN_EXPIRED' }
      : { error: 'Invalid authentication', code: 'AUTH_FAILED' };

    res.status(401).json(errorResponse);
  }
};

module.exports = auth;