import ACCOUNTS from '../../model/account.js'
import USER from '../../model/userModel.js';
import RESTAURANT from '../../model/restaurant.js'
import TRANSACTION from '../../model/transaction.js';
import { generateUniqueRefId } from '../POS controller/posOrderCntrl.js'
import PURCHASE from '../../model/purchase.js'
import SUPPLIER from '../../model/supplier.js'
import mongoose from 'mongoose';

 


export const createPurchase = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found!" });

    const {
      date,
      invoiceNo,
      supplierId,
      paymentModeId,
      items,
      note,
      totalAmount,
      baseTotal,
      vatTotal,
      isVatInclusive,
    } = req.body;


        if (!date) {
        return res.status(400).json({ message: "Purchase date is required!" });
        }

        if (!supplierId) {
        return res.status(400).json({ message: "Supplier ID is required!" });
        }

        if (!paymentModeId) {
        return res.status(400).json({ message: "Payment mode (Account ID) is required!" });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "At least one purchase item is required!" });
        }

    // const totalAmount = items.reduce((sum, item) => {
    //   return sum + item.price * item.quantity;
    // }, 0);

    const account = await ACCOUNTS.findOne({ accountType:'Purchase'}).lean();
    const paymentAccount = await ACCOUNTS.findOne({ _id: paymentModeId }).lean();
    const supplier = await SUPPLIER.findById(supplierId)

    if(paymentAccount.accountType == "Credit"){
       const previousBalance = supplier.wallet.credit || 0;
       supplier.wallet.credit = previousBalance + totalAmount;
       await supplier.save()
    }

    
      if(!account){
      return res.status(400).json({ message:'Account not found!'})
    }


    const refId = await generateUniqueRefId();

    // 1. Save Purchase
    const purchase = await PURCHASE.create({
      date,
      invoiceNo,
      supplierId,
      paymentModeId,
      accountId : account._id,
      items: items.map((item) => ({
        ingredientId: item.ingredientId,
        price: item.price,
        quantity: item.quantity,
        total: item.total,
        vatAmount: item.vatAmount,
        baseTotal:item.baseTotal,
      })),
      totalAmount,
      totalBeforeVAT :baseTotal,
      note,
      vatTotal,
      createdById: user._id,
      isVatInclusive,
      createdBy:user.name,
    });

    // 2. Create transaction records
    const debitTxn = {
      restaurantId : account.restaurantId || null,
      purchaseId: purchase._id,
      accountId: account._id, // supplier account
      paymentType: paymentModeId,
      supplierId,
      vatAmount : vatTotal,
      amount: totalAmount,
      totalBeforeVAT:baseTotal,
      type: "Debit",
      referenceId: refId,
      referenceType: account.accountType ||  "Purchase",
      description: note || `Purchase from supplier #${invoiceNo}`,
      createdById: user._id,
      createdBy:user.name,
    };

    const paymentTxn = {
      restaurantId : account.restaurantId || null,
      purchaseId: purchase._id,
      accountId: paymentModeId,
      amount: totalAmount,
      type: "Debit",
      referenceId: refId,
      referenceType: account.accountType ||  "Purchase",
      description:note || `Payment for Purchase #${invoiceNo}`,
      createdById: user._id,
      createdBy:user.name,
    };

    await TRANSACTION.insertMany([debitTxn, paymentTxn]);

    return res.status(200).json({ message: "Purchase created successfully!" });
  } catch (err) {
    next(err);
  }
};

export const getPurchaseList = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found!" });

    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const pipeline = [
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "suppliers",
          localField: "supplierId",
          foreignField: "_id",
          as: "supplier"
        }
      },
      { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "accounts",
          localField: "paymentModeId",
          foreignField: "_id",
          as: "paymentAccount"
        }
      },
      { $unwind: { path: "$paymentAccount", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "accounts",
          localField: "accountId",
          foreignField: "_id",
          as: "purchaseAccount"
        }
      },
      { $unwind: { path: "$purchaseAccount", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          date: 1,
          invoiceNo: 1,
          totalAmount: 1,
          totalBeforeVAT: 1,
          vatTotal:1,
          note:1,
          createdAt: 1,
          isVatInclusive:1,
          supplierId: "$supplier._id",
          supplier: "$supplier.supplierName",
          paymentModeId:"$paymentAccount._id",
          paymentMode: "$paymentAccount.accountName",
          purchaseAccount: "$purchaseAccount.accountName",
          items:1,
        }
      }
    ];

    const data = await PURCHASE.aggregate(pipeline);

        const totalVATResult = await PURCHASE.aggregate([
      {
        $group: {
          _id: null,
          totalVAT: { $sum: "$vatTotal" }
        }
      }
    ]);

    const totalVAT = totalVATResult[0]?.totalVAT || 0;


    const totalCount = await PURCHASE.countDocuments();

    return res.json({
      page,
      limit,
      totalCount,
      totalVAT,
      data
    });
  } catch (err) {
    next(err);
  }
};


