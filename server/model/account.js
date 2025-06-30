import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
  },
  accountName: {
    type: String,
    required: true,
    trim: true
  },
  parentAccountId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Account',
  default: null
},
accountType: {
  type: String,
  enum: [
    "Asset",
    "Current Asset",
    "Cash",
    "Bank",
    "Card",
    "Due",
    "Online",
    "Fixed Asset",
    "Stock",
    "Other Current Liabilities",
    "Credit Card",
    "Liabilities",
    "Equity",
    "Income",
    "Other Income",
    "Expense",
    "Cost of Goods Sold",
    "Other Expenses",
    "Credit"
  ],
  required: true
},
  showInPos:{
    type:Boolean,
    default:false
  },
  description: {
    type: String,
    default: ''
  },
  openingBalance: {
    type: Number,
    default: 0
  },
      createdById: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true, // CompanyAdmin or BranchAdmin who created it
      },
      createdBy:{
          type:String,
      },
},{
    timestamps:true
});

accountSchema.index({ restaurantId: 1 });
accountSchema.index({ parentAccountId: 1 });
accountSchema.index({ accountType: 1 });
accountSchema.index({ accountName: 1 });
accountSchema.index({ showInPos: 1 });


const accountModel =  mongoose.model('Account', accountSchema);
export default accountModel;
