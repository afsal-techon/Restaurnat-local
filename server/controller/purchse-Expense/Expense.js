import ACCOUNTS from '../../model/account.js'
import USER from '../../model/userModel.js';
import TRANSACTION from '../../model/transaction.js';
import { generateUniqueRefId } from '../POS controller/posOrderCntrl.js'
import EXPENSE from '../../model/expense.js'
import mongoose from "mongoose";




// export const createExpense = async (req, res, next) => {
//   try {
//     const user = await USER.findById(req.user).lean();
//     if (!user) return res.status(400).json({ message: "User not found!" });

//     const {
//       date,
//       invoiceNo,
//       paymentModeId,   // Expense paid through this account
//       accountId,       // Expense account (e.g., Electricity, Rent)
//       supplierId,      // Optional
//       amount,
//       qty
//     } = req.body;

//     // === Validations ===
//     if (!date) return res.status(400).json({ message: "Expense date is required!" });
//     if (!accountId) return res.status(400).json({ message: "Expense Account ID is required!" });
//     if (!paymentModeId) return res.status(400).json({ message: "Payment mode (Account ID) is required!" });
//     if (!amount || isNaN(amount)) return res.status(400).json({ message: "Valid amount is required!" });

//     const quantity = qty && !isNaN(qty) ? qty : 1;

//     const account = await ACCOUNTS.findById(accountId).lean();
//     if (!account) return res.status(400).json({ message: "Expense Account not found!" });

//     const refId = await generateUniqueRefId();

//     // === Save Expense Record ===
//      await EXPENSE.create({
//       date,
//       invoiceNo,
//       supplierId: supplierId || null,
//       paymentModeId,
//       accountId,
//       qty: quantity,
//       amount,
//       createdById: user._id,
//       createdBy: user.name
//     });

//     // === Create Transaction (debit from business, credit to expense account) ===
//     const txn = {
//       restaurantId: account.restaurantId || null,
//       accountId: account._id,           // Expense account
//       paymentType: paymentModeId,       // Source account (cash, bank, etc.)
//       supplierId: supplierId || null,
//       amount: amount,
//       type: "Debit",
//       referenceId: refId,
//       referenceType: account.accountType || "Expense",
//       description: `Expense for #${invoiceNo || "N/A"}`,
//       createdById: user._id,
//       createdBy: user.name
//     };

//         const creditTxn = {
//       restaurantId : account.restaurantId || null,
//       accountId: paymentModeId,
//       amount: amount,
//       type: "Debit",
//       referenceId: refId,
//       referenceType: account.accountType ||  "Purchase",
//       description: `Payment for Expense #${invoiceNo}`,
//       createdById: user._id,
//       createdBy:user.name,
//     };

//         await TRANSACTION.insertMany([txn, creditTxn]);

//     return res.status(200).json({ message: "Expense created successfully!" });
//   } catch (err) {
//     next(err);
//   }
// };

export const createExpense = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found!" });

    const {
      date,
      invoiceNo,
      paymentModeId,
      supplierId,
      note,
      grandTotal,
      baseTotal,
      vatTotal,
      expenseItems, // [{ accountId, note, amount, qty }]
      isVatInclusive,

    } = req.body;


    console.log(expenseItems[0].baseTotal);
    

    if (!date) return res.status(400).json({ message: "Expense date is required!" });
    if (!paymentModeId) return res.status(400).json({ message: "Payment mode (Account ID) is required!" });
    if (!Array.isArray(expenseItems) || expenseItems.length === 0) {
      return res.status(400).json({ message: "At least one expense item is required!" });
    }
    if (!grandTotal) return res.status(400).json({ message: "Grand total is required!" });
    if (!vatTotal) return res.status(400).json({ message: "Vat total is required!" });

    const refId = await generateUniqueRefId();

    //  Create Expense first to get expenseId
    const expense = await EXPENSE.create({
      date,
      invoiceNo,
      supplierId: supplierId || null,
      paymentModeId,
      expenseItems,
      vatTotal: vatTotal || 0,
      totalBeforeVAT:baseTotal,
      grandTotal,
      isVatInclusive,
      createdById: user._id,
      createdBy: user.name
    });

    const transactions = [];

    for (const item of expenseItems) {
      if (!item.accountId || !item.amount || !item.total) {
        return res.status(400).json({ message: "Each expense item must have accountId and amount!" });
      }

      const acc = await ACCOUNTS.findById(item.accountId).lean();
      if (!acc) return res.status(400).json({ message: "Expense account not found!" });

      const q = item.qty && !isNaN(item.qty) ? item.qty : 1;

      // Debit: to expense account
      transactions.push({
        restaurantId: acc.restaurantId || null,
        accountId: acc._id,
        paymentType: paymentModeId,
        supplierId: supplierId || null,
        amount: item.total,
        vatAmount: item.vatAmount || 0,
        totalBeforeVAT:item.baseTotal,
        type: "Debit",
        referenceId: refId,
        referenceType: acc.accountType || "Expense",
        expenseId: expense._id, //  Store expenseId
        description: item.note || `Expense item`,
        createdById: user._id,
        createdBy: user.name,
      });
    }

    const paymentAccount = await ACCOUNTS.findById(paymentModeId).lean();
    if (!paymentAccount) return res.status(400).json({ message: "Payment mode account not found!" });

    // Debit: from payment account
    transactions.push({
      restaurantId: user.restaurantId || null,
      accountId: paymentModeId,
      amount: grandTotal,
      type: "Debit",
      referenceId: refId,
      referenceType: "Expense",
      expenseId: expense._id, //  Store expenseId
      description: note || `Payment for Expense #${invoiceNo || "N/A"}`,
      createdById: user._id,
      createdBy: user.name,
    });

    // Save Transactions
    await TRANSACTION.insertMany(transactions);

    return res.status(200).json({ message: "Expense created successfully!" });
  } catch (err) {
    next(err);
  }
};


