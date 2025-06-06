import mongoose from 'mongoose';



const courseSchema =new mongoose.Schema({
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

courseSchema.index({ name: 1, restaurantId: 1 });

const courseModel = mongoose.model('Course',courseSchema);


export default courseModel;