export const getAllPurchasesReport = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found!" });

    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const { fromDate, toDate, supplierId, search } = req.query;

    const matchStage = {
    
    };

    //  Date filter
    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.date = { $gte: start, $lte: end };
    }

    //  Supplier filter
    if (supplierId) {
      matchStage.supplierId = new mongoose.Types.ObjectId(supplierId);
    }

    const pipeline = [
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "suppliers",
          localField: "supplierId",
          foreignField: "_id",
          as: "supplier"
        }
      },
      {
        $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true }
      },
      {
        $lookup: {
          from: "accounts",
          localField: "paymentModeId",
          foreignField: "_id",
          as: "paymentAccount"
        }
      },
      {
        $unwind: { path: "$paymentAccount", preserveNullAndEmptyArrays: true }
      },
        //  Account lookup (Expense category)
      {
        $lookup: {
          from: "accounts",
          localField: "accountId",
          foreignField: "_id",
          as: "purchaseAccount"
        }
      },
      {
        $unwind: { path: "$purchaseAccount", preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          _id: 1,
          date: 1,
          invoiceNo: 1,
          totalAmount: 1,
          createdAt: 1,
          supplier: "$supplier.name",
          paymentMode: "$paymentAccount.accountName",
          purchaseAccount: "$purchaseAccount.accountName"
        }
      }
    ];

    // 🔍 Search by invoice or supplier name
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { invoiceNo: { $regex: search, $options: "i" } },
            { supplier: { $regex: search, $options: "i" } },
            { "purchaseAccount": { $regex: search, $options: "i" } }
          ]
        }
      });
    }

    const data = await PURCHASE.aggregate(pipeline);

    //  Total count
    const countPipeline = [{ $match: matchStage }, { $count: "total" }];
    const countResult = await PURCHASE.aggregate(countPipeline);
    const totalCount = countResult[0]?.total || 0;

    return res.json({
      page,
      limit,
      totalCount,
      data
    });
  } catch (err) {
    next(err);
  }
};


export const updatePurchase = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found!" });

    const {
      purchaseId,
      date,
      invoiceNo,
      supplierId,
      paymentModeId,
      items,
      totalAmount,
     baseTotal,
      vatTotal,
     isVatInclusive,
      note
    } = req.body;

    if (!purchaseId) return res.status(400).json({ message: "Purchase ID is required!" });
    if (!date) return res.status(400).json({ message: "Purchase date is required!" });
    if (!supplierId) return res.status(400).json({ message: "Supplier ID is required!" });
    if (!paymentModeId) return res.status(400).json({ message: "Payment mode (Account ID) is required!" });
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one purchase item is required!" });
    }

    const account = await ACCOUNTS.findOne({ accountType: 'Purchase' }).lean();
    if (!account) return res.status(400).json({ message: 'Purchase account not found!' });

    // Get existing purchase and preserve its referenceId (or generate one if missing)
    const existingPurchase = await PURCHASE.findById(purchaseId).lean();
    if (!existingPurchase) return res.status(404).json({ message: "Purchase not found!" });

    const refId =  await generateUniqueRefId();

    // Update purchase with new data
    const updatedPurchase = await PURCHASE.findByIdAndUpdate(
      purchaseId,
      {
        date,
        invoiceNo,
        supplierId,
        paymentModeId,
        accountId: account._id,
        items: items.map((item) => ({
          ingredientId: item.ingredientId,
          price: item.price,
          quantity: item.quantity,
          total: item.total,
          vatAmount: item.vatAmount,
          baseTotal:item.baseTotal,
        })),
        totalAmount,
        totalBeforeVAT:baseTotal,
        vatTotal,
        isVatInclusive,
        note,
        updatedById: user._id,
        createdBy: user.name,
        createdById: user._id
      },
      { new: true }
    );

    // Delete old transactions linked to this purchase
    await TRANSACTION.deleteMany({ purchaseId });

    // Create new transactions
    const debitTxn = {
      restaurantId: account.restaurantId || null,
      purchaseId: purchaseId,
      accountId: account._id,
      paymentType: paymentModeId,
      supplierId,
      amount: totalAmount,
      totalBeforeVAT:baseTotal,
      vatAmount:vatTotal,
      type: "Debit",
      referenceId: refId,
      referenceType: account.accountType || "Purchase",
      description: note || `Purchase from supplier #${invoiceNo}`,
      createdById: user._id,
      createdBy: user.name,
    };

    const creditTxn = {
      restaurantId: account.restaurantId || null,
      purchaseId: purchaseId,
      accountId: paymentModeId,
      amount: totalAmount,
      type: "Debit",
      referenceId: refId,
      referenceType: account.accountType || "Purchase",
      description: note || `Payment for Purchase #${invoiceNo}`,
      createdById: user._id,
      createdBy: user.name,
    };

    await TRANSACTION.insertMany([debitTxn, creditTxn]);

    return res.status(200).json({ message: "Purchase updated successfully!" });
  } catch (err) {
    next(err);
  }
};




