import PRINTER_CONFIG from '../../model/printConfig.js'
import USER from '../../model/userModel.js'


export const upsertPrinterConfig = async (req, res, next) => {
  try {
    const {
  
      printerType, // "KOT" or "Receipt"
      printerName,
      kitchenId,
      customerTypeId,
    } = req.body;

    const user = await USER.findById(req.user);
        if (!user) return res.status(400).json({ message: "User not found!" })

    if (!printerName || !printerType ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const query = {  printerType };
    if (printerType === "KOT") query.kitchenId = kitchenId;
    if (printerType === "Receipt") query.customerTypeId = customerTypeId;

    const updated = await PRINTER_CONFIG.findOneAndUpdate(
      query,
      {
        printerName,
        kitchenId,
        customerTypeId,
        printerType,
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
