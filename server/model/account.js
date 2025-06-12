import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  accountName: {
    type: String,
    required: true,
    trim: true
  },
  accountType: {
    type: String,
    enum: ['Asset', 'Liability', 'Income', 'Expense'],
    required: true
  },
  accountCategory: {
    type: String,
    enum: ["Cash", "Bank", "Card", "Supplier", "Customer", "Other"],
    required: true,
  },
  description: {
    type: String,
    default: ''
  },
  openingBalance: {
    type: Number,
    default: 0
  },
},{
    timestamps:true
});

const accountModel =  mongoose.model('Account', accountSchema);
export default accountModel;
