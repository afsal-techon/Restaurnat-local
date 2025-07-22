import mongoose from "mongoose";

const printerConfigSchema = new mongoose.Schema(
  {
    printerType: {
      type: String,
      enum: ["KOT", "Receipt"],
      required: true,
    },
    printerName: {
      type: String,
      required: true,
    },
    kitchenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Kitchen",
      default:null
    },
    printerIp:{
      type:String,
      required:true
    },
    printerPort:{
      type:Number,
      default:9100
    },
    customerTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customerTypes",
      default:null,
    },
  },
  { timestamps: true }
);


const printerModel = mongoose.model("PrinterConfig", printerConfigSchema);
export default printerModel
