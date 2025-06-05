import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
      restaurantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Restaurant',
            default:null,
        },
    name: { type: String, },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
        createdById: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'User',
               
          },
    role: { 
        type: String, 
        enum: ["User","CompanyAdmin"], 

    },
    createdBy : { type:String},
    status: { type: Boolean, default: true },

}, { timestamps: true });

userSchema.index({ email: 1, restaurantId: 1 });

const User = mongoose.model("User", userSchema);
export default User;