export const getExpenseList = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found!" });

    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const pipeline = [
      // Ensure latest created expenses first
      { $sort: { createdAt: -1 } },

      // Pagination
      { $skip: skip },
      { $limit: limit },

      // Supplier lookup
      {
        $lookup: {
          from: "suppliers",
          localField: "supplierId",
          foreignField: "_id",
          as: "supplier"
        }
      },
      { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },

      // Payment mode lookup
      {
        $lookup: {
          from: "accounts",
          localField: "paymentModeId",
          foreignField: "_id",
          as: "paymentAccount"
        }
      },
      { $unwind: { path: "$paymentAccount", preserveNullAndEmptyArrays: true } },

      // Unwind expenseItems
      { $unwind: "$expenseItems" },

      // Lookup account name for each expense item
      {
        $lookup: {
          from: "accounts",
          localField: "expenseItems.accountId",
          foreignField: "_id",
          as: "expenseItemAccount"
        }
      },
      { $unwind: { path: "$expenseItemAccount", preserveNullAndEmptyArrays: true } },

      // Add accountName to expenseItems
      {
        $addFields: {
          "expenseItems.accountId": "$expenseItemAccount._id",
          "expenseItems.accountName": "$expenseItemAccount.accountName"
        }
      },

      // Group back by expense
      {
        $group: {
          _id: "$_id",
          date: { $first: "$date" },
          invoiceNo: { $first: "$invoiceNo" },
          createdAt: { $first: "$createdAt" },
          supplier: { $first: "$supplier.supplierName" },
          supplierId: { $first: "$supplier._id" },
          paymentModeId: { $first: "$paymentAccount._id" },
          paymentMode: { $first: "$paymentAccount.accountName" },
          vatTotal: { $first: "$vatTotal" },
          totalBeforeVAT: { $first: "$totalBeforeVAT" },
          grandTotal: { $first: "$grandTotal" },
          createdBy: { $first: "$createdBy" },
          createdById: { $first: "$createdById" },
          isVatInclusive: { $first: "$isVatInclusive" },

          expenseItems: {
            $push: {
              accountId: "$expenseItems.accountId",
              accountName: "$expenseItems.accountName",
              note: "$expenseItems.note",
              amount: "$expenseItems.amount",
              qty: "$expenseItems.qty",
              total: "$expenseItems.total",
              vatAmount: "$expenseItems.vatAmount",
              baseTotal: "$expenseItems.baseTotal"
            }
          }
        }
      },

      // Re-sort after grouping, just to ensure order remains
      { $sort: { createdAt: -1 } },

      // Final projection
      {
        $project: {
          _id: 1,
          date: 1,
          invoiceNo: 1,
          createdAt: 1,
          supplier: 1,
          supplierId: 1,
          paymentModeId: 1,
          paymentMode: 1,
          vatTotal: 1,
          totalBeforeVAT: 1,
          grandTotal: 1,
          createdBy: 1,
          createdById: 1,
          isVatInclusive: 1,
          expenseItems: 1
        }
      }
    ];

    const data = await EXPENSE.aggregate(pipeline);

    // Total VAT
    const totalVATResult = await EXPENSE.aggregate([
      { $group: { _id: null, totalVAT: { $sum: "$vatTotal" } } }
    ]);
    const totalVAT = totalVATResult[0]?.totalVAT || 0;

    // Total Grand Total
    const totalGrandTotalResult = await EXPENSE.aggregate([
      { $group: { _id: null, totalGrandTotal: { $sum: "$grandTotal" } } }
    ]);
    const totalGrandTotal = totalGrandTotalResult[0]?.totalGrandTotal || 0;

    // Total Count
    const totalCount = await EXPENSE.countDocuments();

    return res.json({
      page,
      limit,
      totalCount,
      totalVAT,
      totalGrandTotal,
      data
    });

  } catch (err) {
    next(err);
  }
};




