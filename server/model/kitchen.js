import mongoose from 'mongoose';



const kitchenSchema =new mongoose.Schema({
    name: {
        type: String,
        required: true, // Example: "Manager", "Chef", "Waiter"
    },
    restaurantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true,
    },
    createdById: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
         // CompanyAdmin or BranchAdmin who created it
    },
    createdBy:{
        type:String,
    },
},{
    timestamps:true
})

kitchenSchema.index(
    { name: 1, restaurantId: 1 }
  );

 kitchenSchema.index({ restaurantId: 1 });

const kitchenModel = mongoose.model('Kitchen',kitchenSchema);


export default kitchenModel;