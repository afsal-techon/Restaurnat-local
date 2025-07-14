import USER from '../../model/userModel.js';
import SUPPLIER from '../../model/supplier.js'


export const createSupplier = async (req, res, next) => {
  try {
    const {  supplierName, mobileNo, address,credit,debit } = req.body;
    const userId = req.user;


    if (!supplierName || typeof supplierName !== "string" || !supplierName.trim()) {
      return res.status(400).json({ message: "Supplier name is required!" });
    }

    if (!mobileNo || typeof mobileNo !== "string" || !mobileNo.trim()) {
      return res.status(400).json({ message: "Mobile number is required!" });
    }

    const user = await USER.findOne({ _id: userId });
    if (!user) {
      return res.status(400).json({ message: "User not found!" });
    }

    const createdVendors = [];

      const existingVendor = await SUPPLIER.findOne({
        
        supplierName: { $regex: `^${supplierName}$`, $options: "i" },
      }).collation({ locale: "en", strength: 2 });

      if (existingVendor) {
        return res.status(400).json({
          message: `Supplier '${supplierName}' already exists!`,
        });
      }

      const vendor = await SUPPLIER.create({
        supplierName: supplierName.trim(),
        mobileNo: mobileNo.trim(),
        address: address?.trim() || "",
        createdById: user._id,
        createdBy: user.name,
         wallet: {
        credit: credit || 0,
       debit: debit || 0
  }
      });

      createdVendors.push(vendor);
  

    return res.status(201).json({
      message: "Supplier created successfully!",
      data: createdVendors,
    });
  } catch (err) {
    next(err);
  }
};


export const getSuppliers = async (req, res, next) => {
  try {
 
    const userId = req.user;
    const user = await USER.findOne({ _id: userId});
    if (!user) {
      return res.status(400).json({ message: "User not found!" });
    }

    const suppliers = await SUPPLIER.find({ }).sort({
      createdAt: -1,
    });

    let totalCredit = 0;
    let totalDebit = 0;

    suppliers.forEach(supplier=>{
      totalCredit += supplier.wallet.credit || 0;
      totalDebit += supplier.wallet.debit || 0;
    });

    return res.status(200).json({
      data: suppliers,
      totalCredit,
      totalDebit,
    });
  } catch (err) {
    next(err);
  }
};


export const updateSupplier = async (req, res, next) => {
  try {
    // vendorId will come from URL params
    const { supplierId, supplierName, mobileNo, address } = req.body;
    const userId = req.user;

    if (!supplierId) {
      return res.status(400).json({ message: "supplierId is required!" });
    }

    if (!supplierName || typeof supplierName !== "string" || !supplierName.trim()) {
      return res.status(400).json({ message: "Supplier name is required!" });
    }

    if (!mobileNo || typeof mobileNo !== "string" || !mobileNo.trim()) {
      return res.status(400).json({ message: "Mobile number is required!" });
    }

    const user = await USER.findOne({ _id: userId});
    if (!user) {
      return res.status(400).json({ message: "User not found!" });
    }

    const supplier = await SUPPLIER.findOne({
      _id: supplierId,
    });
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found!" });
    }

    const duplicateVendor = await SUPPLIER.findOne({
      _id: { $ne: supplierId }, // _id not equal to current vendorId
      supplierName: { $regex: `^${supplierName}$`, $options: "i" },
      isDeleted: false,
    }).collation({ locale: "en", strength: 2 });

    if (duplicateVendor) {
      return res
        .status(400)
        .json({ message: "Another Supplier with this name already exists!" });
    }

    // Update vendor
    supplier.supplierName = supplierName.trim();
    supplier.mobileNo = mobileNo.trim();
    supplier.address = address?.trim() || "";

    await supplier.save();

    return res.status(200).json({
      message: "Supplier updated successfully!",
      data: supplier,
    });
  } catch (err) {
    next(err);
  }
};


export const deleteSupplier = async (req, res, next) => {
  try {
    const { supplierId } = req.params;
    const userId = req.user;

    if (!supplierId) {
      return res.status(400).json({ message: "Supplier Id is required!" });
    }

    const user = await USER.findOne({ _id: userId });
    if (!user) {
      return res.status(400).json({ message: "User not found!" });
    }

    const supplier = await SUPPLIER.findById(supplierId);
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found!" });
    }

    await SUPPLIER.findByIdAndDelete(supplierId)

    return res
      .status(200)
      .json({ message: "Supplier deleted successfully!" });
  } catch (err) {
    next(err);
  }
};