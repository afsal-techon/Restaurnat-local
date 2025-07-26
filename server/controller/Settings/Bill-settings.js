import USER from '../../model/userModel.js'
import  BILL_SETTINGS from '../../model/billSettings.js'


export const updateBillSettings = async (req, res, next) => {
  try {
    const userId = req.user; // You must extract this from middleware
    const { isPriceChange, isIncludeVAT ,restaurantId } = req.body;

    if (isPriceChange === undefined && isIncludeVAT === undefined) {
      return res.status(400).json({ message: 'Nothing to update' });
    }

    if(!restaurantId){
      return res.status(400).json({ message:"Restaurnat Id is required"})
    }

    const user = await USER.findById(userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Check if settings already exist
    let settings = await BILL_SETTINGS.findOne({ });

    if (!settings) {
      settings = await BILL_SETTINGS.create({
        restaurantId,
        isPriceChange: isPriceChange ?? false,
        isIncludeVAT: isIncludeVAT ?? false,
        createdById: userId,
        createdBy: user.name,
      });
    } else {
      if (isPriceChange !== undefined) settings.isPriceChange = isPriceChange;
      if (isIncludeVAT !== undefined) settings.isIncludeVAT = isIncludeVAT;
      await settings.save();
    }

    return res.status(200).json({ message: 'Bill settings updated', settings });

  } catch (err) {
    return next(err);
  }
};


