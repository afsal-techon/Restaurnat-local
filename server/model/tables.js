import mongoose from 'mongoose';



const tableSchema  =new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    capacity:{
        type:Number
    },
    restaurantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true,
    },
    floorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Floor",
        required: true,
    },
    currentStatus: {
        type: String,
        enum: ['Available', 'Running', 'VacatingSoon', 'RunningKOT'],
        default: 'Available',
      },
      runningSince: {
        type: Date,
        default: null,
      },
    createdById: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true, // CompanyAdmin or BranchAdmin who created it
    },
    currentOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order', 
        default: null
      },
      totalAmount: {
        type: Number,
        default:null
      },
    createdBy:{
        type:String,
    },
    status:{
         type:Boolean,default:true
    },
        isDeleted: { type: Boolean, default: false },
            deletedAt: { type: Date, default: null },
            deletedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" ,default:null },
            deletedBy: { type: String, default: null }
},{
    timestamps:true
})

tableSchema.index(
    { name: 1, floorId: 1, restaurantId: 1 },
    { unique: true, partialFilterExpression: { isDeleted: false } }
  );

  tableSchema.index({ restaurantId: 1, floorId: 1, isDeleted: 1 });

const tableModel = mongoose.model('table',tableSchema);


export default tableModel;