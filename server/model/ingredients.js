import mongoose from "mongoose";

const ingredientSchema = new mongoose.Schema(
  {
    ingredient: {
      type: String,
      required: true,
      trim: true,
    },
    purchaseUnit: {
      type:String,
      required: true,
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    createdBy: {
      type: String,
    },
  },
  { timestamps: true }
);

ingredientSchema.index(
  { ingredient: 1 }
);

const ingredientModel= mongoose.model("Ingredient", ingredientSchema);
export default ingredientModel;