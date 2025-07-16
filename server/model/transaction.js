import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
     restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    default:null,
  },
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Account",
    required: true,
  },
    purchaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Purchase",
    default:null
  },
     expenseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Expense",
    default:null
  },
   customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default:null,
    },
    supplierId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Supplier",
      default:null,
    },
  amount: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
  },
  referenceId: {
    type: String, // e.g., "POS Bill Payment"
  },
  referenceType:{
    type:String
  },
  description:{
    type:String,
    default:null
  },
    vatAmount: {
    type: Number,
    default: 0,
  },
  paymentType:{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Account",
    default:null
  },
  createdById: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

}, { timestamps: true });

transactionSchema.index({ accountId: 1 });
transactionSchema.index({ restaurantId: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ purchaseId: 1 });
transactionSchema.index({ expenseId: 1 });

const transactionModel =  mongoose.model("Transaction", transactionSchema);
export default transactionModel;