export const getAllExpensesReport = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found!" });

    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const { fromDate, toDate, supplierId, search } = req.query;

    const matchStage = {};

    //  Date filter
    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.date = { $gte: start, $lte: end };
    }

    //  Supplier filter (optional)
    if (supplierId) {
      matchStage.supplierId = new mongoose.Types.ObjectId(supplierId);
    }

    const pipeline = [
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },

      //  Supplier lookup
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

      //  Payment Mode lookup
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
          as: "expenseAccount"
        }
      },
      {
        $unwind: { path: "$expenseAccount", preserveNullAndEmptyArrays: true }
      },

      //  Final projection
      {
        $project: {
          _id: 1,
          date: 1,
          invoiceNo: 1,
          qty: 1,
          amount: 1,
          createdAt: 1,
          supplier: "$supplier.name",
          paymentMode: "$paymentAccount.accountName",
          expenseAccount: "$expenseAccount.accountName"
        }
      }
    ];

    //  Search filter
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { invoiceNo: { $regex: search, $options: "i" } },
            { "supplier": { $regex: search, $options: "i" } },
            { "expenseAccount": { $regex: search, $options: "i" } }
          ]
        }
      });
    }

    const data = await EXPENSE.aggregate(pipeline);

    //  Total count
    const countPipeline = [{ $match: matchStage }, { $count: "total" }];
    const countResult = await EXPENSE.aggregate(countPipeline);
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



export const updateExpense = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found!" });

    const {
      expenseId,
      date,
      invoiceNo,
      paymentModeId,
      supplierId,
      note,
      grandTotal,
      baseTotal,
      vatTotal,
      expenseItems, // [{ accountId, note, amount, qty, vatAmount, total }]
      isVatInclusive
    } = req.body;

    if (!expenseId) return res.status(400).json({ message: "Expense ID is required!" });
    if (!date) return res.status(400).json({ message: "Expense date is required!" });
    if (!paymentModeId) return res.status(400).json({ message: "Payment mode (Account ID) is required!" });
    if (!Array.isArray(expenseItems) || expenseItems.length === 0) {
      return res.status(400).json({ message: "At least one expense item is required!" });
    }
    if (!grandTotal) return res.status(400).json({ message: "Grand total is required!" });
    if (!vatTotal) return res.status(400).json({ message: "VAT total is required!" });

    const existingExpense = await EXPENSE.findById(expenseId);
    if (!existingExpense) return res.status(404).json({ message: "Expense not found!" });

    // Delete previous transactions linked to this expense
    await TRANSACTION.deleteMany({ expenseId });

    const refId = await generateUniqueRefId(); // You can choose to re-use old one if you store it

    const updatedExpense = await EXPENSE.findByIdAndUpdate(
      expenseId,
      {
        date,
        invoiceNo,
        supplierId: supplierId || null,
        paymentModeId,
        expenseItems,
        vatTotal: vatTotal || 0,
        totalBeforeVAT:baseTotal,
        grandTotal,
        isVatInclusive,
        createdById: user._id,
        createdBy: user.name,
      },
      { new: true }
    );

    const transactions = [];

    for (const item of expenseItems) {
      if (!item.accountId || !item.amount || !item.total) {
        return res.status(400).json({ message: "Each expense item must have accountId and amount!" });
      }

      const acc = await ACCOUNTS.findById(item.accountId).lean();
      if (!acc) return res.status(400).json({ message: "Expense account not found!" });

      const q = item.qty && !isNaN(item.qty) ? item.qty : 1;

      transactions.push({
        restaurantId: acc.restaurantId || null,
        accountId: acc._id,
        paymentType: paymentModeId,
        supplierId: supplierId || null,
        amount: item.total,
        vatAmount: item.vatAmount || 0,
        totalBeforeVAT:baseTotal,
        type: "Debit",
        referenceId: refId,
        referenceType: acc.accountType || "Expense",
        expenseId: expenseId,
        description: item.note || `Expense item`,
        createdById: user._id,
        createdBy: user.name,
      });
    }

    const paymentAccount = await ACCOUNTS.findById(paymentModeId).lean();
    if (!paymentAccount) return res.status(400).json({ message: "Payment mode account not found!" });

    transactions.push({
      restaurantId: user.restaurantId || null,
      accountId: paymentModeId,
      amount: grandTotal,
      type: "Debit",
      referenceId: refId,
      referenceType: "Expense",
      expenseId: expenseId,
      description: note || `Payment for Expense #${invoiceNo || "N/A"}`,
      createdById: user._id,
      createdBy: user.name,
    });

    await TRANSACTION.insertMany(transactions);

    return res.status(200).json({ message: "Expense updated successfully!" });
  } catch (err) {
    next(err);
  }
};



