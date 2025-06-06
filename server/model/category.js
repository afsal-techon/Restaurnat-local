import mongoose from 'mongoose';



const categorySchema =new mongoose.Schema({
    name: {
        type: String,
        required: true, // Example: "Manager", "Chef", "Waiter"
    },
    // image: { type: String ,default:null },
    // restaurantId: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Restaurant',
    //     required: true,
    // },
    
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



categorySchema.index({ name: 1, restaurantId: 1, isDeleted: 1 });

const categoryModel = mongoose.model('Category',categorySchema);


export default categoryModel;