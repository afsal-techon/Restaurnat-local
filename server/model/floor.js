import mongoose from 'mongoose';



const floorSchema =new mongoose.Schema({
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
    }
    
},{
    timestamps:true
})

// Index to optimize queries involving restaurantId and soft delete checks
floorSchema.index(
    { name: 1, restaurantId: 1 },
  );


const floorModel = mongoose.model('Floor',floorSchema);


export default floorModel;