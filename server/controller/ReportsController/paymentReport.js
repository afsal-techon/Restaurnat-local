import mongoose from "mongoose";
import USER from '../../model/userModel.js';
import TRANSACTION from '../../model/transaction.js'
import CUSTOMER from '../../model/customer.js';
import RESTAURANT from '../../model/restaurant.js'
import {  generatePDF } from '../../config/pdfGeneration.js'
import ExcelJS from 'exceljs';


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


// export const getDailyTransactionReport = async (req, res, next) => {
//   try {
//     const {
//       fromDate,
//       toDate, 
//       search = '',
//       type,
//       accountName = '', 
//       accountType = '',
//       paymentModeName = '',
//     } = req.query;

//     console.log(accountName,'accountName')
//     console.log(paymentModeName,'pari')

//     const limit = parseInt(req.query.limit) || 20;
//     const page = parseInt(req.query.page) || 1;
//     const skip = (page - 1) * limit;

//     const user = await USER.findById(req.user);
//     if (!user) return res.status(400).json({ message: "User not found!" });

//     const matchStage = {};

//     if (type) {
//       matchStage.type = type;
//     }

//     if (fromDate && toDate) {
//       const start = new Date(fromDate);
//       const end = new Date(toDate);
//       end.setHours(23, 59, 59, 999);
//       matchStage.createdAt = { $gte: start, $lte: end };
//     }

//     const searchStage = search
//       ? {
//           $or: [
//             { referenceId: { $regex: search, $options: 'i' } },
//             { referenceType: { $regex: search, $options: 'i' } },
//             { narration: { $regex: search, $options: 'i' } },
//           ]
//         }
//       : null;

//     const pipeline = [
//       { $match: matchStage },
//       ...(searchStage ? [{ $match: searchStage }] : []),

//       // Lookup for account info
//       {
//         $lookup: {
//           from: "accounts",
//           localField: "accountId",
//           foreignField: "_id",
//           as: "accountInfo"
//         }
//       },
//       { $unwind: "$accountInfo" },

//       // Lookup for payment mode info
//       {
//         $lookup: {
//           from: "accounts",
//           localField: "paymentType",
//           foreignField: "_id",
//           as: "paymentTypeInfo"
//         }
//       },
//       { $unwind: { path: "$paymentTypeInfo", preserveNullAndEmptyArrays: true } },

//       // Filters based on accountName, accountType, paymentModeName, paymentModeType
//       ...(accountName
//         ? [{ $match: { "accountInfo.accountName": { $regex: accountName, $options: "i" } } }]
//         : []),

//       ...(accountType
//         ? [{ $match: { "accountInfo.accountType": accountType } }]
//         : []),

//       ...(paymentModeName
//         ? [{ $match: { "paymentTypeInfo.accountName": { $regex: paymentModeName, $options: "i" } } }]
//         : []),

    
//       // Sort and compute credit/debit
//       { $sort: { createdAt: 1 } },
//       {
//         $addFields: {
//           credit: { $cond: [{ $eq: ["$type", "Credit"] }, "$amount", 0] },
//           debit: { $cond: [{ $eq: ["$type", "Debit"] }, "$amount", 0] },
//         }
//       },

//       // Group and calculate totals
//       {
//         $group: {
//           _id: null,
//           transactions: { $push: "$$ROOT" },
//           totalCredit: { $sum: "$credit" },
//           totalDebit: { $sum: "$debit" }
//         }
//       },

//       // Running total calculation
//       {
//         $addFields: {
//           transactionsWithRunningTotal: {
//             $reduce: {
//               input: "$transactions",
//               initialValue: {
//                 runningTotal: 0,
//                 transactions: []
//               },
//               in: {
//                 runningTotal: {
//                   $add: [
//                     "$$value.runningTotal",
//                     {
//                       $cond: [
//                         { $eq: ["$$this.type", "Credit"] },
//                         "$$this.amount",
//                         { $multiply: ["$$this.amount", -1] }
//                       ]
//                     }
//                   ]
//                 },
//                 transactions: {
//                   $concatArrays: [
//                     "$$value.transactions",
//                     [
//                       {
//                         $mergeObjects: [
//                           "$$this",
//                           {
//                             total: {
//                               $add: [
//                                 "$$value.runningTotal",
//                                 {
//                                   $cond: [
//                                     { $eq: ["$$this.type", "Credit"] },
//                                     "$$this.amount",
//                                     { $multiply: ["$$this.amount", -1] }
//                                   ]
//                                 }
//                               ]
//                             }
//                           }
//                         ]
//                       }
//                     ]
//                   ]
//                 }
//               }
//             }
//           }
//         }
//       },

