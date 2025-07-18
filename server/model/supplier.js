import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema(
  {
    supplierName: {
      type: String,
      required: true,
      trim: true,
    },
    mobileNo: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    wallet: {
      credit: { type: Number, default: 0 },     // Amount the restaurant still owes to vendor (credit to vendor)
      debit: { type: Number, default: 0 },  // Amount the vendor needs to return to restaurant
    },
    trn:{
      type:String,
      default:null,
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    createdBy: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

supplierSchema.index(
    { supplierName: 1},
  );

const supplierModel= mongoose.model("Supplier", supplierSchema);
export default supplierModel;