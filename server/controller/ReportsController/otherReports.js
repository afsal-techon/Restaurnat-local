
import mongoose from "mongoose";
import USER from '../../model/userModel.js';
import { generatePDF } from '../../config/pdfGeneration.js';
import RESTAURANT from '../../model/restaurant.js'
import CUSTOMER_TYPE from '../../model/customerTypes.js'
import TRANSACTION from '../../model/transaction.js'
import CUSTOMER from '../../model/customer.js'



export const getProfitAndLossReport = async (req, res, next) => {
  try {

     const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found!" });

    const { fromDate, toDate } = req.query;

    if (!fromDate || !toDate) {
      return res.status(400).json({ message: "From and To dates are required" });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    const transactions = await TRANSACTION.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $lookup: {
          from: "accounts",
          localField: "accountId",
          foreignField: "_id",
          as: "account"
        }
      },
      {
        $unwind: "$account"
      },
      {
        $project: {
          amount: 1,
          type: 1,
          referenceType: 1,
          accountType: "$account.accountType"
        }
      }
    ]);

    let revenue = 0;
    let cogs = 0;
    let expenses = 0;

    for (const txn of transactions) {
      // SALES (Revenue)
      if (txn.type === "Credit" && txn.referenceType === "Sale") {
        revenue += txn.amount;
      }

      // PURCHASE (COGS)
      else if (txn.type === "Debit" && txn.accountType === "Purchase") {
        cogs += txn.amount;
      }

      // EXPENSE
      else if (txn.type === "Debit" && txn.accountType === "Expense") {
        expenses += txn.amount;
      }
    }

    const totalCustomerCredit = await CUSTOMER.aggregate([
  {
    $group: {
      _id: null,
      totalCredit: { $sum: "$credit" }
    }
  }
]);

const dueAmount = totalCustomerCredit[0]?.totalCredit || 0;


    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expenses;

    return res.status(200).json({
      revenue,
      cogs,
      grossProfit,
      expenses,
      netProfit,
      totalCustomerDue: dueAmount,
      fromDate,
      toDate
    });

  } catch (error) {
    next(error);
  }
};