//       // Slice for pagination
//       {
//         $project: {
//           allData: "$transactionsWithRunningTotal.transactions",
//           totalCredit: 1,
//           totalDebit: 1
//         }
//       },
//       {
//         $addFields: {
//           data: {
//             $slice: ["$allData", skip, limit]
//           },
//           totalCount: { $size: "$allData" },
//           totalAmount: {
//             $add: [
//               "$totalCredit",
//               { $multiply: ["$totalDebit", -1] }
//             ]
//           }
//         }
//       },
//       {
//         $project: {
//           data: 1,
//           totalCount: 1,
//           totalCredit: 1,
//           totalDebit: 1,
//           totalAmount: 1
//         }
//       }
//     ];

//     const result = await TRANSACTION.aggregate(pipeline);

//     const finalResult = result[0] || {
//       data: [],
//       totalCount: 0,
//       totalCredit: 0,
//       totalDebit: 0,
//       totalAmount: 0
//     };

//     return res.status(200).json({
//       data: finalResult.data,
//       totalCount: finalResult.totalCount,
//       totalCredit: finalResult.totalCredit,
//       totalDebit: finalResult.totalDebit,
//       totalAmount: finalResult.totalAmount,
//       page,
//       limit
//     });

//   } catch (err) {
//     next(err);
//   }
// };


// Updated Daily Transaction Report API with PDF generation support


