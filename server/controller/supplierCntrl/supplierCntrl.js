import USER from '../../model/userModel.js';
import SUPPLIER from '../../model/supplier.js'
import { generateUniqueRefId } from '../POS controller/posOrderCntrl.js';
import TRANSACTION from '../../model/transaction.js';
import EXPENSE from '../../model/expense.js'
import PURCHASE from '../../model/purchase.js'
import mongoose from 'mongoose';


export const createSupplier = async (req, res, next) => {
  try {
    const {  supplierName, mobileNo, address,credit,trn } = req.body;
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
        trn:trn || null,
        createdById: user._id,
        createdBy: user.name,
         wallet: {
        credit: credit || 0,
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

// export const getOneSupplier = async (req, res, next) => {
//   try {
//     const { supplierId } = req.params;
//     const userId = req.user;

//     if (!supplierId) {
//       return res.status(400).json({ message: "Supplier Id is required!" });
//     }

//     const user = await USER.findOne({ _id: userId });
//     if (!user) {
//       return res.status(400).json({ message: "User not found!" });
//     }

//     const supplier = await SUPPLIER.findById(supplierId);
//     if (!supplier) {
//       return res.status(404).json({ message: "Supplier not found!" });
//     }

//     return res
//       .status(200)
//       .json({ data: supplier });
//   } catch (err) {
//     next(err);
//   }
// };


export const updateSupplier = async (req, res, next) => {
  try {
    // vendorId will come from URL params
    const { supplierId, supplierName, mobileNo, address ,credit,trn  } = req.body;
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
    supplier.trn = trn ||  null;
    supplier.wallet.credit = credit ;

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

       const hasPurchase = await PURCHASE.exists({ supplierId });
          if (hasPurchase) {
            return res.status(400).json({ message: "Cannot delete supplier linked to Purchase." });
          }
    
              const hasExpense = await EXPENSE.exists({ supplierId });
          if (hasExpense) {
            return res.status(400).json({ message: "Cannot delete supplier linked to Expense." });
          }

    await SUPPLIER.findByIdAndDelete(supplierId)

    return res
      .status(200)
      .json({ message: "Supplier deleted successfully!" });
  } catch (err) {
    next(err);
  }
};





export const getSupplierDueHistory = async (req, res, next) => {
  try {
    const { supplierId, fromDate, toDate, search = '' } = req.query;
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const supplier = await SUPPLIER.findById(supplierId);
    if (!supplier) return res.status(404).json({ message: "Supplier not found" });

    const matchStage = {
      supplierId: new mongoose.Types.ObjectId(supplierId)
    };

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    if (search) {
      matchStage.$or = [
        { referenceId: { $regex: search, $options: 'i' } },
        { referenceType: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const pipeline = [
      { $match: matchStage },
      { $sort: { createdAt: 1 } },

      // Join account info
      {
        $lookup: {
          from: "accounts",
          localField: "accountId",
          foreignField: "_id",
          as: "accountInfo"
        }
      },
      { $unwind: "$accountInfo" },

      // Filter only Supplier Due Payment or Purchase via Credit
      {
        $match: {
          $or: [
            { referenceType: "Supplier Due Payment" },
            {
              referenceType: "Purchase",
              "accountInfo.accountType": "Credit"
            }
          ]
        }
      },

      // Join parent account
      {
        $lookup: {
          from: "accounts",
          let: { parentId: "$accountInfo.parentAccountId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$parentId"] } } }
          ],
          as: "parentInfo"
        }
      },
      { $unwind: { path: "$parentInfo", preserveNullAndEmptyArrays: true } },

      // Join payment method
      {
        $lookup: {
          from: "accounts",
          localField: "paymentType",
          foreignField: "_id",
          as: "paymentTypeInfo"
        }
      },
      { $unwind: { path: "$paymentTypeInfo", preserveNullAndEmptyArrays: true } },

      // Add credit/debit tags for calculation
      {
        $addFields: {
          credit: {
            $cond: [
              { $eq: ["$referenceType", "Supplier Due Payment"] },
              "$amount",
              0
            ]
          },
          debit: {
            $cond: [
              { $eq: ["$referenceType", "Purchase"] },
              "$amount",
              0
            ]
          }
        }
      },

      // Group to calculate totals
      {
        $group: {
          _id: null,
          transactions: { $push: "$$ROOT" },
          totalCredit: { $sum: "$credit" },
          totalDebit: { $sum: "$debit" }
        }
      },

      // Add running due balance
      {
        $addFields: {
          transactionsWithRunningBalance: {
            $reduce: {
              input: "$transactions",
              initialValue: {
                runningDue: 0,
                transactions: []
              },
              in: {
                runningDue: {
                  $add: [
                    "$$value.runningDue",
                    {
                      $cond: [
                        { $eq: ["$$this.referenceType", "Purchase"] },
                        "$$this.amount",
                        { $multiply: ["$$this.amount", -1] }
                      ]
                    }
                  ]
                },
                transactions: {
                  $concatArrays: [
                    "$$value.transactions",
                    [
                      {
                        $mergeObjects: [
                          "$$this",
                          {
                            dueBalance: {
                              $add: [
                                "$$value.runningDue",
                                {
                                  $cond: [
                                    { $eq: ["$$this.referenceType", "Purchase"] },
                                    "$$this.amount",
                                    { $multiply: ["$$this.amount", -1] }
                                  ]
                                }
                              ]
                            },
                            account: {
                              name: "$$this.accountInfo.accountName",
                              type: "$$this.accountInfo.accountType"
                            },
                            parentAccount: {
                              name: "$$this.parentInfo.accountName",
                              type: "$$this.parentInfo.accountType"
                            },
                            paymentMethod: {
                              $ifNull: ["$$this.paymentTypeInfo.accountName", null]
                            }
                          }
                        ]
                      }
                    ]
                  ]
                }
              }
            }
          }
        }
      },

      {
        $project: {
          allData: "$transactionsWithRunningBalance.transactions",
          totalCredit: 1,
          totalDebit: 1
        }
      },

      {
        $addFields: {
          data: { $slice: ["$allData", skip, limit] },
          totalCount: { $size: "$allData" },
          totalDue: {
            $subtract: ["$totalDebit", "$totalCredit"]
          }
        }
      },

      {
        $project: {
          data: 1,
          totalCount: 1,
          totalCredit: 1,
          totalDebit: 1,
          totalDue: 1
        }
      }
    ];

    const result = await TRANSACTION.aggregate(pipeline);

    const final = result[0] || {
      data: [],
      totalCount: 0,
      totalCredit: 0,
      totalDebit: 0,
      totalDue: 0
    };

    return res.status(200).json({
      data: final.data,
      totalCount: final.totalCount,
      totalCredit: final.totalCredit,
      totalDebit: final.totalDebit,
      totalDue: final.totalDue,
      page,
      limit
    });

  } catch (err) {
    next(err);
  }
};


export const SupplierDueHistoryPdf = async (req, res, next) => {
  try {
    const { supplierId, fromDate, toDate, search = "" } = req.query;

    const supplier = await SUPPLIER.findById(supplierId);
    if (!supplier) return res.status(404).json({ message: "Supplier not found" });

    const matchStage = {
      supplierId: new mongoose.Types.ObjectId(supplierId)
    };

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    if (search) {
      matchStage.$or = [
        { referenceId: { $regex: search, $options: "i" } },
        { referenceType: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    const pipeline = [
      { $match: matchStage },
      { $sort: { createdAt: 1 } },
      {
        $lookup: {
          from: "accounts",
          localField: "accountId",
          foreignField: "_id",
          as: "accountInfo"
        }
      },
      { $unwind: "$accountInfo" },
      {
        $match: {
          $or: [
            { referenceType: "Supplier Due Payment" },
            {
              referenceType: "Purchase",
              "accountInfo.accountType": "Credit"
            }
          ]
        }
      },
      {
        $lookup: {
          from: "accounts",
          let: { parentId: "$accountInfo.parentAccountId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$parentId"] } } }
          ],
          as: "parentInfo"
        }
      },
      { $unwind: { path: "$parentInfo", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "accounts",
          localField: "paymentType",
          foreignField: "_id",
          as: "paymentTypeInfo"
        }
      },
      { $unwind: { path: "$paymentTypeInfo", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          credit: {
            $cond: [{ $eq: ["$referenceType", "Supplier Due Payment"] }, "$amount", 0]
          },
          debit: {
            $cond: [{ $eq: ["$referenceType", "Purchase"] }, "$amount", 0]
          }
        }
      },
      {
        $project: {
          date: "$createdAt",
          referenceId: 1,
          referenceType: 1,
          accountType: "$accountInfo.accountType",
          accountName: "$accountInfo.accountName",
          credit: 1,
          debit: 1
        }
      }
    ];

    const data = await TRANSACTION.aggregate(pipeline);

    const totalCredit = data.reduce((sum, item) => sum + item.credit, 0);
    const totalDebit = data.reduce((sum, item) => sum + item.debit, 0);
    const totalDue = totalDebit - totalCredit;

    const pdfBuffer = await generatePDF("supplierDueHistory", {
      data,
      supplier: supplier.name,
      filters: { fromDate, toDate, search },
      totalCredit,
      totalDebit,
      totalDue
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Supplier-Due-History-${Date.now()}.pdf"`
    });

    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};



export const paySupplierDue = async (req, res, next) => {
  try {
    const userId = req.user;
    const { restaurantId, supplierId, amount, accountId, note } = req.body;

    if (!supplierId || !amount || !accountId) {
      return res.status(400).json({ message: "All fields are required!" });
    }

    const user = await USER.findById(userId).lean();
    if (!user) return res.status(404).json({ message: "User not found!" });

    const supplier = await SUPPLIER.findById(supplierId);
    if (!supplier) return res.status(404).json({ message: "Supplier not found!" });

    const currentDue = supplier.wallet.credit || 0;
    console.log(amount,'amoun')
    console.log(currentDue,'curent')
    if (amount > currentDue) {
      return res.status(400).json({ message: "Amount exceeds supplier's due!" });
    }

    // Deduct due
    supplier.wallet.credit = currentDue - amount || 0;
    await supplier.save();

    // Create Transaction entry - Money going out from account (Cash/Bank)
    const refId = await generateUniqueRefId();

    await TRANSACTION.create({
      restaurantId,
      accountId,              // e.g. cash/bank
      amount,
      type: "Debit",          // money going out
      referenceId: refId,
      referenceType: "Supplier Due Payment",
      description: note || `Payment to Supplier: ${supplier.name}`,
      createdById: userId,
      createdBy: user.name,
      supplierId: supplier._id
    });

    return res.status(200).json({
      message: "Supplier due payment recorded successfully!",
    });

  } catch (err) {
    next(err);
  }
};


