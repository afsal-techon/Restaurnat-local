import ACCOUNTS from '../../model/account.js'
import USER from '../../model/userModel.js';
import RESTAURANT from '../../model/restaurant.js'
import TRANSACTION from '../../model/transaction.js';
import mongoose from 'mongoose';
import { generatePDF } from '../../config/pdfGeneration.js';
import ExcelJS from 'exceljs';


export const getPurchaseReport = async (req, res, next) => {
  try {
    const {
      fromDate,
      toDate,
      search = '',
      accountName = '',
      paymentType = '',
      supplierName = '',
      minPrice,
      maxPrice
    } = req.query;

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

    if (minPrice || maxPrice) {
      matchStage.amount = {};
      if (minPrice) matchStage.amount.$gte = parseFloat(minPrice);
      if (maxPrice) matchStage.amount.$lte = parseFloat(maxPrice);
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

      { $match: { "accountInfo.accountType": "Purchase" } },

      ...(accountName
        ? [{ $match: { "accountInfo.accountName": accountName } }]
        : []),

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

      ...(paymentType
        ? [{ $match: { "paymentTypeInfo.accountName": paymentType } }]
        : []),

      {
        $lookup: {
          from: "suppliers",
          localField: "supplierId",
          foreignField: "_id",
          as: "supplierInfo"
        }
      },
      { $unwind: { path: "$supplierInfo", preserveNullAndEmptyArrays: true } },

      ...(supplierName
        ? [{ $match: { "supplierInfo.supplierName": { $regex: supplierName, $options: "i" } } }]
        : []),

      ...(search
        ? [{
            $match: {
              $or: [
                { referenceId: { $regex: search, $options: 'i' } },
                { narration: { $regex: search, $options: 'i' } },
                { "accountInfo.accountName": { $regex: search, $options: 'i' } },
                { "paymentTypeInfo.accountName": { $regex: search, $options: 'i' } },
                { "supplierInfo.supplierName": { $regex: search, $options: 'i' } }
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
                vatAmount: "$vatAmount",
                totalBeforeVAT: "$vatAmount",
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
                },
                supplierName: {
                  $ifNull: ["$supplierInfo.supplierName", null]
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
          }],
          totalVAT: [
            {
              $group: {
                _id: null,
                sum: { $sum: "$vatAmount" }
              }
            }
          ]
        }
      },
      {
        $project: {
          data: 1,
          totalCount: { $ifNull: [{ $arrayElemAt: ["$totalCount.count", 0] }, 0] },
          totalAmount: { $ifNull: [{ $arrayElemAt: ["$totalAmount.sum", 0] }, 0] },
           totalVAT: { $ifNull: [{ $arrayElemAt: ["$totalVAT.sum", 0] }, 0] }
        }
      }
    ];

    const result = await TRANSACTION.aggregate(pipeline);

    return res.status(200).json({
      data: result[0]?.data || [],
      totalCount: result[0]?.totalCount || 0,
      totalAmount: result[0]?.totalAmount || 0,
      totalVAT: result[0]?.totalVAT || 0,
      page,
      limit
    });

  } catch (err) {
    next(err);
  }
};




export const getExpenseReport = async (req, res, next) => {
  try {
    const {
      fromDate,
      toDate,
      search = '',
      accountName = '',
      paymentType = '',
      supplierName = '',
      minPrice,
      maxPrice
    } = req.query;

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

    if (minPrice || maxPrice) {
      matchStage.amount = {};
      if (minPrice) matchStage.amount.$gte = parseFloat(minPrice);
      if (maxPrice) matchStage.amount.$lte = parseFloat(maxPrice);
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

      ...(accountName
        ? [{ $match: { "accountInfo.accountName": accountName } }]
        : []),

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

      ...(paymentType
        ? [{ $match: { "paymentTypeInfo.accountName": paymentType } }]
        : []),

      {
        $lookup: {
          from: "suppliers",
          localField: "supplierId",
          foreignField: "_id",
          as: "supplierInfo"
        }
      },
      { $unwind: { path: "$supplierInfo", preserveNullAndEmptyArrays: true } },

      ...(supplierName
        ? [{ $match: { "supplierInfo.supplierName": { $regex: supplierName, $options: "i" } } }]
        : []),

      ...(search
        ? [{
            $match: {
              $or: [
                { referenceId: { $regex: search, $options: 'i' } },
                { narration: { $regex: search, $options: 'i' } },
                { "accountInfo.accountName": { $regex: search, $options: 'i' } },
                { "paymentTypeInfo.accountName": { $regex: search, $options: 'i' } },
                { "supplierInfo.supplierName": { $regex: search, $options: 'i' } }
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
                },
                supplierName: {
                  $ifNull: ["$supplierInfo.supplierName", null]
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
    const {
      fromDate,
      toDate,
      search = '',
      accountName = '',
      paymentType = '',
      supplierName = '',
      minPrice,
      maxPrice
    } = req.query;

    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found!" });

    const matchStage = {};

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    if (minPrice || maxPrice) {
      matchStage.amount = {};
      if (minPrice) matchStage.amount.$gte = parseFloat(minPrice);
      if (maxPrice) matchStage.amount.$lte = parseFloat(maxPrice);
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

      { $match: { "accountInfo.accountType": "Purchase" } },

      ...(accountName
        ? [{ $match: { "accountInfo.accountName": accountName } }]
        : []),

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

      ...(paymentType
        ? [{ $match: { "paymentTypeInfo.accountName": paymentType } }]
        : []),

      {
        $lookup: {
          from: "suppliers",
          localField: "supplierId",
          foreignField: "_id",
          as: "supplierInfo"
        }
      },
      { $unwind: { path: "$supplierInfo", preserveNullAndEmptyArrays: true } },

      ...(supplierName
        ? [{ $match: { "supplierInfo.supplierName": { $regex: supplierName, $options: "i" } } }]
        : []),

      ...(search
        ? [{
            $match: {
              $or: [
                { referenceId: { $regex: search, $options: 'i' } },
                { narration: { $regex: search, $options: 'i' } },
                { "accountInfo.accountName": { $regex: search, $options: 'i' } },
                { "paymentTypeInfo.accountName": { $regex: search, $options: 'i' } },
                { "supplierInfo.supplierName": { $regex: search, $options: 'i' } }
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
          paymentMethod: "$paymentTypeInfo.accountName",
          supplierName: "$supplierInfo.supplierName",
          amount: 1
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
      filters: {
        fromDate,
        toDate,
        search,
        accountName,
        paymentType,
        supplierName,
        minPrice,
        maxPrice
      }
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
    const { fromDate, toDate, search = '', accountName = '', minPrice, maxPrice } = req.query;

    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found!" });

    const matchStage = {};

    // Date filter
    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    // Price filter
    if (minPrice || maxPrice) {
      matchStage.amount = {};
      if (minPrice) matchStage.amount.$gte = parseFloat(minPrice);
      if (maxPrice) matchStage.amount.$lte = parseFloat(maxPrice);
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

      // 🔁 Supplier Lookup
      {
        $lookup: {
          from: "suppliers",
          localField: "supplierId",
          foreignField: "_id",
          as: "supplierInfo"
        }
      },
      { $unwind: { path: "$supplierInfo", preserveNullAndEmptyArrays: true } },

      ...(search
        ? [{
            $match: {
              $or: [
                { referenceId: { $regex: search, $options: 'i' } },
                { narration: { $regex: search, $options: 'i' } },
                { "accountInfo.accountName": { $regex: search, $options: 'i' } },
                { "supplierInfo.supplierName": { $regex: search, $options: 'i' } }
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
          supplierName: "$supplierInfo.supplierName",
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
        accountName,
        minPrice,
        maxPrice
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


//excel 
export const purchaseReportExcel = async (req, res, next) => {
  try {
    const {
      fromDate,
      toDate,
      search = '',
      accountName = '',
      paymentType = '',
      supplierName = '',
      minPrice,
      maxPrice
    } = req.query;

    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found!" });

    const matchStage = {};
    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    if (minPrice || maxPrice) {
      matchStage.amount = {};
      if (minPrice) matchStage.amount.$gte = parseFloat(minPrice);
      if (maxPrice) matchStage.amount.$lte = parseFloat(maxPrice);
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

      ...(paymentType ? [{ $match: { "paymentTypeInfo.accountName": paymentType } }] : []),

      {
        $lookup: {
          from: "suppliers",
          localField: "supplierId",
          foreignField: "_id",
          as: "supplierInfo"
        }
      },
      { $unwind: { path: "$supplierInfo", preserveNullAndEmptyArrays: true } },

      ...(supplierName
        ? [{ $match: { "supplierInfo.supplierName": { $regex: supplierName, $options: "i" } } }]
        : []),

      ...(search
        ? [{
            $match: {
              $or: [
                { referenceId: { $regex: search, $options: 'i' } },
                { narration: { $regex: search, $options: 'i' } },
                { "accountInfo.accountName": { $regex: search, $options: 'i' } },
                { "paymentTypeInfo.accountName": { $regex: search, $options: 'i' } },
                { "supplierInfo.supplierName": { $regex: search, $options: 'i' } }
              ]
            }
          }]
        : []),

      { $sort: { createdAt: -1 } },
      {
        $project: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          referenceId: 1,
          accountType: "$accountInfo.accountType",
          accountName: "$accountInfo.accountName",
          paymentMethod: "$paymentTypeInfo.accountName",
          supplier: "$supplierInfo.supplierName",
          amount: 1
        }
      }
    ];

    const transactions = await TRANSACTION.aggregate(pipeline);

    // ====== Excel generation ======
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Purchase Report");

    // Title
    worksheet.mergeCells("A1:F1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "Purchase Report";
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };

    worksheet.addRow([]);

    // Conditional Filters
    const filterLabels = [
      fromDate ? `From: ${fromDate}` : null,
      toDate ? `To: ${toDate}` : null,
      search ? `Search: ${search}` : null,
      accountName ? `Account Name: ${accountName}` : null,
      paymentType ? `Payment Method: ${paymentType}` : null,
      supplierName ? `Supplier: ${supplierName}` : null,
      minPrice ? `Min Price: ${minPrice}` : null,
      maxPrice ? `Max Price: ${maxPrice}` : null,
    ].filter(Boolean);

    if (filterLabels.length > 0) {
      const filterRow = worksheet.addRow(filterLabels);
      filterRow.eachCell((cell) => (cell.font = { bold: true }));
      worksheet.addRow([]);
    }

    // Header
    const headerRow = worksheet.addRow([
      "Date",
      "Reference No",
      "Account Type",
      "Account Name",
      "Payment Method",
      "Supplier",
      "Amount"
    ]);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center" };
    });

    // Rows
    transactions.forEach((txn) => {
      worksheet.addRow([
        txn.date,
        txn.referenceId || "-",
        txn.accountType || "-",
        txn.accountName || "-",
        txn.paymentMethod || "-",
        txn.supplier || "-",
        txn.amount || 0
      ]);
    });

    // Column Widths
    worksheet.columns = [
      { width: 12 },
      { width: 20 },
      { width: 15 },
      { width: 25 },
      { width: 20 },
      { width: 25 },
      { width: 12 }
    ];

    // Send Excel
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=purchase_report.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    next(err);
  }
};


export const expenseReportExcel = async (req, res, next) => {
  try {
    const {
      fromDate,
      toDate,
      search = '',
      accountName = '',
      paymentType = '',
      supplierName = '',
      minPrice,
      maxPrice
    } = req.query;

    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found!" });

    const matchStage = {};

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    if (minPrice || maxPrice) {
      matchStage.amount = {};
      if (minPrice) matchStage.amount.$gte = parseFloat(minPrice);
      if (maxPrice) matchStage.amount.$lte = parseFloat(maxPrice);
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

      ...(paymentType ? [{ $match: { "paymentTypeInfo.accountName": paymentType } }] : []),

      {
        $lookup: {
          from: "suppliers",
          localField: "supplierId",
          foreignField: "_id",
          as: "supplierInfo"
        }
      },
      { $unwind: { path: "$supplierInfo", preserveNullAndEmptyArrays: true } },

      ...(supplierName
        ? [{ $match: { "supplierInfo.supplierName": { $regex: supplierName, $options: "i" } } }]
        : []),

      ...(search
        ? [{
            $match: {
              $or: [
                { referenceId: { $regex: search, $options: 'i' } },
                { narration: { $regex: search, $options: 'i' } },
                { "accountInfo.accountName": { $regex: search, $options: 'i' } },
                { "paymentTypeInfo.accountName": { $regex: search, $options: 'i' } },
                { "supplierInfo.supplierName": { $regex: search, $options: 'i' } }
              ]
            }
          }]
        : []),

      { $sort: { createdAt: -1 } },
      {
        $project: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          referenceId: 1,
          accountType: "$accountInfo.accountType",
          accountName: "$accountInfo.accountName",
          paymentMethod: "$paymentTypeInfo.accountName",
          supplier: "$supplierInfo.supplierName",
          amount: 1
        }
      }
    ];

    const transactions = await TRANSACTION.aggregate(pipeline);

    // Generate Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Expense Report");

    // Title
    worksheet.mergeCells("A1:G1");
    worksheet.getCell("A1").value = "Expense Report";
    worksheet.getCell("A1").font = { size: 16, bold: true };
    worksheet.getCell("A1").alignment = { horizontal: "center" };

    worksheet.addRow([]);

    // Filters
    const filters = [
      fromDate ? `From: ${fromDate}` : null,
      toDate ? `To: ${toDate}` : null,
      accountName ? `Account: ${accountName}` : null,
      paymentType ? `Payment Method: ${paymentType}` : null,
      supplierName ? `Supplier: ${supplierName}` : null,
      search ? `Search: ${search}` : null,
      minPrice ? `Min: ${minPrice}` : null,
      maxPrice ? `Max: ${maxPrice}` : null
    ].filter(Boolean);

    if (filters.length) {
      const filterRow = worksheet.addRow(filters);
      filterRow.eachCell(cell => (cell.font = { bold: true }));
      worksheet.addRow([]);
    }

    // Header
    const header = [
      "Date",
      "Reference No",
      "Account Type",
      "Account Name",
      "Payment Method",
      "Supplier",
      "Amount"
    ];
    const headerRow = worksheet.addRow(header);
    headerRow.eachCell(cell => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center" };
    });

    // Rows
    transactions.forEach(txn => {
      worksheet.addRow([
        txn.date || "-",
        txn.referenceId || "-",
        txn.accountType || "-",
        txn.accountName || "-",
        txn.paymentMethod || "-",
        txn.supplier || "-",
        txn.amount || 0
      ]);
    });

    // Column Widths
    worksheet.columns = [
      { width: 12 },
      { width: 20 },
      { width: 15 },
      { width: 25 },
      { width: 20 },
      { width: 25 },
      { width: 12 }
    ];

    // Download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=expense_report.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    next(err);
  }
};
