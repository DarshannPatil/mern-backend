const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Cart = require('../models/cart');
const verifyToken = require('../middleware/verifyToken');

// 📦 Create Order
router.post('/', verifyToken, async (req, res) => {
  try {
    const { shippingAddress } = req.body;
    const userId = req.user.id;

    // 🛒 Find the user's cart
    const cart = await Cart.findOne({ user: userId }).populate({
      path: 'items.product',
      select: 'name price'
    });

    if (!cart) return res.status(400).json({ error: 'Cart not found' });
    if (!cart.items || cart.items.length === 0) return res.status(400).json({ error: 'Cart is empty' });

    // 📋 Format order items
    const orderItems = cart.items.map(item => ({
      product: item.product._id,
      name: item.product.name,
      size: item.size,
      price: item.price,
      quantity: item.quantity
    }));

    // 🧾 Create and save the order
    const order = new Order({
      user: userId,
      items: orderItems,
      totalAmount: cart.totalPrice,
      shippingAddress
    });

    const savedOrder = await order.save();

    // 🧹 Clear user's cart
    await Cart.findByIdAndUpdate(cart._id, {
      $set: {
        items: [],
        totalPrice: 0
      }
    });

    res.status(201).json({ success: true, order: savedOrder });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Order creation failed', details: error.message });
  }
});

module.exports = router;
