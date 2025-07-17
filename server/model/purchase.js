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
  accountId: {
     type: mongoose.Schema.Types.ObjectId,
     ref: "Account",
   },
    paymentModeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    isVatInclusive:{
      type:Boolean,
      default:true
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
          type: Number,
          default: 0,
        },
        vatAmount: {
          type: Number,
          default: 0,
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
    },
     vatTotal:{
      type: Number,
      default: 0,
    } ,
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
