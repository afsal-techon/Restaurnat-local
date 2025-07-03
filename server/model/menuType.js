import mongoose from 'mongoose';



const menuScehma =new mongoose.Schema({
    name: {
        type: String,
        required: true, 
    },
    restaurantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true,
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

menuScehma.index(
    { name: 1, restaurantId: 1 },
  );
  


const menuModel = mongoose.model('MenuType',menuScehma);


export default menuModel;