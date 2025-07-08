import mongoose from 'mongoose';

const tokenCounterSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true }, // Format: 'YYYY-MM-DD'
  tokenNo: { type: Number, required: true, default: 1 },
}, { timestamps: true });

export const TokenCounter = mongoose.model('TokenCounter', tokenCounterSchema);
