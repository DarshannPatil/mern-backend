//user.js in models 

const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

// Subdocument schema for refresh tokens
const tokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '7d' // Token expires in 7 days automatically
  },
  lastUsedAt: {
    type: Date,
    default: Date.now
  },
  isRefreshToken: {
    type: Boolean,
    default: false
  }
});

// Main user schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[0-9]{10,15}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    }
  },
  address: {
    type: String,
    trim: true,
    maxlength: [200, 'Address cannot exceed 200 characters']
  },
  profileImage: {
    type: String,
    default: 'default-profile.jpg'
  },
  active: {
    type: Boolean,
    default: true,
    select: false
  },
  tokens: [tokenSchema] // Array of refresh tokens
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Middleware to hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (err) {
    next(err);
  }
});

// Password comparison method
userSchema.methods.correctPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Automatically filter out inactive users
userSchema.pre(/^find/, function(next) {
  this.find({ active: { $ne: false } });
  next();
});

// Export user model (prevent recompilation in dev mode)
if (mongoose.models && mongoose.models.User) {
  module.exports = mongoose.models.User;
} else {
  const User = mongoose.model('User', userSchema);
  module.exports = User;
}
