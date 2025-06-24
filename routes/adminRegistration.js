const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const router = express.Router();

router.post('/register-admin', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Input validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate phone format
    const phonePattern = /^\d{10}$/;
    if (!phonePattern.test(phone)) {
      return res.status(400).json({ error: 'Phone must be 10 digits' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength (matches client-side 6 char minimum)
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ error: 'Password must be 6+ characters with letters and numbers' });
    }

    // Check existing user
    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const newAdmin = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      role: 'admin'
    });

    await newAdmin.save();

    // Generate JWT
    const token = jwt.sign(
      { id: newAdmin._id, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(201).json({ success: true, token });
  } catch (err) {
    console.error('Admin registration error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

module.exports = router;