export const getDailyTransactionReport = async (req, res, next) => {
  try {
    const {
      fromDate,
      toDate,
      search = '',
      type,
      accountName = '',
      accountType = '',
      paymentModeName = '',
    } = req.query;

    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found!" });

    const matchStage = {};

    if (type) matchStage.type = type;

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    const searchStage = search
      ? {
          $or: [
            { referenceId: { $regex: search, $options: 'i' } },
            { referenceType: { $regex: search, $options: 'i' } },
            { narration: { $regex: search, $options: 'i' } },
          ]
        }
      : null;

    const pipeline = [
      { $match: matchStage },
      ...(searchStage ? [{ $match: searchStage }] : []),

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
        $lookup: {
          from: "accounts",
          localField: "paymentType",
          foreignField: "_id",
          as: "paymentTypeInfo"
        }
      },
      { $unwind: { path: "$paymentTypeInfo", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer"
        }
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },

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
        $addFields: {
          vendorCustomer: {
            $cond: [
              { $ifNull: ["$customer", false] },
              "$customer.name",
              {
                $cond: [
                  { $ifNull: ["$supplier", false] },
                  "$supplier.supplierName",
                  "-"
                ]
              }
            ]
          }
        }
      },

      ...(accountName
        ? [{ $match: { "accountInfo.accountName": { $regex: accountName, $options: "i" } } }]
        : []),

      ...(accountType
        ? [{ $match: { "accountInfo.accountType": accountType } }]
        : []),

      ...(paymentModeName
        ? [{ $match: { "paymentTypeInfo.accountName": { $regex: paymentModeName, $options: "i" } } }]
        : []),

      { $sort: { createdAt: 1 } },

      {
        $addFields: {
          credit: { $cond: [{ $eq: ["$type", "Credit"] }, "$amount", 0] },
          debit: { $cond: [{ $eq: ["$type", "Debit"] }, "$amount", 0] },
        }
      },

      {
        $group: {
          _id: null,
          transactions: { $push: "$$ROOT" },
          totalCredit: { $sum: "$credit" },
          totalDebit: { $sum: "$debit" }
        }
      },

      {
        $addFields: {
          transactionsWithRunningTotal: {
            $reduce: {
              input: "$transactions",
              initialValue: {
                runningTotal: 0,
                transactions: []
              },
              in: {
                runningTotal: {
                  $add: [
                    "$$value.runningTotal",
                    {
                      $cond: [
                        { $eq: ["$$this.type", "Credit"] },
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
                            total: {
                              $add: [
                                "$$value.runningTotal",
                                {
                                  $cond: [
                                    { $eq: ["$$this.type", "Credit"] },
                                    "$$this.amount",
                                    { $multiply: ["$$this.amount", -1] }
                                  ]
                                }
                              ]
                            },
                            referenceId: "$$this.referenceId" // ✅ explicit referenceId inclusion
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
          allData: "$transactionsWithRunningTotal.transactions",
          totalCredit: 1,
          totalDebit: 1
        }
      },
      {
        $addFields: {
          data: {
            $slice: ["$allData", skip, limit]
          },
          totalCount: { $size: "$allData" },
          totalAmount: {
            $add: [
              "$totalCredit",
              { $multiply: ["$totalDebit", -1] }
            ]
          }
        }
      },
      {
        $project: {
          data: 1,
          totalCount: 1,
          totalCredit: 1,
          totalDebit: 1,
          totalAmount: 1
        }
      }
    ];

    const result = await TRANSACTION.aggregate(pipeline);

    const finalResult = result[0] || {
      data: [],
      totalCount: 0,
      totalCredit: 0,
      totalDebit: 0,
      totalAmount: 0
    };

    return res.status(200).json({
      data: finalResult.data,
      totalCount: finalResult.totalCount,
      totalCredit: finalResult.totalCredit,
      totalDebit: finalResult.totalDebit,
      totalAmount: finalResult.totalAmount,
      page,
      limit
    });

  } catch (err) {
    next(err);
  }
};




export const getDailyTransactionPDF = async (req, res, next) => {
  try {
    const {
      fromDate,
      toDate,
      search = '',
      type,
      accountName = '',
      accountType = '',
      paymentModeName = '',
    } = req.query;

    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found!" });

    const matchStage = {};

    if (type) matchStage.type = type;

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    const searchStage = search
      ? {
          $or: [
            { referenceId: { $regex: search, $options: 'i' } },
            { referenceType: { $regex: search, $options: 'i' } },
            { narration: { $regex: search, $options: 'i' } },
          ]
        }
      : null;

    const pipeline = [
      { $match: matchStage },
      ...(searchStage ? [{ $match: searchStage }] : []),

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
        $lookup: {
          from: "accounts",
          localField: "paymentType",
          foreignField: "_id",
          as: "paymentTypeInfo"
        }
      },
      { $unwind: { path: "$paymentTypeInfo", preserveNullAndEmptyArrays: true } },

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
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer"
        }
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },

      ...(accountName ? [{ $match: { "accountInfo.accountName": { $regex: accountName, $options: "i" } } }] : []),
      ...(accountType ? [{ $match: { "accountInfo.accountType": accountType } }] : []),
      ...(paymentModeName ? [{ $match: { "paymentTypeInfo.accountName": { $regex: paymentModeName, $options: "i" } } }] : []),

      { $sort: { createdAt: 1 } },

      {
        $addFields: {
          credit: { $cond: [{ $eq: ["$type", "Credit"] }, "$amount", 0] },
          debit: { $cond: [{ $eq: ["$type", "Debit"] }, "$amount", 0] },
          vendorCustomer: {
            $cond: [
              { $ifNull: ["$supplier", false] },
              "$supplier.supplierName",
              {
                $cond: [
                  { $ifNull: ["$customer", false] },
                  "$customer.name",
                  "-"
                ]
              }
            ]
          },
          accountName: "$accountInfo.accountName",
          accountType: "$accountInfo.accountType",
          paymentMode: "$paymentTypeInfo.accountName"
        }
      },

      {
        $group: {
          _id: null,
          transactions: { $push: "$$ROOT" },
          totalCredit: { $sum: "$credit" },
          totalDebit: { $sum: "$debit" }
        }
      },

      {
        $addFields: {
          transactionsWithTotal: {
            $reduce: {
              input: "$transactions",
              initialValue: {
                runningTotal: 0,
                transactions: []
              },
              in: {
                runningTotal: {
                  $add: [
                    "$$value.runningTotal",
                    {
                      $cond: [
                        { $eq: ["$$this.type", "Credit"] },
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
                        $mergeObjects: ["$$this", { total: "$$value.runningTotal" }]
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
          data: "$transactionsWithTotal.transactions",
          totalCredit: 1,
          totalDebit: 1,
          totalAmount: {
            $add: ["$totalCredit", { $multiply: ["$totalDebit", -1] }]
          }
        }
      }
    ];

    const result = await TRANSACTION.aggregate(pipeline);
    const final = result[0] || { data: [], totalCredit: 0, totalDebit: 0, totalAmount: 0 };

    const restaurant = await RESTAURANT.findOne().lean();
    const currency = restaurant?.currency || 'AED';

    const pdfBuffer = await generatePDF("dailyTransactionReport", {
      data: final.data,
      filters: { fromDate, toDate, type, search, accountName, accountType, paymentModeName },
      totalCredit: final.totalCredit,
      totalDebit: final.totalDebit,
      totalAmount: final.totalAmount,
      currency
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Daily-report-${Date.now()}.pdf"`
    });

    return res.send(pdfBuffer);

  } catch (err) {
    next(err);
  }
};



 




//excel generation

export const paymentSummaryExcel = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found" });

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
    ]);

    // === Create Excel Workbook ===
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Payment Summary");

    // Title Row
    ws.mergeCells("A1:C1");
    const titleCell = ws.getCell("A1");
    titleCell.value = "Payment Summary";
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };

    // Empty Row
    ws.addRow([]);

    // Search Row (if applicable)
    if (search) {
      const searchRow = ws.addRow([`Search: ${search}`]);
      searchRow.getCell(1).font = { bold: true };
      searchRow.getCell(1).alignment = { horizontal: "left" };
    }

    // Column Headings
    const headerRow = ws.addRow(["Payment Type", "Amount", "No of Transaction"]);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
    });

    // Add Data Rows
    allPayments.forEach((payment) => {
      ws.addRow([
        payment.type,
        payment.amount,
        payment.count,
      ]);
    });

    // Set Column Widths (optional for better readability)
    ws.columns = [
      { width: 30 },
      { width: 15 },
      { width: 20 },
    ];

    // Set response headers
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=payment_summary.xlsx`);

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
};



export const dailyCollectionExcel = async (req, res, next) => {
  try {
    const { fromDate, toDate, search } = req.query;

    if (!fromDate || !toDate) {
      return res.status(400).json({ message: "Please provide fromDate and toDate" });
    }

    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found" });

     const restaurant = await RESTAURANT.findOne({});
        const currency = restaurant?.currency || "AED";

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

    const reportData = await TRANSACTION.aggregate(pipeline);

    // ====== Create Excel ======
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Daily Collection Report");

    // Title Row
    ws.mergeCells("A1:C1");
    const titleCell = ws.getCell("A1");
    titleCell.value = "Daily Collection Report";
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };

    // Empty Row
    ws.addRow([]);

    // Filter Info
    const filterRow = ws.addRow([
      `From: ${fromDate}`,
      `To: ${toDate}`,
      ...(search ? [`Search: ${search}`] : [])
    ]);
    filterRow.eachCell((cell) => {
      cell.font = { bold: true };
    });

    // Empty Row
    ws.addRow([]);

    // Header Row
    const headerRow = ws.addRow(["Date", "Payment Methods", "Total"]);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center" };
    });

    // Data Rows
    reportData.forEach((entry) => {
      const paymentDetails = entry.collections
        .map(
          (c) => `${c.type} (${c.count}) - ${c.amount.toFixed(2)}`
        )
        .join("\n");

      const row = ws.addRow([
        entry.date,
        paymentDetails,
        entry.total,
      ]);

      row.getCell(2).alignment = { wrapText: true };
    });

    // Column Widths
    ws.columns = [
      { key: "date", width: 15 },
      { key: "methods", width: 50 },
      { key: "total", width: 15 },
    ];

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=daily_collection_report.xlsx"
    );

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
};



export const dailyTransactionExcel = async (req, res, next) => {
  try {
    const {
      fromDate,
      toDate,
      search = '',
      type,
      accountName = '',
      accountType = '',
      paymentModeName = ''
    } = req.query;

    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found!" });

    const matchStage = {};
    if (type) matchStage.type = type;

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    const searchStage = search
      ? {
          $or: [
            { referenceId: { $regex: search, $options: 'i' } },
            { referenceType: { $regex: search, $options: 'i' } },
            { narration: { $regex: search, $options: 'i' } },
          ]
        }
      : null;

    const pipeline = [
      { $match: matchStage },
      ...(searchStage ? [{ $match: searchStage }] : []),
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
        $lookup: {
          from: "accounts",
          localField: "paymentType",
          foreignField: "_id",
          as: "paymentTypeInfo"
        }
      },
      { $unwind: { path: "$paymentTypeInfo", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer"
        }
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
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
        $addFields: {
          vendorCustomer: {
            $cond: [
              { $ifNull: ["$customer", false] },
              "$customer.name",
              {
                $cond: [
                  { $ifNull: ["$supplier", false] },
                  "$supplier.supplierName",
                  "-"
                ]
              }
            ]
          },
          credit: { $cond: [{ $eq: ["$type", "Credit"] }, "$amount", 0] },
          debit: { $cond: [{ $eq: ["$type", "Debit"] }, "$amount", 0] },
        }
      },
      ...(accountName
        ? [{ $match: { "accountInfo.accountName": { $regex: accountName, $options: "i" } } }]
        : []),
      ...(accountType
        ? [{ $match: { "accountInfo.accountType": accountType } }]
        : []),
      ...(paymentModeName
        ? [{ $match: { "paymentTypeInfo.accountName": { $regex: paymentModeName, $options: "i" } } }]
        : []),
      { $sort: { createdAt: 1 } },
      {
        $addFields: {
          total: {
            $cond: [
              { $eq: ["$type", "Credit"] },
              "$amount",
              { $multiply: ["$amount", -1] }
            ]
          }
        }
      },
      {
        $project: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          referenceId: 1,
          accountType: "$accountInfo.accountType",
          accountName: "$accountInfo.accountName",
          paymentMethod: "$paymentTypeInfo.accountName",
          vendorCustomer: 1,
          referenceType: 1,
          credit: 1,
          debit: 1,
          total: 1
        }
      }
    ];

    const transactions = await TRANSACTION.aggregate(pipeline);

    // ====== Create Excel Sheet ======
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Daily Transaction");

    // Title
    worksheet.mergeCells("A1:J1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "Daily Transaction";
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.addRow([]);

    // Filters row (only if present)
    const filters = [];

    if (fromDate) filters.push(`From: ${fromDate}`);
    if (toDate) filters.push(`To: ${toDate}`);
    if (search) filters.push(`Search: ${search}`);
    if (type) filters.push(`Type: ${type}`);
    if (accountName) filters.push(`Account Name: ${accountName}`);
    if (accountType) filters.push(`Account Type: ${accountType}`);
    if (paymentModeName) filters.push(`Payment Mode: ${paymentModeName}`);

    if (filters.length > 0) {
      const filterRow = worksheet.addRow(filters);
      filterRow.eachCell(cell => (cell.font = { bold: true }));
      worksheet.addRow([]);
    }

    // Header row
    const headerRow = worksheet.addRow([
      "Date",
      "Reference No",
      "Account Type",
      "Account Name",
      "Payment Method",
      "Vendor/Customer",
      "Reference Type",
      "Credit",
      "Debit",
      "Total"
    ]);
    headerRow.eachCell(cell => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center" };
    });

    // Data rows
    transactions.forEach(txn => {
      worksheet.addRow([
        txn.date,
        txn.referenceId || "-",
        txn.accountType || "-",
        txn.accountName || "-",
        txn.paymentMethod || "-",
        txn.vendorCustomer || "-",
        txn.referenceType || "-",
        txn.credit || 0,
        txn.debit || 0,
        txn.total || 0
      ]);
    });

    // Column widths
    worksheet.columns = [
      { width: 12 },
      { width: 20 },
      { width: 15 },
      { width: 25 },
      { width: 20 },
      { width: 25 },
      { width: 20 },
      { width: 10 },
      { width: 10 },
      { width: 12 }
    ];

    // Send Excel file
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=daily_transaction_report.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    next(err);
  }
};
