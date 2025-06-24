const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const verifyToken = require('../middleware/verifyToken');

router.use(verifyToken);

// Unified cart endpoint handler
router.route('/')
  .get(verifyToken, async (req, res) => {
    try {
      const cartItems = await Cart.find({ user: req.user.id })
                                .populate('product', 'name image sizes');
      
      // Transform items to match frontend expectations
      const transformedItems = cartItems.map(item => ({
        _id: item._id,
        productId: item.product._id,
        name: item.product.name,
        image: item.product.image,
        price: item.price,
        size: item.size,
        quantity: item.quantity
      }));

      // Calculate total
      const total = transformedItems.reduce(
        (sum, item) => sum + (item.price * item.quantity), 
        0
      );

      res.json({
        success: true,
        items: transformedItems,
        total: parseFloat(total.toFixed(2))
      });

    } catch (err) {
      console.error('Error fetching cart:', err);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch cart items' 
      });
    }
  })
  .post(verifyToken, async (req, res) => {
    try {
      const { action } = req.body;

      switch (action) {
        case 'add':
          return await handleAddToCart(req, res);
        case 'update':
          return await handleUpdateCart(req, res);
        case 'remove':
          return await handleRemoveFromCart(req, res);
        default:
          return res.status(400).json({ 
            success: false,
            error: 'Invalid action specified' 
          });
      }
    } catch (err) {
      console.error('Cart operation error:', err);
      res.status(500).json({ 
        success: false,
        error: 'Failed to process cart operation',
        details: err.message 
      });
    }
  });

// Add to cart route (compatible with frontend)
router.post('/add', verifyToken, async (req, res) => {
  try {
    console.log('Add to cart request body:', req.body);
    const { productId, sizeId, quantity } = req.body;

    // Validate required fields
    if (!productId) {
      return res.status(400).json({ 
        success: false,
        error: 'Product ID is required' 
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ 
        success: false,
        error: 'Product not found' 
      });
    }

    // Find the selected size by sizeId or default to first available size
    let selectedSizeObj;
    if (sizeId) {
      selectedSizeObj = product.sizes.find(s => s._id.toString() === sizeId);
    } else {
      selectedSizeObj = product.sizes[0]; // Default to first size if none specified
    }

    if (!selectedSizeObj) {
      return res.status(400).json({ 
        success: false,
        error: 'Selected size not available',
        availableSizes: product.sizes.map(s => ({ size: s.size, id: s._id })) 
      });
    }

    // Check if item already exists in cart with same product and size
    const existingItem = await Cart.findOne({
      user: req.user.id,
      product: product._id,
      size: selectedSizeObj.size
    });

    if (existingItem) {
      // Update quantity if item already exists
      existingItem.quantity += parseInt(quantity || 1, 10);
      await existingItem.save();
      return res.status(200).json({
        success: true,
        item: await transformCartItem(existingItem),
        message: 'Item quantity updated in cart'
      });
    }

    // Create new cart item with proper price from selected size
    const newItem = new Cart({
      user: req.user.id,
      product: product._id,
      name: product.name,
      image: product.image,
      price: selectedSizeObj.price,
      size: selectedSizeObj.size,
      quantity: parseInt(quantity || 1, 10),
    });

    const savedItem = await newItem.save();
    res.status(201).json({
      success: true,
      item: await transformCartItem(savedItem),
      message: 'Item added to cart'
    });

  } catch (err) {
    console.error('Error in /add route:', err);
    res.status(500).json({ 
      success: false,
      error: 'Server error while adding to cart',
      details: err.message 
    });
  }
});

// Helper functions for cart operations
async function handleUpdateCart(req, res) {
  const { cartItemId, quantity, size } = req.body;
  
  if (!cartItemId) {
    return res.status(400).json({ 
      success: false,
      error: 'Cart item ID is required' 
    });
  }

  // Find and update the cart item
  const updateFields = {};
  if (quantity !== undefined) updateFields.quantity = parseInt(quantity, 10);
  if (size) updateFields.size = size;

  const updatedItem = await Cart.findOneAndUpdate(
    { _id: cartItemId, user: req.user.id },
    updateFields,
    { new: true }
  ).populate('product', 'name image sizes');

  if (!updatedItem) {
    return res.status(404).json({ 
      success: false,
      error: 'Cart item not found' 
    });
  }

  res.json({
    success: true,
    items: [await transformCartItem(updatedItem)],
    message: 'Cart item updated successfully'
  });
}

async function handleRemoveFromCart(req, res) {
  const { cartItemId } = req.body;
  
  if (!cartItemId) {
    return res.status(400).json({ 
      success: false,
      error: 'Cart item ID is required' 
    });
  }

  const deletedItem = await Cart.findOneAndDelete({ 
    _id: cartItemId, 
    user: req.user.id 
  }).populate('product', 'name image sizes');

  if (!deletedItem) {
    return res.status(404).json({ 
      success: false,
      error: 'Cart item not found' 
    });
  }

  res.json({
    success: true,
    message: 'Item removed from cart',
    removedItem: await transformCartItem(deletedItem)
  });
}

// Helper function to transform cart item for response
async function transformCartItem(cartItem) {
  await cartItem.populate('product', 'name image sizes');
  return {
    _id: cartItem._id,
    productId: cartItem.product._id,
    name: cartItem.product.name,
    image: cartItem.product.image,
    price: cartItem.price,
    size: cartItem.size,
    quantity: cartItem.quantity
  };
}

module.exports = router;