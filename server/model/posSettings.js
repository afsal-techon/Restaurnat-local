import mongoose from 'mongoose';

const posSettingsSchema =new mongoose.Schema({

        isKotSave:{ type: Boolean, default: false},
        isKotPrint:{ type: Boolean, default: false},
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