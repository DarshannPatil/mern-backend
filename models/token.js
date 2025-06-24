const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  token: {
    type: String,
    required: true,
    unique: true // This already creates a unique index
  },
  blacklisted: {
    type: Boolean,
    default: false
  },
  isRefreshToken: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUsedAt: {
    type: Date,
    default: Date.now
  }
});

// ✅ Required indexes (no duplicates)
tokenSchema.index({ userId: 1 });
tokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 }); // 7 days

const Token = mongoose.model('Token', tokenSchema);
module.exports = Token;
