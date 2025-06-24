require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const verifyToken = require('./middleware/verifyToken'); 
const Token = require('./models/token');

const app = express();

// ---------------------------------------------
// 🔐 CORS Configuration
// ---------------------------------------------
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'http://localhost:5500'
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  credentials: true,
  exposedHeaders: ['Authorization', 'X-Token-Expiry'],
  maxAge: 86400
}));

// ---------------------------------------------
// 🔧 Middlewares
// ---------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------
// 📁 Paths
// ---------------------------------------------
const frontendPath = path.resolve(__dirname, '../mern-frontend');
const publicPath = path.join(frontendPath, 'public');
const uploadsPath = path.join(__dirname, 'uploads');

// ---------------------------------------------
// 📂 Static File Serving
// ---------------------------------------------
app.use(express.static(frontendPath));
app.use(express.static(publicPath));
app.use('/uploads', express.static(uploadsPath));

// ---------------------------------------------
// 📦 Multer for File Uploads
// ---------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsPath),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ---------------------------------------------
// 🛡️ Auth Token Verify Endpoint
// ---------------------------------------------
app.get('/api/auth/verify', verifyToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

// 🔄 Refresh Token Endpoint
app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ success: false, error: 'Refresh token required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const storedToken = await Token.findOne({
      token: refreshToken,
      userId: decoded.id,
      isRefreshToken: true,
      blacklisted: false
    });

    if (!storedToken) {
      return res.status(401).json({ success: false, error: 'Invalid refresh token' });
    }

    const newAccessToken = jwt.sign(
      { id: decoded.id, role: decoded.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const newRefreshToken = jwt.sign(
      { id: decoded.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    await Token.findOneAndUpdate(
      { token: refreshToken },
      { token: newRefreshToken, lastUsedAt: new Date(), blacklisted: true }
    );

    await Token.create({
      userId: decoded.id,
      token: newAccessToken,
      lastUsedAt: new Date()
    });

    res.json({
      success: true,
      token: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900
    });

  } catch (err) {
    console.error('Refresh token error:', err);
    const errorMessage = err.name === 'TokenExpiredError'
      ? 'Refresh token expired'
      : 'Invalid refresh token';
    res.status(401).json({
      success: false,
      error: errorMessage,
      code: 'REFRESH_FAILED'
    });
  }
});

// ---------------------------------------------
// 🗂️ API Routes
// ---------------------------------------------
const profileRoutes = require('./routes/profile');
const authRoutes = require('./routes/auth');
const adminRegistrationRoutes = require('./routes/adminRegistration');
const adminRoutes = require('./routes/admin');
const productRoutes = require('./routes/products');
const userRoutes = require('./routes/users');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const addressRoutes = require('./routes/addressRoutes');

app.use('/api/profile', profileRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/admin/register', adminRegistrationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/addresses', addressRoutes);

// ---------------------------------------------
// 🖼️ Image Upload Route
// ---------------------------------------------
app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.status(201).json({ success: true, url: fileUrl, filename: req.file.filename });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: 'File upload failed' });
  }
});

// ---------------------------------------------
// 🧠 MongoDB Connection & Server Start
// ---------------------------------------------
const startServer = async () => {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(process.env.MONGO_URI); // 🚫 Removed deprecated options

    console.log('✅ MongoDB connected');
    await mongoose.connection.db.collection('users').createIndex({ email: 1 }, { unique: true });
    await mongoose.connection.db.collection('tokens').createIndex({ userId: 1 });

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Server startup error:', error.message);
    process.exit(1);
  }
};

startServer();

// ---------------------------------------------
// 🛑 Global Error Handler
// ---------------------------------------------
app.use((err, req, res, next) => {
  console.error('🚨 Global error:', err.stack);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Server error'
  });
});
