import mongoose from "mongoose";


const paymentSchema = new mongoose.Schema({
    orderId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Order", 
      required: true 
    },
  methods: [{
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Accounts',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
   receivedAmount: { 
        type: Number 
      },
      changeGiven: { 
        type: Number 
      },
}],
    grandTotal: { 
      type: Number, 
      required: true 
    },
    paidAmount: { 
      type: Number, 
      required: true 
    },
    dueAmount: { 
      type: Number, 
      default: 0 
    },
    changeAmount: { 
      type: Number, 
      default: 0 
    },
       createdById: {
           type: mongoose.Schema.Types.ObjectId,
           ref: 'User',
           required: true, // CompanyAdmin or BranchAdmin who created it
       },
       createdBy:{
           type:String,
       },
  }, { timestamps: true });


paymentSchema.index({ createdAt: 1 });
paymentSchema.index({ orderId: 1 });
paymentSchema.index({ createdById: 1 });


  const paymentModel = mongoose.model('paymentRecord',paymentSchema);
  export default paymentModel;