export const getOnePurchase = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found!" });

    const { purchaseId } = req.params;

    if (!purchaseId) {
      return res.status(400).json({ message: "Purchase ID is required!" });
    }

    const objectId = new mongoose.Types.ObjectId(purchaseId);

    const purchase = await PURCHASE.aggregate([
      { $match: { _id: objectId } },

      // Supplier
      {
        $lookup: {
          from: "suppliers",
          localField: "supplierId",
          foreignField: "_id",
          as: "supplier"
        }
      },
      { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },

      // Payment mode account
      {
        $lookup: {
          from: "accounts",
          localField: "paymentModeId",
          foreignField: "_id",
          as: "paymentAccount"
        }
      },
      { $unwind: { path: "$paymentAccount", preserveNullAndEmptyArrays: true } },

      // Purchase account
      {
        $lookup: {
          from: "accounts",
          localField: "accountId",
          foreignField: "_id",
          as: "purchaseAccount"
        }
      },
      { $unwind: { path: "$purchaseAccount", preserveNullAndEmptyArrays: true } },

      // Lookup ingredients for each item
      {
        $unwind: "$items"
      },
      {
        $lookup: {
          from: "ingredients",
          localField: "items.ingredientId",
          foreignField: "_id",
          as: "ingredient"
        }
      },
      {
        $unwind: { path: "$ingredient", preserveNullAndEmptyArrays: true }
      },
      {
        $addFields: {
          "items.ingredientName": "$ingredient.ingredient"
        }
      },
      {
        $group: {
          _id: "$_id",
          date: { $first: "$date" },
          invoiceNo: { $first: "$invoiceNo" },
          supplier: { $first: "$supplier" },
          paymentAccount: { $first: "$paymentAccount" },
          purchaseAccount: { $first: "$purchaseAccount" },
          totalAmount: { $first: "$totalAmount" },
          vatAmount: { $first: "$vatAmount" },
          totalBeforeVAT: { $first: "$totalBeforeVAT" },
          isVatInclusive : { $first: "$isVatInclusive" },
          createdAt: { $first: "$createdAt" },
          items: {
            $push: {
              ingredientId: "$items.ingredientId",
              ingredientName: "$items.ingredientName",
              price: "$items.price",
              quantity: "$items.quantity",
              total: "$items.total",
              vatAmount:"$items.vatAmount",
              baseTotal:"$items.baseTotal",
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          date: 1,
          invoiceNo: 1,
          totalAmount: 1,
          vatAmount:1,
          totalBeforeVAT:1,
          isVatInclusive:1,
          createdAt: 1,
          supplier: "$supplier.supplierName",
          paymentMode: "$paymentAccount.accountName",
          purchaseAccount: "$purchaseAccount.accountName",
          items: 1
        }
      }
    ]);

    if (!purchase.length) {
      return res.status(404).json({ message: "Purchase not found!" });
    }

    return res.json({ data: purchase[0] });

  } catch (err) {
    next(err);
  }
};


