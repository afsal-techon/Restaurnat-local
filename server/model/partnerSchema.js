import mongoose from "mongoose";

const partnerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  mobile: {
    type: String,
  },
  percentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
},{
    timestamps:true
});

export const PARTNER = mongoose.model("Partner", partnerSchema);
