
import mongoose from "mongoose";
import USER from '../../model/userModel.js';
import { generatePDF } from '../../config/pdfGeneration.js';
import RESTAURANT from '../../model/restaurant.js'
import TRANSACTION from '../../model/transaction.js'
import CUSTOMER from '../../model/customer.js'
import ExcelJS from 'exceljs';
import EXPENSE from '../../model/expense.js'
import PAYMENT_RECORD from '../../model/paymentRecord.js'
import PURCHASE from '../../model/purchase.js'
import ACCOUNT from '../../model/account.js'





export const getProfitAndLossReport = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found!" });

    const { fromDate, toDate } = req.query;
    const start = fromDate ? new Date(fromDate) : new Date("2000-01-01");
    const end = toDate ? new Date(toDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // === Fetch Sales (Revenue) ===
    const payments = await PAYMENT_RECORD.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: null,
          totalBeforeVAT: { $sum: "$beforeVat" },
          // totalVAT: { $sum: "$vatAmount" },
          // totalGrand: { $sum: "$grandTotal" }
        }
      }
    ]);

    const revenue = payments[0]?.totalBeforeVAT || 0;
    // const totalOutputVAT = payments[0]?.totalVAT || 0;
    // const totalSalesWithVAT = revenue + totalOutputVAT;

    // === Fetch Purchases (COGS) ===
    const purchases = await PURCHASE.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: null,
          // totalCOGS: { $sum: "$totalAmount" }
           totalCOGS: { $sum: "$totalBeforeVAT" }
        }
      }
    ]);

    const cogs = purchases[0]?.totalCOGS || 0;

    // === Fetch Expenses ===
    const expenses = await EXPENSE.find({
      createdAt: { $gte: start, $lte: end }
    }).lean();

    let operatingExpenses = {};
    let TotalOperatingExpenses = 0;

    for (const exp of expenses) {
      for (const item of exp.expenseItems) {
        const account = await ACCOUNT.findById(item.accountId).lean();
        if (!account) continue;
        const name = account.accountName;

         const amount = Number(item.baseTotal) || 0;

        if (!operatingExpenses[name]) {
          operatingExpenses[name] = 0;
        }
        operatingExpenses[name] += amount;
        TotalOperatingExpenses += amount;
      }
    }







    // === Calculations ===
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - TotalOperatingExpenses;

    // === Final Response ===
    return res.status(200).json({
      Income: {
        "Sale": revenue,
        // "VAT on Sale": totalOutputVAT,
      },
      "Cost of Goods Sold": {
        Purchase: cogs
      },
      "Gross Profit": grossProfit,
      "Operating Expense": {
          TotalOperatingExpenses,
         operatingExpenses
      },
      "Net Profit": netProfit,
      "From Date": fromDate,
      "To Date": toDate
    });

  } catch (error) {
    next(error);
  }
};



