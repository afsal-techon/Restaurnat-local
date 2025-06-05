import mongoose from "mongoose";

// const subMethodSchema = new mongoose.Schema({
//   name: { type: String },
// });

const customerTypesSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "restaurant",
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    subMethods: [], // Only for Online
  },
  { timestamps: true }
);

 const customerModel = mongoose.model("customerTypes", customerTypesSchema);
 export default customerModel;