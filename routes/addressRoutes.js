// File: routes/addressRoutes.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/authenticate');
const Address = require('../models/Address');

// Validation middleware for address creation
const validateAddress = [
  body('name')
    .notEmpty().withMessage('Name is required')
    .trim()
    .escape(),
  body('phone')
    .notEmpty().withMessage('Phone number is required')
    .isMobilePhone('en-IN').withMessage('Invalid Indian phone number')
    .trim(),
  body('address')
    .notEmpty().withMessage('Address is required')
    .trim()
    .escape(),
  body('city')
    .notEmpty().withMessage('City is required')
    .trim()
    .escape(),
  body('pincode')
    .notEmpty().withMessage('Pincode is required')
    .isPostalCode('IN').withMessage('Invalid Indian pincode')
    .trim(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// Get all addresses for authenticated user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const addresses = await Address.find({ user: req.user.id });
    res.json(addresses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new address with validation
router.post('/', authMiddleware, validateAddress, async (req, res) => {
  try {
    const { name, phone, address, city, pincode } = req.body;
    
    const newAddress = new Address({
      user: req.user.id,
      name,
      phone,
      address,
      city,
      pincode
    });

    const savedAddress = await newAddress.save();
    res.status(201).json(savedAddress);
    
  } catch (error) {
    console.error(error);
    
    // Handle duplicate address error
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'This address already exists' 
      });
    }
    
    // Handle other errors
    res.status(500).json({ 
      message: 'Server error while saving address' 
    });
  }
});

module.exports = router;