import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    invoiceNo: {
      type: String,
      default:null
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      default:null,
    },
     accountId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Account",
        required: true,
      },
    paymentModeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    qty:{
        type:Number,
        default:null
    },
    vat:{
        type:Number,
        default:5
    },
    amount: {
      type: Number,
      required: true,
    },
    note:{
      type:String,
      default:null
    },
    createdBy:{
        type:String
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Expense", expenseSchema);
