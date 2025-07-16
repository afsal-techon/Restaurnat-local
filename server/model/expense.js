import mongoose from "mongoose";

const expenseItemSchema = new mongoose.Schema({
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Account",
    required: true,
  },
  note: {
    type: String,
    default: null,
  },
  amount: {
    type: Number,
    default: 0,
  },
  qty: {
    type: Number,
    default: 1,
  },
  total: {
    type: Number,
    default: 0,
  },
  vatAmount: {
    type: Number,
    default: 0,
  },
});

const expenseSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    invoiceNo: {
      type: String,
      default: null,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
    },
    paymentModeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    expenseItems: [expenseItemSchema],
    createdBy: {
      type: String,
    },
    vatTotal:{
      type: Number,
      default: 0,
    } ,
    grandTotal:{
      type: Number,
    default: 0,
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdBy:{
      type:String
    },
  },
  { timestamps: true }
);

export default mongoose.model("Expense", expenseSchema);
