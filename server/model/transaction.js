import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    type: {
      type: String,
      enum: ["Sale", "Purchase", "Expense"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    description: {
      type: String,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false, // Reference to Order ID, Purchase ID, etc.
    },
    referenceType: {
      type: String, // e.g., "Order", "Purchase"
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

const transactionModel =  mongoose.model("Transaction", transactionSchema);
export default transactionModel;
