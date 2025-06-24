require('dotenv').config({ path: '../.env' }); // Add path option for custom location if needed

const mongoose = require('mongoose');
const Product = require('../models/Product');

// Get Mongo URI from the environment variables
const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
  console.error('Mongo URI is not defined in .env');
  process.exit(1);
}

// Connect to MongoDB without deprecated options
mongoose.connect(mongoURI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("Failed to connect to MongoDB:", err));

// Product data to be inserted
const products = [
  {
    name: 'Groundnut Oil',
    image: 'DSC00197 1.png',
    price: 325,
    size: ['500ml', '1 Ltr', '2 Ltr', '5 Ltr'],
    description: 'Cold-pressed groundnut oil...',
    benefits: 'Rich in antioxidants...',
    category: 'Edible Oils',
    stock: 100,
  },
  {
    name: 'Rice Bran Oil',
    image: 'rice-bran-oil.png',
    price: 240,
    size: ['500ml', '1 Ltr'],
    description: 'Refined rice bran oil...',
    benefits: 'Helps lower cholesterol...',
    category: 'Edible Oils',
    stock: 150,
  },
];

// Insert products into the database
Product.insertMany(products)
  .then(() => {
    console.log('Products seeded');
    mongoose.disconnect(); // Disconnect after seeding is complete
  })
  .catch(console.error);
