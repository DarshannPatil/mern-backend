const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Token = require('../models/token');
const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  const { name, email, password, phone, role = 'user' } = req.body;

  if (!name || !email || !password || !phone) {
    return res.status(400).json({
      success: false,
      error: 'Please provide all fields (name, email, password, phone).',
    });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email already exists',
      });
    }

    const user = new User({
      name,
      email,
      phone,
      password,
      role,
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: 'Server error during registration',
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Please provide both email and password.',
    });
  }

  try {
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.correctPassword(password))) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' } // Shorter access token
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' } // Longer refresh token
    );

    await Token.create({
      userId: user._id,
      token: refreshToken,
      isRefreshToken: true, // Mark as refresh token
      lastUsedAt: new Date(),
    });
    await Token.create({
      userId: user._id,
      token: token,
      lastUsedAt: new Date(),
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      refreshToken,
      expiresIn: 3600,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: 'Login failed due to a server error',
    });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token not provided',
      });
    }

    await Token.findOneAndUpdate({ token }, { blacklisted: true });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed',
    });
  }
});

// Refresh Token
// Refresh Token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // 1. Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // 2. Check token exists in DB
    const storedToken = await Token.findOne({
      token: refreshToken,
      userId: decoded.id,
      isRefreshToken: true,
      blacklisted: false
    });

    if (!storedToken) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }

    // 3. Generate new tokens
    const newAccessToken = jwt.sign(
      { id: decoded.id, role: decoded.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const newRefreshToken = jwt.sign(
      { id: decoded.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // 4. Update tokens in database
    await Token.findOneAndUpdate(
      { token: refreshToken },
      {
        token: newRefreshToken,
        lastUsedAt: new Date(),
        blacklisted: false
      }
    );

    await Token.create({
      userId: decoded.id,
      token: newAccessToken,
      lastUsedAt: new Date()
    });

    res.json({
      success: true,
      token: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900 // 15 minutes in seconds
    });

  } catch (error) {
    console.error('Refresh error:', error);
    const errorMessage = error.name === 'TokenExpiredError'
      ? 'Refresh token expired'
      : 'Invalid refresh token';

    res.status(401).json({
      success: false,
      error: errorMessage
    });
  }
});

// Verify Token
// Verify Token
router.get('/verify', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authorization token required'
    });
  }

  try {
    // 1. Verify token signature
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 2. Check database for valid token
    const storedToken = await Token.findOne({
      token,
      userId: decoded.id,
      blacklisted: false
    });

    if (!storedToken) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session token'
      });
    }

    // 3. Get user data
    const user = await User.findById(decoded.id)
      .select('-password -__v -createdAt -updatedAt');

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        address: user.address,
        contact: user.contact
      }
    });

  } catch (err) {
    console.error('Verification error:', err);

    const errorResponse = {
      success: false,
      error: 'Invalid authentication token'
    };

    if (err.name === 'TokenExpiredError') {
      errorResponse.error = 'Token expired';
      errorResponse.code = 'TOKEN_EXPIRED';
    }

    res.status(401).json(errorResponse);
  }
});

module.exports = router;
