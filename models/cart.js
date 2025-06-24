const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product', // Referencing Product model
    required: true
  },
  name: {
    type: String,
    required: true
  },
  image: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true // Make sure price is required
  },
  size: {
    type: String,
    default: 'M'
  },
  quantity: {
    type: Number,
    required: true,
    default: 1
  }
}, { timestamps: true });

// Add model existence check
if (mongoose.models.Cart) {
  module.exports = mongoose.models.Cart;
} else {
  const Cart = mongoose.model('Cart', cartSchema);
  module.exports = Cart;
}
