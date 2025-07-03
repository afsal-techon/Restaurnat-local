import mongoose from 'mongoose';



const priceSchema = new mongoose.Schema({
  customerTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "customerTypes",
    default:null
  },
  subMethod: {
    type: String,
    default: null
  },
  price: {
    type: Number,
  }
});


const foodSchema =new mongoose.Schema({
    foodName: {
        type: String,
        required: true, 
    },
    // image: { type: String ,default:null },
    restaurantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true,
    },

    categoryId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true,
    },
    image: { type: String, default: null },

    foodType:{
        type:String,
        required:true
    },
    menuTypeIds:[
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'MenuType',
        }
      ],
    courseIds:[
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Course',
        }
      ],
      basePrice:{
        type:Number,
      },
      prices: [
        {
          customerTypeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "customerTypes",
            default:null
          },
          subMethod: {
            type: String,
            default: null
          },
          price: {
            type: Number,
          }

        }
      ],

    portions: [
        {
          name: { type: String,},
          conversion: {type:Number, default:1},
          base:{ type:Boolean, default:false},
          basePrice:{
            type:Number,
          },
          prices:[priceSchema]
        }
      ],
      kitchenId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Kitchen',
        default:null
    },
    special : {
        type:Boolean,
        default:false
    },
    addOnsIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'AddOns',
        }
      ],
      choices: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Choice',
        }
      ],

      offer: {
        startDate: Date,
        endDate: Date,
        discount: Number
      },
    createdById: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true, // CompanyAdmin or BranchAdmin who created it
    },
      createdBy: {
          type:String,
      },
  
},{
    timestamps:true
})

foodSchema.index(
  { foodName: 1, restaurantId: 1},
);


const foodModel = mongoose.model('Food',foodSchema);


export default foodModel;