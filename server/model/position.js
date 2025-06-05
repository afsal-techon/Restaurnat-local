import mongoose from 'mongoose';



const positionSchema  =new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    restaurantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true,
    },
    departmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Department",
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

positionSchema.index({ restaurantId: 1, departmentId: 1, name: 1 });


const positionModel = mongoose.model('position',positionSchema);


export default positionModel;