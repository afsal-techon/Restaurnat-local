import mongoose from "mongoose";
import USER from '../../model/userModel.js';
import ORDER from '../../model/oreder.js';
import PAYMENT from '../../model/paymentRecord.js'
import TRANSACTION from '../../model/transaction.js'
import CUSTOMER from '../../model/customer.js';
import RESTAURANT from '../../model/restaurant.js'
import {  generatePDF } from '../../config/pdfGeneration.js'



export const getPaymentSummary = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found" });

   
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const { search } = req.query;

    const matchStage = {
      type: "Credit",
      referenceType: { $in: ["Sale", "Due Payment"] },
    };

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
      // Add search stage
      ...(search
        ? [
            {
              $match: {
                type: { $regex: search, $options: "i" },
              },
            },
          ]
        : []),
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

    


   const { fromDate, toDate, search } = req.query;
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
      createdAt: { $gte: start, $lte: end }
    };

    const pipeline = [
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
      // Optional filter for search
      ...(search ? [{
        $match: {
          accountName: { $regex: search, $options: "i" }
        }
      }] : []),
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
          total: { $sum: "$amount" }
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
      { $sort: { date: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: "count" }]
        }
      },
      {
        $project: {
          data: 1,
          totalCount: { $arrayElemAt: ["$totalCount.count", 0] }
        }
      }
    ];

    const result = await TRANSACTION.aggregate(pipeline);

    return res.status(200).json({
      data: result[0]?.data || [],
      totalCount: result[0]?.totalCount || 0,
      page,
      limit
    });
  } catch (err) {
    next(err);
  }
};


//pdf generation
export const generatePaymentSummaryPDF = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found" });

    const { search = '' } = req.query;

    
    const restaurant = await RESTAURANT.findOne({ }).lean();
    const currency = restaurant?.currency || "AED";

    const matchStage = {
      type: "Credit",
      referenceType: { $in: ["Sale", "Due Payment"] },
    };

    const pipeline = [
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
      ...(search
        ? [
            {
              $match: {
                type: { $regex: search, $options: "i" },
              },
            },
          ]
        : []),
    ];

    const payments = await TRANSACTION.aggregate(pipeline);

    const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

    const pdfBuffer = await generatePDF("paymentSummaryTemp", {
      data: payments,
      totalCollected,
      currency,
      filters: { search },
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Payment-summary-${Date.now()}.pdf"`,
    });

    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};


export const generateDailyCollectionPDF = async (req, res, next) => {
  try {
    const { fromDate, toDate, search = '' } = req.query;

    if (!fromDate || !toDate) {
      return res.status(400).json({ message: "Please provide fromDate and toDate" });
    }

    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found" });

    const restaurant = await RESTAURANT.findOne({ }).lean();
    const currency = restaurant?.currency || 'AED';

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    const match = {
      type: "Credit",
      referenceType: { $in: ["Sale", "Due Payment"] },
      createdAt: { $gte: start, $lte: end }
    };

    const pipeline = [
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
      ...(search ? [{
        $match: {
          accountName: { $regex: search, $options: "i" }
        }
      }] : []),
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
          total: { $sum: "$amount" }
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
    ];

    const data = await TRANSACTION.aggregate(pipeline);

    const pdfBuffer = await generatePDF("dailyCollectionTemp", {
      data,
      currency,
      filters: {
        fromDate,
        toDate,
        search,
      },
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Daily-collection-report-${Date.now()}.pdf"`,
    });

    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};
