import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
      restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Restaurant',
            default:null,
        },
        name:{
            type:String,
            default:'User'
        },
        pin: {
      type: String, // hashed version will be stored
      minlength: 4,
      maxlength: 4,
    },
        createdById: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'User',
               
          },
            createdBy: {
          type:String,
      },
    role: { 
        type: String, 
        enum: ["User","CompanyAdmin"], 

    },

   access: {
    type: [String],
    enum: ['Admin', 'Reports', 'Sales', 'MenuManagement'],
    default: []
  },
    
    status: { type: Boolean, default: true },

}, { timestamps: true });

userSchema.index({  restaurantId: 1 });

const User = mongoose.model("User", userSchema);
export default User;

