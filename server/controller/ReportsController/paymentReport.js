import mongoose from "mongoose";
import USER from '../../model/userModel.js';
import ORDER from '../../model/oreder.js';
import PAYMENT from '../../model/paymentRecord.js'
import TRANSACTION from '../../model/transaction.js'
import CUSTOMER from '../../model/customer.js'



export const getPaymentSummary = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found" });

    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const matchStage = {
      type: "Credit",
      referenceType: { $in: ["Sale", "Due Payment"] },
    };

    // Full data for totalCollected and count
    const allPayments = await TRANSACTION.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$accountId",
          amount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "accounts",
          localField: "_id",
          foreignField: "_id",
          as: "accountInfo",
        },
      },
      { $unwind: { path: "$accountInfo", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "accounts",
          localField: "accountInfo.parentAccountId",
          foreignField: "_id",
          as: "parentInfo",
        },
      },
      { $unwind: { path: "$parentInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          type: "$accountInfo.accountName",
          amount: 1,
          count: 1,
          groupUnder: {
            accountName: "$parentInfo.accountName",
            accountType: "$parentInfo.accountType",
          },
        },
      },
    ]);

    const totalCollected = allPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalCount = allPayments.length;

    const paginatedData = allPayments.slice(skip, skip + limit);

    const dueResult = await CUSTOMER.aggregate([
      {
        $match: {
          credit: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalDue: { $sum: "$credit" },
        },
      },
    ]);

    const totalDue = dueResult[0]?.totalDue || 0;

    return res.status(200).json({
      totalCollected,
      totalDue,
      data: paginatedData,
      totalCount,
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
};



export const getDailyCollectionReport = async (req, res, next) => {
  try {
    const { fromDate, toDate } = req.query;
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;


    if (!fromDate || !toDate) {
  return res.status(400).json({ message: "Please provide fromDate and toDate" });
}


    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found" });

     const start = new Date(fromDate);
     const end = new Date(toDate);
     end.setHours(23, 59, 59, 999);

    const match = {
      type: "Credit",
      referenceType: { $in: ["Sale", "Due Payment"] },
    };

    if (fromDate && toDate) {
      match.createdAt = { $gte: start, $lte: end };
    }

    const groupedResult = await TRANSACTION.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "accounts",
          localField: "accountId",
          foreignField: "_id",
          as: "account"
        }
      },
      { $unwind: { path: "$account", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          amount: 1,
          accountName: "$account.accountName",
          date: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          }
        }
      },
      {
        $group: {
          _id: { date: "$date", type: "$accountName" },
          amount: { $sum: "$amount" },
          count: { $sum: 1 },
        }
      },
      {
        $group: {
          _id: "$_id.date",
          collections: {
            $push: {
              type: "$_id.type",
              amount: "$amount",
              count: "$count"
            }
          },
          total: { $sum: "$amount" },
        }
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          collections: 1,
          total: 1
        }
      },
      { $sort: { date: -1 } }
    ]);

    const paginatedData = groupedResult.slice(skip, skip + limit);
    const totalCount = groupedResult.length;

    return res.status(200).json({
      data: paginatedData,
      totalCount,
      page,
      limit
    });
  } catch (err) {
    next(err);
  }
};