export const getVATReport = async (req, res, next) => {
  try {
    const { fromDate, toDate } = req.query;

    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const matchStage = {
      vatAmount: { $gt: 0 }
    };

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    const pipeline = [
      { $match: matchStage },
      {
        $project: {
          type: 1,
          referenceType: 1,
          referenceId: 1,
          vatAmount: 1,
          totalBeforeVAT: 1,
          purchaseId: 1,
          paymentId: 1,
          expenseId: 1,
          amount: 1,
          createdAt: 1
        }
      },
      { $sort: { createdAt: -1 } },
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

    const transactions = result[0]?.data || [];
    const totalCount = result[0]?.totalCount || 0;

    // Summary Calculation
    let outputVAT = 0;
    let inputVAT = 0;

    for (const txn of transactions) {
      if (txn.type === "Credit" && txn.referenceType === "Income") {
        outputVAT += txn.vatAmount || 0;
      } else if (
        txn.type === "Debit" &&
        (txn.referenceType === "Purchase" || txn.referenceType === "Expense")
      ) {
        inputVAT += txn.vatAmount || 0;
      }
    }

    const payableVAT = outputVAT - inputVAT;

    return res.status(200).json({
      vatSummary: {
        outputVAT,
        inputVAT,
        payableVAT
      },
      data: transactions,
      totalCount,
      page,
      limit
    });

  } catch (err) {
    next(err);
  }
};




export const vatSummary = async (req, res, next) => {
  try {
    const { fromDate, toDate } = req.query;

    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found!" });

    const matchStage = {
      vatAmount: { $gt: 0 }
    };

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    const vatSummary = await TRANSACTION.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            referenceType: "$referenceType",
            type: "$type"
          },
          totalBeforeVAT: { $sum: "$totalBeforeVAT" },
          vatAmount: { $sum: "$vatAmount" }
        }
      }
    ]);

    const result = {
      totalSales: 0,
      vatOnSales: 0,
      totalPurchase: 0,
      vatOnPurchase: 0,
      totalExpense: 0,
      vatOnExpense: 0,
      netVAT: 0
    };

    vatSummary.forEach(item => {
      const { referenceType, type } = item._id;

      if (referenceType === "Income" && type === "Credit") {
        result.totalSales = item.totalBeforeVAT;
        result.vatOnSales = item.vatAmount;
      } else if (referenceType === "Purchase" && type === "Debit") {
        result.totalPurchase = item.totalBeforeVAT;
        result.vatOnPurchase = item.vatAmount;
      } else if (referenceType === "Expense" && type === "Debit") {
        result.totalExpense = item.totalBeforeVAT;
        result.vatOnExpense = item.vatAmount;
      }
    });

    result.netVAT = result.vatOnSales - result.vatOnPurchase - result.vatOnExpense;

    return res.status(200).json({ data: result });

  } catch (err) {
    next(err);
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

    const payments = await PAYMENT_RECORD.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalBeforeVAT: { $sum: "$beforeVat" }
        }
      }
    ]);
    const revenue = payments[0]?.totalBeforeVAT || 0;

    const purchases = await PURCHASE.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalCOGS: { $sum: "$totalBeforeVAT" }
        }
      }
    ]);
    const cogs = purchases[0]?.totalCOGS || 0;

    const expenses = await EXPENSE.find({
      createdAt: { $gte: start, $lte: end }
    }).lean();

    let operatingExpenses = {};
    let TotalOperatingExpenses = 0;

    for (const exp of expenses) {
      for (const item of exp.expenseItems) {
        const account = await ACCOUNT.findById(item.accountId).lean();
        if (!account) continue;
        const name = account.accountName;
        const amount = Number(item.baseTotal) || 0;

        if (!operatingExpenses[name]) {
          operatingExpenses[name] = 0;
        }
        operatingExpenses[name] += amount;
        TotalOperatingExpenses += amount;
      }
    }

    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - TotalOperatingExpenses;

    const restaurant = await RESTAURANT.findOne().lean();
    const currency = restaurant?.currency || 'AED';

    const pdfBuffer = await generatePDF('profitAndLossReport', {
      revenue,
      cogs,
      grossProfit,
      operatingExpenses,
      TotalOperatingExpenses,
      netProfit,
      fromDate,
      toDate,
      currency
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="profit-loss-report-${Date.now()}.pdf"`
    });

    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};


// export const profitAndLossExcel = async (req, res, next) => {
//   try {
//     const user = await USER.findById(req.user).lean();
//     if (!user) return res.status(400).json({ message: "User not found!" });

//     const { fromDate, toDate } = req.query;
//     const start = fromDate ? new Date(fromDate) : new Date("2000-01-01");
//     const end = toDate ? new Date(toDate) : new Date();
//     end.setHours(23, 59, 59, 999);

//     const transactions = await TRANSACTION.aggregate([
//       {
//         $match: {
//           createdAt: { $gte: start, $lte: end }
//         }
//       },
//       {
//         $lookup: {
//           from: "accounts",
//           localField: "accountId",
//           foreignField: "_id",
//           as: "account"
//         }
//       },
//       { $unwind: "$account" },
//       {
//         $project: {
//           amount: 1,
//           type: 1,
//           referenceType: 1,
//           accountType: "$account.accountType"
//         }
//       }
//     ]);

//     let revenue = 0;
//     let cogs = 0;
//     let expenses = 0;

//     for (const txn of transactions) {
//       if (txn.type === "Credit" && txn.referenceType === "Sale") {
//         revenue += txn.amount;
//       } else if (txn.type === "Debit" && txn.accountType === "Purchase") {
//         cogs += txn.amount;
//       } else if (txn.type === "Debit" && txn.accountType === "Expense") {
//         expenses += txn.amount;
//       }
//     }

//     const totalCustomerCredit = await CUSTOMER.aggregate([
//       {
//         $group: {
//           _id: null,
//           totalCredit: { $sum: "$credit" }
//         }
//       }
//     ]);

//     const dueAmount = totalCustomerCredit[0]?.totalCredit || 0;
//     const grossProfit = revenue - cogs;
//     const netProfit = grossProfit - expenses;

//     // Excel generation
//     const workbook = new ExcelJS.Workbook();
//     const worksheet = workbook.addWorksheet("Profit and Loss");

//     // Title
//     worksheet.mergeCells("A1", "B1");
//     worksheet.getCell("A1").value = "Profit & Loss Report";
//     worksheet.getCell("A1").font = { bold: true, size: 16 };
//     worksheet.getCell("A1").alignment = { horizontal: "center" };

//     // Filters
//     worksheet.addRow([]);
//     worksheet.addRow(["From Date", fromDate || "All"]);
//     worksheet.addRow(["To Date", toDate || "All"]);
//     worksheet.addRow([]);

//     // Headers
//     worksheet.addRow(["Label", "Amount"]).eachCell(cell => {
//       cell.font = { bold: true };
//       cell.fill = {
//         type: "pattern",
//         pattern: "solid",
//         fgColor: { argb: "FFD3D3D3" }
//       };
//       cell.border = {
//         top: { style: "thin" },
//         left: { style: "thin" },
//         bottom: { style: "thin" },
//         right: { style: "thin" }
//       };
//     });

//     // Data
//     const rows = [
//       ["Revenue", revenue],
//       ["COGS", cogs],
//       ["Gross Profit", grossProfit],
//       ["Expenses", expenses],
//       ["Net Profit", netProfit],
//       ["Total Customer Due", dueAmount]
//     ];

//     rows.forEach(r => worksheet.addRow(r));

//     worksheet.columns.forEach(col => {
//       col.width = 25;
//     });

//     // Finalize and send
//     const buffer = await workbook.xlsx.writeBuffer();

//     res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
//     res.setHeader("Content-Disposition", "attachment; filename=ProfitAndLossReport.xlsx");
//     res.send(buffer);
//   } catch (error) {
//     next(error);
//   }
// };

export const profitAndLossExcel = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found!" });

    const { fromDate, toDate } = req.query;
    const start = fromDate ? new Date(fromDate) : new Date("2000-01-01");
    const end = toDate ? new Date(toDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // === Sales (Revenue) ===
    const payments = await PAYMENT_RECORD.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, totalBeforeVAT: { $sum: "$beforeVat" } } }
    ]);
    const revenue = payments[0]?.totalBeforeVAT || 0;

    // === Purchases (COGS) ===
    const purchases = await PURCHASE.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, totalCOGS: { $sum: "$totalBeforeVAT" } } }
    ]);
    const cogs = purchases[0]?.totalCOGS || 0;

    // === Expenses ===
    const expenses = await EXPENSE.find({ createdAt: { $gte: start, $lte: end } }).lean();
    let operatingExpenses = {};
    let TotalOperatingExpenses = 0;

    for (const exp of expenses) {
      for (const item of exp.expenseItems) {
        const account = await ACCOUNT.findById(item.accountId).lean();
        if (!account) continue;
        const name = account.accountName;
        const amount = Number(item.baseTotal) || 0;

        if (!operatingExpenses[name]) {
          operatingExpenses[name] = 0;
        }
        operatingExpenses[name] += amount;
        TotalOperatingExpenses += amount;
      }
    }

    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - TotalOperatingExpenses;

    // === Excel Generation ===
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Profit & Loss");

    // Title
    worksheet.mergeCells("A1:B1");
    worksheet.getCell("A1").value = "Profit and Loss Report";
    worksheet.getCell("A1").font = { size: 16, bold: true };
    worksheet.getCell("A1").alignment = { horizontal: "center" };

    worksheet.addRow([]);

    // Filters Row
    const filters = [
      fromDate ? `From: ${fromDate}` : null,
      toDate ? `To: ${toDate}` : null
    ].filter(Boolean);
    if (filters.length) {
      const filterRow = worksheet.addRow(filters);
      filterRow.eachCell(cell => (cell.font = { bold: true }));
      worksheet.addRow([]);
    }

    // === Income Section ===
    worksheet.addRow(["Income"]).font = { bold: true };
    worksheet.addRow(["Sale", revenue]);

    worksheet.addRow([]);

    // === COGS Section ===
    worksheet.addRow(["Cost of Goods Sold"]).font = { bold: true };
    worksheet.addRow(["Purchase", cogs]);

    worksheet.addRow([]);

    // === Gross Profit ===
    worksheet.addRow(["Gross Profit", grossProfit]).font = { bold: true };

    worksheet.addRow([]);

    // === Operating Expenses ===
    worksheet.addRow(["Operating Expenses"]).font = { bold: true };
    for (const [name, value] of Object.entries(operatingExpenses)) {
      worksheet.addRow([name, value]);
    }
    worksheet.addRow(["Total Operating Expenses", TotalOperatingExpenses]).font = { bold: true };

    worksheet.addRow([]);

    // === Net Profit ===
    worksheet.addRow(["Net Profit", netProfit]).font = { bold: true };

    // Format column width
    worksheet.columns = [
      { width: 35 },
      { width: 20 }
    ];

    // Send Excel
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=profit_and_loss_report.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};


//vat pdf
export const generateVATReportPDF = async (req, res, next) => {
  try {
    const { fromDate, toDate } = req.query;
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found!" });

    const matchStage = { vatAmount: { $gt: 0 } };

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    // === VAT Summary Calculation ===
    const summaryAgg = await TRANSACTION.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            referenceType: "$referenceType",
            type: "$type"
          },
          totalBeforeVAT: { $sum: "$totalBeforeVAT" },
          vatAmount: { $sum: "$vatAmount" }
        }
      }
    ]);

    const vatSummary = {
      totalSales: 0,
      vatOnSales: 0,
      totalPurchase: 0,
      vatOnPurchase: 0,
      totalExpense: 0,
      vatOnExpense: 0,
      netVAT: 0
    };

    summaryAgg.forEach(item => {
      const { referenceType, type } = item._id;
      if (referenceType === "Income" && type === "Credit") {
        vatSummary.totalSales = item.totalBeforeVAT;
        vatSummary.vatOnSales = item.vatAmount;
      } else if (referenceType === "Purchase" && type === "Debit") {
        vatSummary.totalPurchase = item.totalBeforeVAT;
        vatSummary.vatOnPurchase = item.vatAmount;
      } else if (referenceType === "Expense" && type === "Debit") {
        vatSummary.totalExpense = item.totalBeforeVAT;
        vatSummary.vatOnExpense = item.vatAmount;
      }
    });

    vatSummary.netVAT =
      vatSummary.vatOnSales -
      vatSummary.vatOnPurchase -
      vatSummary.vatOnExpense;

    // === VAT Transaction Table ===
    const transactionsAgg = await TRANSACTION.aggregate([
      { $match: matchStage },
      {
        $project: {
          type: 1,
          referenceType: 1,
          referenceId: 1,
          vatAmount: 1,
          totalBeforeVAT: 1,
          purchaseId: 1,
          paymentId: 1,
          expenseId: 1,
          amount: 1,
          createdAt: 1
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    const restaurant = await RESTAURANT.findOne().lean();
    const currency = restaurant?.currency || 'AED';

    const pdfBuffer = await generatePDF('vatReportTemplate', {
      currency,
      vatSummary,
      transactions: transactionsAgg,
      fromDate,
      toDate
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="vat-report-${Date.now()}.pdf"`
    });

    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};


