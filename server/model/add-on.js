import mongoose from "mongoose";


const AddonSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number }, // optional if portion exists
    portion: [
        {
            name: String,
            price: Number
        }
    ],
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
   
    
},{
    timestamps:true
});


AddonSchema.index(
    { name: 1, restaurantId: 1},
  );

const addOnModel = mongoose.model('AddOns',AddonSchema);


export default addOnModel;
