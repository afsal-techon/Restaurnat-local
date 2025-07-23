import PRINTER_CONFIG from '../../model/printConfig.js'
import USER from '../../model/userModel.js'
import SETTINGS from '../../model/posSettings.js'


export const upsertPrinterConfig = async (req, res, next) => {
  try {
    const {
  
      printerType, // "KOT" or "Receipt"
      printerName,
      printerIp,
      printerPort = 9100,
      kitchenId,
      customerTypeId,
    } = req.body;

    const user = await USER.findById(req.user);
        if (!user) return res.status(400).json({ message: "User not found!" })

    if (!printerName || !printerType || printerIp || printerPort ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const query = {  printerType };
    if (printerType === "KOT") query.kitchenId = kitchenId;
    if (printerType === "Receipt") query.customerTypeId = customerTypeId;

    const updated = await PRINTER_CONFIG.findOneAndUpdate(
      query,
      {
        printerType,
        printerName,
        printerIp,
        printerPort,
        kitchenId,
        customerTypeId,
      },
      { upsert: true, new: true }
    );

   return res.status(200).json({ message:'Printer configuration saved successfully.',data: updated})
  } catch (err) {
    next(err);
  }
};


export const getPritnerConfigs = async(req,res,next)=>{
    try {

        const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found!" })

        const configs = await PRINTER_CONFIG.find()
        .populate("kitchenId", "name")
      .populate("customerTypeId", "type");
       res.status(200).json(configs);
    } catch (err) {
        next(err)
    }
}


export const updatePosSettings = async (req, res, next) => {
  try {
    const userId = req.user; // You must extract this from middleware
    const { isKotSave, isKotPrint } = req.body;

    if (isKotSave === undefined && isKotPrint === undefined) {
      return res.status(400).json({ message: 'Nothing to update' });
    }

    const user = await USER.findById(userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Check if settings already exist
    let settings = await SETTINGS.findOne({ });

    if (!settings) {
      settings = await SETTINGS.create({
        isKotSave: isKotSave ?? false,
        isKotPrint: isKotPrint ?? false,
        createdById: userId,
        createdBy: user.name,
      });
    } else {
      if (isKotSave !== undefined) settings.isKotSave = isKotSave;
      if (isKotPrint !== undefined) settings.isKotPrint = isKotPrint;
      await settings.save();
    }

    return res.status(200).json({ message: 'POS settings updated', settings });

  } catch (err) {
    return next(err);
  }
};

