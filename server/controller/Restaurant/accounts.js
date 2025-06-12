import ACCOUTNS from '../../model/account.js'
import USER from '../../model/userModel.js';
import RESTAURANT from '../../model/restaurant.js'



export const createAccounts = async (req, res,next) => {
    try {
      const {
        restaurantId,
        accountName,
        accountType,
        description,
        openingBalance
      } = req.body;

      const userId = req.user;

   const user = await USER.findOne({ _id: userId })
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

        if(!restaurantId){
            return res.status(400).json({ message:'Restaurnt Id is required!'})
        }
        if(!accountName){
            return res.status(400).json({ message:'Account name is required!'})
        }
        if(!accountType){
            return res.status(400).json({ message:'Account type is required!'})
        }

      // Optional: prevent duplicate account names in same restaurant
      const existing = await ACCOUTNS.findOne({ restaurantId, accountName });
      if (existing) {
        return res.status(400).json({ message: 'Account name already exists.' });
      }
  
      const newAccount = new Account({
        restaurantId,
        accountName,
        accountType,
        description,
        openingBalance
      });
  
      await newAccount.save();
  
      res.status(201).json({
        message: 'Account created successfully.',
        data: newAccount
      });
    } catch (err) {
      next(err)
    }
  };



  export const getAccounts = async(req,res,next)=>{
    try {

        const { restaurantId } = req.params;

        const userId = req.user;

        const user = await USER.findOne({ _id: userId })
             if (!user) {
                 return res.status(400).json({ message: "User not found!" });
             }

    
    const accounts = await ACCOUTNS.find({ restaurantId });
    return res.status(200).json({ data:accounts})
    } catch (err) {
        next(err)
    }
  }