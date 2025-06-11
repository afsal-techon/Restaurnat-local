import mongoose from "mongoose";


const paymentSchema = new mongoose.Schema({
    orderId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Order", 
      required: true 
    },
    methods: [{
      method: { 
        type: String, 
        enum: ["cash", "card", "online", "due"], 
        required: true 
      },
      amount: { 
        type: Number, 
        required: true 
      },
      // Cash specific fields
      receivedAmount: { 
        type: Number 
      },
      changeGiven: { 
        type: Number 
      },
      // Card specific fields
      last4Digits: { 
        type: String 
      },
      transactionId: { 
        type: String 
      },
      // Online payment fields
      paymentGateway: { 
        type: String 
      },
      gatewayReference: { 
        type: String 
      }
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


  const paymentModel = mongoose.model('paymentRecord',paymentSchema);
  export default paymentModel;