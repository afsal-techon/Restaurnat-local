import ACCOUNTS from '../../model/account.js'
import USER from '../../model/userModel.js';
import RESTAURANT from '../../model/restaurant.js'
import TRANSACTION from '../../model/transaction.js';
import mongoose from 'mongoose';
import { generatePDF } from '../../config/pdfGeneration.js';


export const getPurchaseReport = async (req, res, next) => {
  try {
    const { fromDate, toDate, search = '', accountName = '' } = req.query;
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found!" });

 const matchStage = {};

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    const pipeline = [
      { $match: matchStage },

      // Lookup account details
      {
        $lookup: {
          from: "accounts",
          localField: "accountId",
          foreignField: "_id",
          as: "accountInfo"
        }
      },
      { $unwind: "$accountInfo" },

      { $match: { "accountInfo.accountType": "Purchase" } },


      // Optional filter by account name
      ...(accountName
        ? [{ $match: { "accountInfo.accountName": accountName } }]
        : []),

      // Lookup parent info
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

      // Lookup payment type if available
      {
        $lookup: {
          from: "accounts",
          localField: "paymentType",
          foreignField: "_id",
          as: "paymentTypeInfo"
        }
      },
      { $unwind: { path: "$paymentTypeInfo", preserveNullAndEmptyArrays: true } },

      // Now add search filter after lookup
      ...(search
        ? [{
            $match: {
              $or: [
                { referenceId: { $regex: search, $options: 'i' } },
                { narration: { $regex: search, $options: 'i' } },
                { "accountInfo.accountName": { $regex: search, $options: 'i' } },
              ]
            }
          }]
        : []),

      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            {
              $project: {
                _id: 1,
                referenceId: 1,
                narration: 1,
                type: 1,
                amount: 1,
                createdAt: 1,
                account: {
                  name: "$accountInfo.accountName",
                  type: "$accountInfo.accountType"
                },
                parentAccount: {
                  name: "$parentInfo.accountName",
                  type: "$parentInfo.accountType"
                },
                paymentType: {
                  $ifNull: ["$paymentTypeInfo.accountName", null]
                }
              }
            },
            { $skip: skip },
            { $limit: limit }
          ],
          totalCount: [{ $count: "count" }],
          totalAmount: [{
            $group: {
              _id: null,
              sum: { $sum: "$amount" }
            }
          }]
        }
      },
      {
        $project: {
          data: 1,
          totalCount: { $ifNull: [{ $arrayElemAt: ["$totalCount.count", 0] }, 0] },
          totalAmount: { $ifNull: [{ $arrayElemAt: ["$totalAmount.sum", 0] }, 0] }
        }
      }
    ];

    const result = await TRANSACTION.aggregate(pipeline);

    return res.status(200).json({
      data: result[0]?.data || [],
      totalCount: result[0]?.totalCount || 0,
      totalAmount: result[0]?.totalAmount || 0,
      page,
      limit
    });

  } catch (err) {
    next(err);
  }
};

export const getExpenseReport = async (req, res, next) => {
  try {
    const { fromDate, toDate, search = '', accountName = '' } = req.query;
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found!" });

    const matchStage = {

    };

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    const pipeline = [
      { $match: matchStage },

      // Lookup account details
      {
        $lookup: {
          from: "accounts",
          localField: "accountId",
          foreignField: "_id",
          as: "accountInfo"
        }
      },
      { $unwind: "$accountInfo" },
         { $match: { "accountInfo.accountType": "Expense" } },

      // Optional filter by account name
      ...(accountName
        ? [{ $match: { "accountInfo.accountName": accountName } }]
        : []),

      // Lookup parent info
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

      // Lookup payment type if available
      {
        $lookup: {
          from: "accounts",
          localField: "paymentType",
          foreignField: "_id",
          as: "paymentTypeInfo"
        }
      },
      { $unwind: { path: "$paymentTypeInfo", preserveNullAndEmptyArrays: true } },

      // Search filter
      ...(search
        ? [{
            $match: {
              $or: [
                { referenceId: { $regex: search, $options: 'i' } },
                { narration: { $regex: search, $options: 'i' } },
                { "accountInfo.accountName": { $regex: search, $options: 'i' } },
              ]
            }
          }]
        : []),

      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            {
              $project: {
                _id: 1,
                referenceId: 1,
                narration: 1,
                type: 1,
                amount: 1,
                createdAt: 1,
                account: {
                  name: "$accountInfo.accountName",
                  type: "$accountInfo.accountType"
                },
                parentAccount: {
                  name: "$parentInfo.accountName",
                  type: "$parentInfo.accountType"
                },
                paymentType: {
                  $ifNull: ["$paymentTypeInfo.accountName", null]
                }
              }
            },
            { $skip: skip },
            { $limit: limit }
          ],
          totalCount: [{ $count: "count" }],
          totalAmount: [{
            $group: {
              _id: null,
              sum: { $sum: "$amount" }
            }
          }]
        }
      },
      {
        $project: {
          data: 1,
          totalCount: { $ifNull: [{ $arrayElemAt: ["$totalCount.count", 0] }, 0] },
          totalAmount: { $ifNull: [{ $arrayElemAt: ["$totalAmount.sum", 0] }, 0] }
        }
      }
    ];

    const result = await TRANSACTION.aggregate(pipeline);

    return res.status(200).json({
      data: result[0]?.data || [],
      totalCount: result[0]?.totalCount || 0,
      totalAmount: result[0]?.totalAmount || 0,
      page,
      limit
    });

  } catch (err) {
    next(err);
  }
};


