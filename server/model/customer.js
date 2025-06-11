
import mongoose from "mongoose";

const customerSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true,
  },
  name: {
    type: String,
    trim: true,
  },
  mobileNo: {
    type: String,
    trim: true,
  },
  address: {
    type: String,
    trim: true,
    default: '',
  },
  credit: {
    type: Number,
    default: 0,
  },
    createdById: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
         // CompanyAdmin or BranchAdmin who created it
    },
    createdBy:{
        type:String,
    },
}, { timestamps: true });

customerSchema.index({ restaurantId: 1, mobileNo: 1 });

const customerModel = mongoose.model('Customer', customerSchema);
export default customerModel;
