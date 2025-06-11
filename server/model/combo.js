import mongoose from "mongoose";

const comboSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  comboName: { type: String, required: true },
  image: { type: String, default: null },
  description: { type: String, default: null },
  offer: {
    startDate: Date,
    endDate: Date,
    discount: Number
  },
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: "ComboGroup" }],
  addOns: [
    {
      addOnId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AddOns",
        default:null
      },
      portion_id: {
        type: mongoose.Schema.Types.ObjectId,
        default:null
      },
    }
  ],
  comboPrice: { type: Number, required: true },
   createdById: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true, // CompanyAdmin or BranchAdmin who created it
    },
    createdBy:{
        type:String,
    },

},{
    timestamps:true,
});

comboSchema.index(
  { comboName: 1, restaurantId: 1}
);

 const comboModel = mongoose.model("Combo", comboSchema);
 export default comboModel;