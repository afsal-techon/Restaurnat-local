import mongoose from 'mongoose';

const billSettings =new mongoose.Schema({

         restaurantId: {
           type: mongoose.Schema.Types.ObjectId,
           ref: "restaurant",
           required: true,
         },

        isPriceChange:{ type: Boolean, default: false},
        vatExcluded:{ type: Boolean, default: false},
    createdById: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
      createdBy: {
          type:String,
      },
},{
    timestamps:true
})



const billSettingModel = mongoose.model('BillSetting',billSettings);


export default billSettingModel;