export const getOneExpense = async (req, res, next) => {
  try {
    const { expenseId } = req.params;
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found!" });

    if ((!expenseId)) {
      return res.status(400).json({ message: "Expense Id is required!" });
    }

    const pipeline = [
      { $match: { _id: new mongoose.Types.ObjectId(expenseId) } },

      // Supplier lookup
      {
        $lookup: {
          from: "suppliers",
          localField: "supplierId",
          foreignField: "_id",
          as: "supplier"
        }
      },
      { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },

      // Payment mode lookup
      {
        $lookup: {
          from: "accounts",
          localField: "paymentModeId",
          foreignField: "_id",
          as: "paymentAccount"
        }
      },
      { $unwind: { path: "$paymentAccount", preserveNullAndEmptyArrays: true } },

      // Unwind expenseItems
      { $unwind: "$expenseItems" },

      // Lookup account name for each expense item
      {
        $lookup: {
          from: "accounts",
          localField: "expenseItems.accountId",
          foreignField: "_id",
          as: "expenseItemAccount"
        }
      },
      { $unwind: { path: "$expenseItemAccount", preserveNullAndEmptyArrays: true } },

      // Rebuild the expenseItems object with account name
      {
        $addFields: {
          "expenseItems.accountId": "$expenseItemAccount._id",
          "expenseItems.accountName": "$expenseItemAccount.accountName"
        }
      },

      // Group back by main expense
      {
        $group: {
          _id: "$_id",
          date: { $first: "$date" },
          invoiceNo: { $first: "$invoiceNo" },
          createdAt: { $first: "$createdAt" },
          supplier: { $first: "$supplier.supplierName" },
          supplierId: { $first: "$supplier._id" },
          paymentModeId: { $first: "$paymentAccount._id" },
          paymentMode: { $first: "$paymentAccount.accountName" },
          vatTotal: { $first: "$vatTotal" },
          totalBeforeVAT: { $first: "$totalBeforeVAT" },
          grandTotal: { $first: "$grandTotal" },
          createdBy: { $first: "$createdBy" },
          isVatInclusive: { $first: "$isVatInclusive" },
          createdById: { $first: "$createdById" },

          expenseItems: {
            $push: {
              accountId: "$expenseItems.accountId",
              accountName: "$expenseItems.accountName",
              note: "$expenseItems.note",
              amount: "$expenseItems.amount",
              qty: "$expenseItems.qty",
              total: "$expenseItems.total",
              vatAmount: "$expenseItems.vatAmount",
              baseTotal: "$expenseItems.baseTotal",
            }
          }
        }
      },

      {
        $project: {
          _id: 1,
          date: 1,
          invoiceNo: 1,
          createdAt: 1,
          supplier: 1,
          supplierId: 1,
          paymentModeId: 1,
          paymentMode: 1,
          vatTotal: 1,
          totalBeforeVAT: 1,
          grandTotal: 1,
          isVatInclusive: 1,
          createdBy: 1,
          createdById: 1,
          expenseItems: 1
        }
      }
    ];

    const data = await EXPENSE.aggregate(pipeline);
    
    return res.json(data[0]);

  } catch (err) {
    next(err);
  }
};

