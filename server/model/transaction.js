import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
     restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
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
    enum: ["Sales", "Purchase", "Expense", "Income"],
    required: true,
  },
  reference: {
    type: String, // e.g., "POS Bill Payment"
  },
  note: String,
  createdById: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdBy: {
    type: String,
  },
}, { timestamps: true });
const transactionModel =  mongoose.model("Transaction", transactionSchema);
export default transactionModel;