export const generateVATReportExcel = async (req, res, next) => {
  try {
    const { fromDate, toDate } = req.query;
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found!" });

    const matchStage = { vatAmount: { $gt: 0 } };

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    // === VAT Summary ===
    const summaryAgg = await TRANSACTION.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            referenceType: "$referenceType",
            type: "$type"
          },
          totalBeforeVAT: { $sum: "$totalBeforeVAT" },
          vatAmount: { $sum: "$vatAmount" }
        }
      }
    ]);

    const vatSummary = {
      totalSales: 0,
      vatOnSales: 0,
      totalPurchase: 0,
      vatOnPurchase: 0,
      totalExpense: 0,
      vatOnExpense: 0,
      netVAT: 0
    };

    summaryAgg.forEach(item => {
      const { referenceType, type } = item._id;
      if (referenceType === "Income" && type === "Credit") {
        vatSummary.totalSales = item.totalBeforeVAT;
        vatSummary.vatOnSales = item.vatAmount;
      } else if (referenceType === "Purchase" && type === "Debit") {
        vatSummary.totalPurchase = item.totalBeforeVAT;
        vatSummary.vatOnPurchase = item.vatAmount;
      } else if (referenceType === "Expense" && type === "Debit") {
        vatSummary.totalExpense = item.totalBeforeVAT;
        vatSummary.vatOnExpense = item.vatAmount;
      }
    });

    vatSummary.netVAT =
      vatSummary.vatOnSales -
      vatSummary.vatOnPurchase -
      vatSummary.vatOnExpense;

    // === VAT Transaction Table ===
    const transactionsAgg = await TRANSACTION.aggregate([
      { $match: matchStage },
      {
        $project: {
          type: 1,
          referenceType: 1,
          referenceId: 1,
          vatAmount: 1,
          totalBeforeVAT: 1,
          amount: 1,
          createdAt: 1
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    const restaurant = await RESTAURANT.findOne().lean();
    const currency = restaurant?.currency || 'AED';

    // === Generate Excel ===
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("VAT Report");

    // Title
    worksheet.mergeCells("A1:G1");
    worksheet.getCell("A1").value = "VAT Report";
    worksheet.getCell("A1").font = { size: 16, bold: true };
    worksheet.getCell("A1").alignment = { horizontal: "center" };

    worksheet.addRow([]);

    // Filters
    const filters = [
      fromDate ? `From: ${fromDate}` : null,
      toDate ? `To: ${toDate}` : null
    ].filter(Boolean);

    if (filters.length) {
      const filterRow = worksheet.addRow(filters);
      filterRow.eachCell(cell => (cell.font = { bold: true }));
      worksheet.addRow([]);
    }

    // === VAT Summary ===
    worksheet.addRow(["Sales Summary"]).font = { bold: true };
    worksheet.addRow(["Total Sales", vatSummary.totalSales, currency]);
    worksheet.addRow(["VAT on Sales", vatSummary.vatOnSales, currency]);

    worksheet.addRow([]);
    worksheet.addRow(["Purchase Summary"]).font = { bold: true };
    worksheet.addRow(["Total Purchase", vatSummary.totalPurchase, currency]);
    worksheet.addRow(["VAT on Purchase", vatSummary.vatOnPurchase, currency]);

    worksheet.addRow([]);
    worksheet.addRow(["Expense Summary"]).font = { bold: true };
    worksheet.addRow(["Total Expense", vatSummary.totalExpense, currency]);
    worksheet.addRow(["VAT on Expense", vatSummary.vatOnExpense, currency]);

    worksheet.addRow([]);
    worksheet.addRow(["Payable VAT"]).font = { bold: true };
    worksheet.addRow(["Net VAT Payable", vatSummary.netVAT, currency]);

    worksheet.addRow([]);
    worksheet.addRow([]);

    // === VAT Transactions Table ===
    worksheet.addRow(["VAT Transactions"]).font = { bold: true };
    const tableHeader = [
      "Date",
      "Type",
      "Reference",
      `Total Before VAT (${currency})`,
      `VAT(${currency})`,
      `Total(${currency})`
    ];
    const headerRow = worksheet.addRow(tableHeader);
    headerRow.eachCell(cell => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center" };
    });

    transactionsAgg.forEach(txn => {
      worksheet.addRow([
        txn.createdAt ? new Date(txn.createdAt).toLocaleDateString() : "-",
        txn.referenceType || "-",
        txn.referenceId || "-",
        txn.type || "-",
        txn.totalBeforeVAT?.toFixed(2) || "0.00",
        txn.vatAmount?.toFixed(2) || "0.00",
        txn.amount?.toFixed(2) || "0.00"
      ]);
    });

    // Column widths
    worksheet.columns = [
      { width: 15 },
      { width: 18 },
      { width: 20 },
      { width: 18 },
      { width: 20 },
      { width: 18 },
      { width: 18 }
    ];

    // Download response
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=vat_report_${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    next(err);
  }
};



