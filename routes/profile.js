const express = require('express');
const router = express.Router();
const User = require('../models/user');
const verifyToken = require('../middleware/verifyToken');

// Get profile (updated with phone field)
router.get('/', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('name email phone')  // Changed contact -> phone
      .lean();

    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Add formatted ID
    const userData = {
      ...user,
      id: user._id,
      contact: user.phone // Maintain backward compatibility
    };

    res.json({
      success: true,
      user: userData
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to load profile',
      code: 'SERVER_ERROR'
    });
  }
});

// Update profile (updated for phone field)
router.put('/', verifyToken, async (req, res) => {
  try {
    const allowedUpdates = ['name', 'phone']; // Removed address
    const updates = Object.keys(req.body)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = req.body[key].trim();
        return obj;
      }, {});

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update',
        code: 'NO_VALID_UPDATES'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, runValidators: true }
    ).select('name email phone');

    const userData = {
      ...user.toObject(),
      id: user._id,
      contact: user.phone // Maintain backward compatibility
    };

    res.json({
      success: true,
      user: userData
    });

  } catch (error) {
    console.error('Update error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: Object.values(error.errors).map(e => e.message),
        code: 'VALIDATION_ERROR'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      code: 'SERVER_ERROR'
    });
  }
});

module.exports = router;