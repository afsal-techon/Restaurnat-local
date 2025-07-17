import mongoose from 'mongoose';

const posSettingsSchema =new mongoose.Schema({
    isKotTicket: {
        type: Boolean,
        default: false
    },
    isPrint:{
        type:Boolean,
        default:false
    },
    isPrintandKOT:{
        type:Boolean,
        default:false
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
      createdBy: {
          type:String,
      },
},{
    timestamps:true
})



const posSettingsModel = mongoose.model('PosSetting',posSettingsSchema);


export default posSettingsModel;