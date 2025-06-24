const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const Product = require('../models/Product');

// --- Multer Setup ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// --- Utility ---
const isValidObjectId = id => mongoose.Types.ObjectId.isValid(id);

// --- Create a New Product ---
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, description, benefits = '', category, stock, sizes, price } = req.body;

    if (!name || !description || !category || !stock || !sizes || !price) {
      return res.status(400).json({ success: false, error: 'All fields are required.' });
    }

    let parsedSizes;
    try {
      parsedSizes = JSON.parse(sizes);
      if (!Array.isArray(parsedSizes) || parsedSizes.length === 0) {
        throw new Error();
      }
    } catch {
      return res.status(400).json({ success: false, error: 'Sizes must be a valid non-empty array.' });
    }

    const imageUrl = req.file
      ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
      : null;

    const newProduct = new Product({
      name: name.trim(),
      image: imageUrl,
      description: description.trim(),
      benefits: benefits.trim(),
      category: category.trim(),
      stock: parseInt(stock, 10),
      sizes: parsedSizes,
      price: parseFloat(price),
    });

    await newProduct.save();
    res.status(201).json({ success: true, data: newProduct });

  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// --- Get All Products (with Pagination) ---
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const products = await Product.find().skip(skip).limit(limit);
    const totalProducts = await Product.countDocuments();
    const totalPages = Math.ceil(totalProducts / limit);

    res.json({
      success: true,
      data: products,
      pagination: {
        totalProducts,
        totalPages,
        currentPage: page,
        perPage: limit,
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// --- Get Single Product by ID ---
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, error: 'Invalid Product ID' });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, data: product });

  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// --- Shared Update Handler (PATCH + PUT) ---
async function updateHandler(req, res) {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, error: 'Invalid Product ID' });
    }

    const {
      name,
      description,
      benefits = '',
      category,
      stock,
      sizes,
      price
    } = req.body;

    const updateFields = {};
    if (name) updateFields.name = name.trim();
    if (description) updateFields.description = description.trim();
    if (benefits) updateFields.benefits = benefits.trim();
    if (category) updateFields.category = category.trim();
    if (stock !== undefined) {
      const parsedStock = parseInt(stock, 10);
      if (Number.isNaN(parsedStock)) {
        return res.status(400).json({ success: false, error: 'Invalid stock value' });
      }
      updateFields.stock = parsedStock;
    }
    if (price !== undefined) {
      const parsedPrice = parseFloat(price);
      if (Number.isNaN(parsedPrice)) {
        return res.status(400).json({ success: false, error: 'Invalid price value' });
      }
      updateFields.price = parsedPrice;
    }
    if (sizes) {
      try {
        const parsedSizes = JSON.parse(sizes);
        if (!Array.isArray(parsedSizes) || parsedSizes.length === 0) {
          throw new Error();
        }
        updateFields.sizes = parsedSizes;
      } catch {
        return res.status(400).json({ success: false, error: 'Sizes must be a valid non-empty array.' });
      }
    }

    if (req.file) {
      updateFields.image = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    }

    const updated = await Product.findByIdAndUpdate(id, updateFields, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, data: updated });

  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

// --- PATCH & PUT ---
router.patch('/:id', upload.single('image'), updateHandler);
router.put('/:id', upload.single('image'), updateHandler);

// --- Delete Product by ID ---
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, error: 'Invalid Product ID' });
    }

    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, message: 'Product deleted successfully' });

  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
