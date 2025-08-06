import mongoose from "mongoose";


const kotNotificationSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant' },
  kitchenId: { type: mongoose.Schema.Types.ObjectId, ref: 'Kitchen' },
  items: [
    {
      // For regular items
      foodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Food' },
      name: { type: String },
      portion: { type: String },
      quantity: { type: Number },
      status: {
        type: String,
        enum: ['Pending', 'Preparing', 'Ready' ,'Rejected'],
        default: 'Pending'
      },
      message: { type: String },
      
      // For combo items
      isComboItem: { type: Boolean, default: false },
      comboId: { type: mongoose.Schema.Types.ObjectId, ref: 'Combo' },
      comboName: { type: String },
      comboItems: [
        {
          foodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Food' },
          name: { type: String },
          portion: { type: String },
          quantity: { type: Number },
          status: {
            type: String,
            enum: ['Pending', 'Preparing', 'Ready','Rejected'],
            default: 'Pending'
          },
          isComboItem: { type: Boolean, default: true }
        }
      ]
    }
  ],
  status: { type: String, enum: ['Pending', 'Preparing', 'Ready','Rejected'], default: 'Pending' },
  readyAt: { type: Date },
  acceptedAt: { type: Date },
  orderType :{type:String},
  orderTime: { type: Date },
  tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'table' },
  preparationTime:  { type: Date },
  preparedAt:{type:Date},
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  order_id: { type: String },
  orderNo: { type: String },
  ticketNo: { type: String },
  message: { type: String },
  isAdditionalKOT: { type: Boolean, default: false },
       deliveryDate: {
      type: Date,
      default:null,
    },
    deliveryTime: {
      type: String, // or Date if you prefer
      default:null,
    },
}, {
  timestamps: true
});

kotNotificationSchema.index({ kitchenId: 1, orderId: 1, status: 1 });

const kotNotificationModel = mongoose.model('KotNotification', kotNotificationSchema);
export default kotNotificationModel;