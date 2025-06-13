import ACCOUNTS from '../../model/account.js'
import USER from '../../model/userModel.js';
import RESTAURANT from '../../model/restaurant.js'



export const createAccounts = async (req, res,next) => {
    try {
      const {
        restaurantId,
        accountName,
        accountType,
        description,
        openingBalance,
        showInPos,
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
      const existing = await ACCOUNTS.findOne({ restaurantId, accountName });
      if (existing) {
        return res.status(400).json({ message: 'Account name already exists.' });
      }
  
      const newAccount = new ACCOUNTS({
        restaurantId,
        accountName,
        accountType,
        description,
        openingBalance,
        showInPos
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

    
    const accounts = await ACCOUNTS.find({ restaurantId });
    return res.status(200).json({ data:accounts})
    } catch (err) {
        next(err)
    }
  }


  export const updateAccount = async (req, res, next) => {
    try {
      const { accountId } = req.params;
      const {
        restaurantId,
        accountName,
        accountType,
        description,
        showInPos,
        openingBalance
      } = req.body;
  
      const userId = req.user;
      const user = await USER.findOne({ _id: userId });
      if (!user) {
        return res.status(400).json({ message: "User not found!" });
      }
  
      if (!restaurantId || !accountName || !accountType) {
        return res.status(400).json({ message: "Missing required fields!" });
      }
  
      const existingAccount = await ACCOUNTS.findOne({
        _id: { $ne: accountId }, // exclude current account from check
        restaurantId,
        accountName
      });
  
      if (existingAccount) {
        return res.status(400).json({ message: "Account name already exists." });
      }
  
      const updated = await ACCOUNTS.findByIdAndUpdate(
        accountId,
        {
          restaurantId,
          accountName,
          accountType,
          description,
          openingBalance,
          showInPos,
        },
        { new: true }
      );
  
      if (!updated) {
        return res.status(404).json({ message: "Account not found." });
      }
  
      res.status(200).json({
        message: "Account updated successfully.",
        data: updated
      });
    } catch (err) {
      next(err);
    }
  };

  export const deleteAccount = async (req, res, next) => {
    try {
      const { accountId } = req.params;

      const userId = req.user;

      const user = await USER.findOne({ _id: userId })
           if (!user) {
               return res.status(400).json({ message: "User not found!" });
           }
  
      const account = await ACCOUNTS.findById(accountId);
      if (!account) {
        return res.status(404).json({ message: "Account not found." });
      }
  
      const hasTransactions = await TRANSACTION.exists({ accountId });
      if (hasTransactions) {
        return res.status(400).json({ message: "Cannot delete account linked to transactions." });
      }
  
      await ACCOUNTS.findByIdAndDelete(accountId);
  
      res.status(200).json({ message: "Account permanently deleted." });
    } catch (err) {
      next(err);
    }
  };
  

  export const defaultStatusAccounts = async (req,res,next)=>{
    try {

      const { accountId,defaultAccount } = req.params
      const userId = req.user;
      const user = await USER.findOne({ _id: userId });
      if (!user) {
        return res.status(400).json({ message: "User not found!" });
      }

      if(!defaultAccount){
        return res.status(400).json({ message:"status not found!"})
      }

      const acccount = await ACCOUNTS.findById(accountId);
      if(!acccount){
        return res.status(400).json({ message:'Account not found!'})
      }

      acccount.defaultAccount = defaultAccount;
      acccount.save();

      return res.status(200).json({ message:'Updated successfully'})


    } catch (err) {
      next(err)
    }
  }



  