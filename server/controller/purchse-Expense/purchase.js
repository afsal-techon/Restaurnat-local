import ACCOUNTS from '../../model/account.js'
import USER from '../../model/userModel.js';
import RESTAURANT from '../../model/restaurant.js'
import TRANSACTION from '../../model/transaction.js';
import { generateUniqueRefId } from '../POS controller/posOrderCntrl.js'
import PURCHASE from '../../model/purchase.js'




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
      totalAmount
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

    const account = ACCOUNTS.findOne({ accountType:'Purchase'})
    
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
      items: items.map((item) => ({
        ingredientId: item.ingredientId,
        price: item.price,
        quantity: item.quantity,
        total: item.price * item.quantity,
      })),
      totalAmount,
      createdById: user._id,
      createdBy:user.name,
    });

    // 2. Create transaction records
    const debitTxn = {
      restaurantId : account.restaurantId | null,
      accountId: account._id, // supplier account
      paymentType: paymentModeId,
      supplierId,
      amount: totalAmount,
      type: "Debit",
      referenceId: refId,
      referenceType: "Purchase",
      description: `Purchase from supplier #${invoiceNo}`,
      createdById: user._id,
      createdBy:user.name,
    };

    const creditTxn = {
      restaurantId : account.restaurantId | null,
      accountId: paymentModeId,
      amount: totalAmount,
      type: "Debit",
      referenceId: refId,
      referenceType: "Purchase",
      description: `Payment for Purchase #${invoiceNo}`,
      createdById: user._id,
      createdBy:user.name,
    };

    await TRANSACTION.insertMany([debitTxn, creditTxn]);

    return res.status(200).json({ message: "Purchase created successfully!" });
  } catch (err) {
    next(err);
  }
};

export const getAllPurchases = async (req, res, next) => {
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

    // 👤 Supplier filter
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
      {
        $project: {
          _id: 1,
          date: 1,
          invoiceNo: 1,
          totalAmount: 1,
          createdAt: 1,
          supplier: "$supplier.name",
          paymentMode: "$paymentAccount.accountName",
        }
      }
    ];

    // 🔍 Search by invoice or supplier name
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { invoiceNo: { $regex: search, $options: "i" } },
            { supplier: { $regex: search, $options: "i" } }
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
