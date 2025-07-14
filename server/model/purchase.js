import mongoose from "mongoose";

const purchaseSchema = new mongoose.Schema(
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
      required: true,
    },
    paymentModeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    items: [
      {
        ingredientId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Ingredient",
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        total: {
          type: Number, // price * quantity
          required: true,
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
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

export default mongoose.model("Purchase", purchaseSchema);
