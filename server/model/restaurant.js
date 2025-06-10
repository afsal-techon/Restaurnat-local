import mongoose from "mongoose";


const restaurantSchema = new mongoose.Schema(
    {
        companyAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        
        User: { type: mongoose.Schema.Types.ObjectId, ref: "User" ,default:null },
        restaurant_id : { type : String, required:true},
        name: { type: String, required: true },
        address: { type: String, required: true },
        country : { type: String, required: true },
        logo: { type: String, default: null },
        state: { type: String, required: true },
        city: { type: String, required: true },
        phone: { type: String, required: true },
        phone2: { type: String  ,default:null},
        phone3: { type: String  ,default:null},
        email: { type: String },
        logo: { type: String ,default:null },
        openingTime: { type: String ,default:null },
        closingTime: { type: String ,default:null },
        vatPercentage: { type: Number , default:null },
        currency: { type: String ,default:null },
        currencySymbol: { type: String,default:null },

    },
    { timestamps: true }
);

//  Index for performance on isDeleted filtering
restaurantSchema.index(
    { restaurant_id: 1, companyAdmin: 1 }
  );
restaurantSchema.index({ restaurant_id: 1 });


const Restaurant = mongoose.model("Restaurant", restaurantSchema);
export default Restaurant;
