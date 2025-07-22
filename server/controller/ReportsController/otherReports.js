
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


const start = fromDate ? new Date(fromDate) : new Date("2000-01-01");
const end = toDate ? new Date(toDate) : new Date();
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
     "Revenue": revenue,
     "Cogs": cogs,
     "Gross Profit": grossProfit,
      "Expenses":expenses,
     "Net Profit": netProfit,
     "total Customer Credit" : dueAmount,
     "From Date": fromDate,
     "To Date": toDate
    });

  } catch (error) {
    next(error);
  }
};



export const profitandLossPdf = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found!" });

       const { fromDate, toDate } = req.query;


const start = fromDate ? new Date(fromDate) : new Date("2000-01-01");
const end = toDate ? new Date(toDate) : new Date();
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
      { $unwind: "$account" },
      {
        $project: {
          amount: 1,
          type: 1,
          referenceType: 1,
          accountType: "$account.accountType"
        }
      }
    ]);

    let revenue = 0, cogs = 0, expenses = 0;

    for (const txn of transactions) {
      if (txn.type === "Credit" && txn.referenceType === "Sale") revenue += txn.amount;
      else if (txn.type === "Debit" && txn.accountType === "Purchase") cogs += txn.amount;
      else if (txn.type === "Debit" && txn.accountType === "Expense") expenses += txn.amount;
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

     const restaurant = await RESTAURANT.findOne().lean();
    const currency = restaurant?.currency || 'AED';

    const pdfBuffer = await generatePDF("profitAndLossReport", {
      filters: { fromDate, toDate },
      data: {
        revenue,
        cogs,
        grossProfit,
        expenses,
        netProfit,
        dueAmount
      },
      currency
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Profit-And-Loss-${Date.now()}.pdf"`
    });

    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};




export const profitAndLossExcel = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found!" });

    const { fromDate, toDate } = req.query;
    const start = fromDate ? new Date(fromDate) : new Date("2000-01-01");
    const end = toDate ? new Date(toDate) : new Date();
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
      { $unwind: "$account" },
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
      if (txn.type === "Credit" && txn.referenceType === "Sale") {
        revenue += txn.amount;
      } else if (txn.type === "Debit" && txn.accountType === "Purchase") {
        cogs += txn.amount;
      } else if (txn.type === "Debit" && txn.accountType === "Expense") {
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

    // Excel generation
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Profit and Loss");

    // Title
    worksheet.mergeCells("A1", "B1");
    worksheet.getCell("A1").value = "Profit & Loss Report";
    worksheet.getCell("A1").font = { bold: true, size: 16 };
    worksheet.getCell("A1").alignment = { horizontal: "center" };

    // Filters
    worksheet.addRow([]);
    worksheet.addRow(["From Date", fromDate || "All"]);
    worksheet.addRow(["To Date", toDate || "All"]);
    worksheet.addRow([]);

    // Headers
    worksheet.addRow(["Label", "Amount"]).eachCell(cell => {
      cell.font = { bold: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD3D3D3" }
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });

    // Data
    const rows = [
      ["Revenue", revenue],
      ["COGS", cogs],
      ["Gross Profit", grossProfit],
      ["Expenses", expenses],
      ["Net Profit", netProfit],
      ["Total Customer Due", dueAmount]
    ];

    rows.forEach(r => worksheet.addRow(r));

    worksheet.columns.forEach(col => {
      col.width = 25;
    });

    // Finalize and send
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=ProfitAndLossReport.xlsx");
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

