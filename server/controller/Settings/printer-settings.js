import PRINTER_CONFIG from '../../model/printConfig.js'
import USER from '../../model/userModel.js'
import SETTINGS from '../../model/posSettings.js'



export const upsertPrinterConfig = async (req, res, next) => {
  try {
    const {
      printerType,
      printerName,
      printerIp,
      kitchenId,
      customerTypeId,
      isUniversal = false, // default false if not passed
    } = req.body;

    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found!" });

    if (!printerName || !printerType || !printerIp) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Prevent duplicate with same IP + type + kitchen/customer
    const existing = await PRINTER_CONFIG.findOne({
      printerType,
      printerIp,
      ...(printerType === 'CustomerType' && { customerTypeId }),
      ...(printerType === 'KOT' && { kitchenId }),
    });

    if (existing) {
      return res.status(400).json({ message: 'Printer with same configuration already exists.' });
    }

    // Optional: Only one universal printer per printerType
    if (isUniversal) {
      await PRINTER_CONFIG.updateMany(
        { printerType, isUniversal: true },
        { $set: { isUniversal: false } }
      );
    }

    const query = { printerType };
    if (printerType === "KOT") query.kitchenId = kitchenId;
    if (printerType === "CustomerType") query.customerTypeId = customerTypeId;

    const updated = await PRINTER_CONFIG.findOneAndUpdate(
      query,
      {
        printerType,
        printerName,
        printerIp,
        kitchenId: printerType === 'KOT' ? kitchenId : null,
        customerTypeId: printerType === 'CustomerType' ? customerTypeId : null,
        isUniversal: isUniversal === true,
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({ message: 'Printer configuration saved successfully.', data: updated });
  } catch (err) {
    next(err);
  }
};




export const updatePrinterConfig = async (req, res, next) => {
  try {
  
    const {
      printerId,
      printerType,
      printerName,
      printerIp,
      kitchenId,
      customerTypeId,
      isUniversal = false, // default to false if not passed
    } = req.body;
    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found!" });

    if (!printerId || !printerName || !printerType || !printerIp) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check for duplicate IP with same config excluding current printerId
    const duplicate = await PRINTER_CONFIG.findOne({
      _id: { $ne: printerId },
      printerType,
      printerIp,
      ...(printerType === 'CustomerType' && { customerTypeId }),
      ...(printerType === 'KOT' && { kitchenId }),
    });

    if (duplicate) {
      return res.status(400).json({ message: "Another printer with the same configuration already exists." });
    }

    const updated = await PRINTER_CONFIG.findByIdAndUpdate(
      printerId,
      {
        printerType,
        printerName,
        printerIp,
        kitchenId: printerType === 'KOT' ? kitchenId : null,
        customerTypeId: printerType === 'CustomerType' ? customerTypeId : null,
        isUniversal: isUniversal === true,
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Printer configuration not found." });
    }

    return res.status(200).json({
      message: "Printer configuration updated successfully.",
      data: updated,
    });

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
    const { isKotSave, isKotPrint ,restaurantId } = req.body;

    if (isKotSave === undefined && isKotPrint === undefined) {
      return res.status(400).json({ message: 'Nothing to update' });
    }

    if(!restaurantId){
      return res.status(400).json({ message:"Restaurnat Id is required"})
    }

    const user = await USER.findById(userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Check if settings already exist
    let settings = await SETTINGS.findOne({ });

    if (!settings) {
      settings = await SETTINGS.create({
        restaurantId,
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

export const getPosSettings = async(req,res,next)=>{
    try {
      const { restaurantId } = req.params;
        const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found!" });

    if(!restaurantId){
      return res.status(400).json({ message:'Restaurnat Id is required!'})
    }

        const configs = await SETTINGS.findOne({ restaurantId })
       res.status(200).json(configs);
    } catch (err) {
        next(err)
    }
}


export const deletePrinterConfig = async (req, res, next) => {
  try {
    const { printerId } = req.params;

    if (!printerId) {
      return res.status(400).json({ message: "Printer ID is required" });
    }

    const deleted = await PRINTER_CONFIG.findByIdAndDelete(printerId);

    if (!deleted) {
      return res.status(404).json({ message: "Printer not found" });
    }

    return res.status(200).json({ message: "Printer deleted successfully." });
  } catch (err) {
    next(err)
  }
};
