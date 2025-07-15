import ACCOUNTS from '../../model/account.js'
import USER from '../../model/userModel.js';
import TRANSACTION from '../../model/transaction.js';
import { generateUniqueRefId } from '../POS controller/posOrderCntrl.js'
import EXPENSE from '../../model/expense.js'



export const createExpense = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found!" });

    const {
      date,
      invoiceNo,
      paymentModeId,   // Expense paid through this account
      accountId,       // Expense account (e.g., Electricity, Rent)
      supplierId,      // Optional
      amount,
      qty
    } = req.body;

    // === Validations ===
    if (!date) return res.status(400).json({ message: "Expense date is required!" });
    if (!accountId) return res.status(400).json({ message: "Expense Account ID is required!" });
    if (!paymentModeId) return res.status(400).json({ message: "Payment mode (Account ID) is required!" });
    if (!amount || isNaN(amount)) return res.status(400).json({ message: "Valid amount is required!" });

    const quantity = qty && !isNaN(qty) ? qty : 1;

    const account = await ACCOUNTS.findById(accountId).lean();
    if (!account) return res.status(400).json({ message: "Expense Account not found!" });

    const refId = await generateUniqueRefId();

    // === Save Expense Record ===
     await EXPENSE.create({
      date,
      invoiceNo,
      supplierId: supplierId || null,
      paymentModeId,
      accountId,
      qty: quantity,
      amount,
      createdById: user._id,
      createdBy: user.name
    });

    // === Create Transaction (debit from business, credit to expense account) ===
    const txn = {
      restaurantId: account.restaurantId || null,
      accountId: account._id,           // Expense account
      paymentType: paymentModeId,       // Source account (cash, bank, etc.)
      supplierId: supplierId || null,
      amount: amount,
      type: "Debit",
      referenceId: refId,
      referenceType: account.accountType || "Expense",
      description: `Expense for #${invoiceNo || "N/A"}`,
      createdById: user._id,
      createdBy: user.name
    };

        const creditTxn = {
      restaurantId : account.restaurantId || null,
      accountId: paymentModeId,
      amount: amount,
      type: "Debit",
      referenceId: refId,
      referenceType: account.accountType ||  "Purchase",
      description: `Payment for Expense #${invoiceNo}`,
      createdById: user._id,
      createdBy:user.name,
    };

        await TRANSACTION.insertMany([txn, creditTxn]);

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
      { $sort: { createdAt: -1 } },
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

      // Expense category lookup
      {
        $lookup: {
          from: "accounts",
          localField: "accountId",
          foreignField: "_id",
          as: "expenseAccount"
        }
      },
      { $unwind: { path: "$expenseAccount", preserveNullAndEmptyArrays: true } },

      // Final projection
      {
        $project: {
          _id: 1,
          date: 1,
          invoiceNo: 1,
          qty: 1,
          amount: 1,
          createdAt: 1,
          supplier: "$supplier.supplierName",
          paymentMode: "$paymentAccount.accountName",
          expenseAccount: "$expenseAccount.accountName"
        }
      }
    ];

    const data = await EXPENSE.aggregate(pipeline);
    const totalCount = await EXPENSE.countDocuments();

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
      supplierId,
      amount,
      qty
    } = req.body;

    if (!expenseId) return res.status(400).json({ message: "Expense ID is required!" });
    if (!date) return res.status(400).json({ message: "Expense date is required!" });
    if (!amount || isNaN(amount)) return res.status(400).json({ message: "Valid amount is required!" });

    const quantity = qty && !isNaN(qty) ? qty : 1;

    // 1. Update Expense record
    const updatedExpense = await EXPENSE.findByIdAndUpdate(
      expenseId,
      {
        date,
        invoiceNo,
        supplierId: supplierId || null,
        amount,
        qty: quantity,
        createdBy: user.name,
        createdById: user._id
      },
      { new: true }
    );

    if (!updatedExpense) {
      return res.status(404).json({ message: "Expense not found!" });
    }

    // 2. Update related Transactions
    await TRANSACTION.updateMany(
      { expenseId },
      [
        {
          $set: {
            amount,
            supplierId: supplierId || null,
            description: {
              $cond: [
                { $eq: ["$accountId", updatedExpense.accountId] },
                `Expense for #${invoiceNo || "N/A"}`,
                `Payment for Expense #${invoiceNo || "N/A"}`
              ]
            },
            updatedById: user._id,
            updatedBy: user.name,
            updatedAt: new Date()
          }
        }
      ]
    );

    return res.status(200).json({ message: "Expense updated successfully!" });
  } catch (err) {
    next(err);
  }
};




