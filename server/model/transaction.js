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
  createdById: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  createdBy: {
    type: String,
  },
}, { timestamps: true });

transactionSchema.index({ accountId: 1 });
transactionSchema.index({ restaurantId: 1 });
transactionSchema.index({ createdAt: -1 });

const transactionModel =  mongoose.model("Transaction", transactionSchema);
export default transactionModel;
