import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  foodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Food",
    required: true,
  },
  foodName: {
    type: String,
    required: true,
  },
  portion: {
    type: String, // Name of the portion, like "Full", "Half", etc.
  },
  price: {
    type: Number,
    required: true,
  },
  qty: {
    type: Number,
    required: true,
  },
  total: {
    type: Number,
    required: true,
  },
  discount: {
    type: Number,
    default: 0, // Discount per item from food
  },
  addOns: [
    {
      addOnId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AddOn",
      },
      name: String,
      portion: String,
      price: Number,
      qty:Number,
      default:[],
    },
  ],
  choices: [
    {
      choiceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Choice"
      },
      name: String,
      default:[],
    },
    
  ]
});

const orderSchema = new mongoose.Schema(
  {
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "table",
      default:null
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default:null,
    },
    customerTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customerTypes",
      required: true,
    },
    counterId:{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Counter",
      default:null
    },
    subMethod: {
      type: String, // e.g., "Zomato", "Swiggy", etc.
    },
    items: [orderItemSchema],
    vat: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0, // You can later calculate full-order level discounts if needed
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    subTotal: {
      type: Number,
    },
    orderType: {
      type: String,
    },
    orderNo: {
      type: String, // For takeaway, could be "108"
      unique: true,
    },
    order_id: {
      type: String, // e.g., "ORD-343SS"
      required: true,
      unique: true
    },
    ticketNo: {
      type: String, // e.g., "KOT-001"
    },
    status: {
      type: String,
      enum: ["Placed", "Completed", "Cancelled"],
      default: "Placed",
    },
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
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
  },
  { timestamps: true }
);

// Add indexes
// 1. Unique order number per restaurant
orderSchema.index({ order_id: 1, restaurantId: 1 }, { unique: true });
orderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
orderSchema.index({ tableId: 1, status: 1 });
orderSchema.index({ createdById: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, "items.kitchenId": 1, status: 1 });

 const orderModel = mongoose.model("Order", orderSchema);
 export default orderModel;