export const generatePurchaseReportPDF = async (req, res, next) => {
  try {
    const { fromDate, toDate, search = '', accountName = '' } = req.query;

    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found!" });

    const matchStage = {};
    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    const pipeline = [
      { $match: matchStage },

      {
        $lookup: {
          from: "accounts",
          localField: "accountId",
          foreignField: "_id",
          as: "accountInfo"
        }
      },
      { $unwind: "$accountInfo" },

      // ✅ Only include actual Purchase Account transactions
      { $match: { "accountInfo.accountType": "Purchase" } },

      ...(accountName ? [{ $match: { "accountInfo.accountName": accountName } }] : []),

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

      ...(search
        ? [{
            $match: {
              $or: [
                { referenceId: { $regex: search, $options: 'i' } },
                { narration: { $regex: search, $options: 'i' } },
                { "accountInfo.accountName": { $regex: search, $options: 'i' } }
              ]
            }
          }]
        : []),

      { $sort: { createdAt: -1 } },
      {
        $project: {
          referenceId: 1,
          createdAt: 1,
          amount: 1,
          accountType: "$accountInfo.accountType",
          accountName: "$accountInfo.accountName",
          paymentMethod: { $ifNull: ["$paymentTypeInfo.accountName", null] }
        }
      }
    ];

    const transactions = await TRANSACTION.aggregate(pipeline);
    const totalAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    const restaurant = await RESTAURANT.findOne().lean();
    const currency = restaurant?.currency || 'AED';

    const pdfBuffer = await generatePDF('purchaseReportTemp', {
      data: transactions,
      currency,
      totalAmount,
      filters: { fromDate, toDate, search, accountName }
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="purchase-report-${Date.now()}.pdf"`
    });

    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};


export const generateExpenseReportPDF = async (req, res, next) => {
  try {
    const { fromDate, toDate, search = '', accountName = '' } = req.query;

    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found!" });

    const matchStage = {};

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "accounts",
          localField: "accountId",
          foreignField: "_id",
          as: "accountInfo"
        }
      },
      { $unwind: "$accountInfo" },
      { $match: { "accountInfo.accountType": "Expense" } },
      ...(accountName ? [{ $match: { "accountInfo.accountName": accountName } }] : []),
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
      ...(search
        ? [{
            $match: {
              $or: [
                { referenceId: { $regex: search, $options: 'i' } },
                { narration: { $regex: search, $options: 'i' } },
                { "accountInfo.accountName": { $regex: search, $options: 'i' } }
              ]
            }
          }]
        : []),
      { $sort: { createdAt: -1 } },
      {
        $project: {
          createdAt: 1,
          referenceId: 1,
          accountType: "$accountInfo.accountType",
          accountName: "$accountInfo.accountName",
          paymentType: "$paymentTypeInfo.accountName",
          amount: 1
        }
      }
    ];

    const transactions = await TRANSACTION.aggregate(pipeline);
    const totalAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    const restaurant = await RESTAURANT.findOne().lean();
    const currency = restaurant?.currency || 'AED';

    const pdfBuffer = await generatePDF('expenseReportTemp', {
      data: transactions,
      currency,
      totalAmount,
      filters: {
        fromDate,
        toDate,
        search,
        accountName
      }
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="expense-report-${Date.now()}.pdf"`
    });

    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

