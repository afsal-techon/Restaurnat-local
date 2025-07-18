// models/Rider.js
import mongoose from "mongoose";

const riderSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    default: null
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  mobileNo: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdById: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  createdBy: {
    type: String
  }
}, { timestamps: true });

 const riderModel =  mongoose.model("Rider", riderSchema);
 export default riderModel;
