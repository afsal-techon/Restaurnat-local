import mongoose from 'mongoose';



const departmentSchema =new mongoose.Schema({
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
        required: true, // CompanyAdmin or BranchAdmin who created it
    },
    createdBy:{
        type:String,
    },
},{
    timestamps:true
})

departmentSchema.index({ name: 1, restaurantId: 1});

const departmentModel = mongoose.model('Department',departmentSchema);


export default departmentModel;