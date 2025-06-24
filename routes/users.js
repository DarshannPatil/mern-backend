//users.js in routes 
const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Cart = require('../models/cart');
const Order = require('../models/Order');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const verifyToken = require('../middleware/verifyToken');

// 🆕 User Registration Route
router.post('/register', async (req, res) => {
  try {
    const { email, name, password, phone } = req.body;

    if (!email || !name || !password || !phone) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required',
        code: 'MISSING_FIELDS'
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'This email is already registered. Please use a different email.',
        code: 'USER_EXISTS'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = new User({
      email: email.toLowerCase(),
      name,
      password: hashedPassword,
      phone: String(phone)
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      message: 'Registration successful! Redirecting...',
      userId: newUser._id
    });

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again later.',
      code: 'SERVER_ERROR'
    });
  }
});


// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const { password: _, ...userResponse } = user.toObject();
    res.json({ token, user: userResponse });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get list of all users
router.get('/', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admins only.' });
    }

    const users = await User.find().select('-password');
    res.json({ success: true, data: users });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: 'Error fetching users', error: error.message });
  }
});

// Get logged-in user's own profile
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching user profile', error: error.message });
  }
});

// Update user's profile (name, email, password)
router.put('/me', verifyToken, async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (email) {
      user.email = email;
    }
    if (name) {
      user.name = name;
    }
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await user.save();
    const { password: _, ...userResponse } = updatedUser.toObject();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: userResponse,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating profile', error: error.message });
  }
});

// Delete user's account
router.delete('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Optionally, clear user's cart and orders
    await Cart.deleteMany({ userId: req.user.id });
    await Order.deleteMany({ userId: req.user.id });

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting account', error: error.message });
  }
});

module.exports = router;
