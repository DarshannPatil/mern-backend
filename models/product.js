const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    image: { type: String, required: true },
    description: { type: String, required: true, trim: true },
    benefits: { type: String, default: '' },
    category: { type: String, required: true, trim: true },
    stock: { type: Number, required: true, min: 0 },
    sizes: [
      {
        size: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
