import PARTNER from '../../model/partner.js';
import mongoose from 'mongoose';
import USER from '../../model/userModel.js'
import TRANSACTION from '../../model/transaction.js'
import ExcelJS from 'exceljs';
import EXPENSE from '../../model/expense.js'
import PAYMENT_RECORD from '../../model/paymentRecord.js'
import PURCHASE from '../../model/purchase.js'
import ACCOUNTS from '../../model/account.js'
import PARTNER_DIVIDEND_PAYOUT from '../../model/dividentPay.js'
import { generateUniqueRefId } from '../POS controller/posOrderCntrl.js'



export const addPartner = async (req, res, next) => {
  try {
    const { name, percentage } = req.body;

      const userId = req.user;
      
    // Validate user
    const user = await USER.findOne({ _id: userId }).lean();
    if (!user) return res.status(400).json({ message: "User not found" });


    if(!name){
        return res.status(400).json({ message:'Name is required!'})
    }

    // if(!mobile){
    //     return res.status(400).json({ message:'Mobile is required!'})
    // }

     if(!percentage){
        return res.status(400).json({ message:'Percentage is required!'})
    }

    const existPartner = await PARTNER.findOne({ name });
    if(existPartner){
        return res.status(400).json({ message:'Partner already exists!'})
    }

    

    // Ensure total percentage does not exceed 100
    const totalPercentage = await PARTNER.aggregate([
      { $group: { _id: null, total: { $sum: "$percentage" } } },
    ]);

    const currentPercentage = totalPercentage[0]?.total || 0;
    if (currentPercentage + percentage > 100) {
      return res
        .status(400)
        .json({ message: "Total partner percentage cannot exceed 100%" });
    }

    const partner = await PARTNER.create({ name, percentage });

    return res.status(201).json({ message: "Partner added successfully", partner });
  } catch (err) {
    next(err);
  }
};



export const getPartners = async(req,res,next)=>{
    try {

         const userId = req.user;
         
        // Validate user
        const user = await USER.findOne({ _id: userId }).lean();
        if (!user) return res.status(400).json({ message: "User not found" });

        const partner = await PARTNER.find({ })

        return res.status(400).json({ data:partner})



        
    } catch (err) {
        next(err)
    }
}


export const updatePartner = async (req, res, next) => {
  try {
    
    const {partnerId, name, percentage } = req.body;
      const userId = req.user;
      
    // Validate user
    const user = await USER.findOne({ _id: userId }).lean();
    if (!user) return res.status(400).json({ message: "User not found" });

    const partner = await PARTNER.findById(partnerId);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    // Check total percentage does not exceed 100 when updating
    const totalPercentage = await PARTNER.aggregate([
      { $match: { _id: { $ne: partner._id } } },
      { $group: { _id: null, total: { $sum: "$percentage" } } },
    ]);

    const currentPercentage = totalPercentage[0]?.total || 0;
    if (percentage != null && currentPercentage + percentage > 100) {
      return res
        .status(400)
        .json({ message: "Total partner percentage cannot exceed 100%" });
    }

    partner.name = name || partner.name;
    partner.percentage = percentage || partner.percentage;

    await partner.save();

    return res.status(200).json({ message: "Partner updated successfully", partner });
  } catch (err) {
    next(err);
  }
};



export const deletePartner = async (req, res, next) => {
  try {
    const { partnerId } = req.params;

    const userId = req.user;

    // Validate user
    const user = await USER.findOne({ _id: userId }).lean();
    if (!user) return res.status(400).json({ message: "User not found" });

    const partner = await PARTNER.findByIdAndDelete(partnerId);
    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    return res.status(200).json({ message: "Partner deleted successfully" });
  } catch (err) {
    next(err);
  }
};



//divident report 
export const getDividendSharingReport = async (req, res, next) => {
  try {


    const { fromDate, toDate } = req.query;

    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found!" });

    let allocateLoss = true ;

    const start = fromDate ? new Date(fromDate) : new Date("2000-01-01");
    const end = toDate ? new Date(toDate) : new Date();
    end.setHours(23, 59, 59, 999);


    // === SALES (Revenue) ===
    const paymentsAgg = await PAYMENT_RECORD.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalBeforeVAT: { $sum: "$beforeVat" }
        }
      }
    ]);
    const revenueBeforeVAT = paymentsAgg[0]?.totalBeforeVAT || 0;

    // === COGS (Purchases) ===
    const purchasesAgg = await PURCHASE.aggregate([
      { $match: {  createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalCOGS: { $sum: "$beforeVat" }
        }
      }
    ]);
    const cogs = purchasesAgg[0]?.totalCOGS || 0;

    // === EXPENSES ===
    const expenseDocs = await EXPENSE.find({
      createdAt: { $gte: start, $lte: end }
    }).lean();

    let totalOperatingExpenses = 0;
    for (const exp of expenseDocs) {
      for (const item of exp.expenseItems) {
        totalOperatingExpenses += item.beforeVat || 0;
      }
    }

    // === PROFIT ===
    const grossProfit = revenueBeforeVAT - cogs;
    const netProfit = grossProfit - totalOperatingExpenses;

    // === PARTNERS ===
    const partners = await PARTNER.find({}).lean();

    // Decide distributable base: losses are ignored unless allocateLoss=true
    const netBase = (allocateLoss === "true") ? netProfit : Math.max(netProfit, 0);

    const partnerShares = partners.map((p) => ({
      partnerId: p._id,
      name: p.name,
      percentage: p.percentage,
      amount: Number(((netBase * (p.percentage || 0)) / 100).toFixed(2))
    }));

    return res.status(200).json({ data:partnerShares, netProfit });

  } catch (err) {
    next(err);
  }
};


export const takePartnerDividend = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found!" });

    const {
      partnerId,
      fromDate,
      toDate,
      amount,
      paymentModeId,
      note
    } = req.body;

    if(!partnerId){
        return res.status(400).json({ message:"Partner Id is required!"})
    }
        if(!fromDate){
        return res.status(400).json({ message:"fromDate is required!"})
    }
        if(!toDate){
        return res.status(400).json({ message:"toDate is required!"})
    }
        if(!amount){
        return res.status(400).json({ message:"Amount  is required!"})
    }
        if(!paymentModeId){
        return res.status(400).json({ message:"Payment mode is required!"})
    }

  

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    const partner = await PARTNER.findById(partnerId).lean();
    if (!partner) return res.status(404).json({ message: "Partner not found" });

    if (amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }


    // SALES (Revenue) from PAYMENT_RECORD: use beforeVat
    const paymentsAgg = await PAYMENT_RECORD.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, totalBeforeVAT: { $sum: "$beforeVat" } } }
    ]);
    const revenueBeforeVAT = paymentsAgg[0]?.totalBeforeVAT || 0;

    // COGS (Purchases) from PURCHASE: use totalBeforeVAT
    const purchasesAgg = await PURCHASE.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, totalCOGS: { $sum: "$totalBeforeVAT" } } }  // << uses totalBeforeVAT
    ]);
    const cogs = purchasesAgg[0]?.totalCOGS || 0;

    // Operating Expenses from EXPENSE: sum expenseItems totalBeforeVAT
    const expenseDocs = await EXPENSE.find({
      createdAt: { $gte: start, $lte: end }
    }).lean();

    let totalOperatingExpenses = 0;
    for (const exp of expenseDocs) {
      for (const item of exp.expenseItems) {
        // Make sure your expenseItems actually store totalBeforeVAT; if not, switch to item.baseTotal.
        totalOperatingExpenses += item.totalBeforeVAT || 0
      }
    }

    const grossProfit = revenueBeforeVAT - cogs;
    const netProfit = grossProfit - totalOperatingExpenses;

    // If there is a loss, do not allow dividend payout (common practice)
    if (netProfit <= 0) {
      return res.status(400).json({ message: "No dividend available: period net profit is 0" });
    }

    // === 2) Compute partner's eligible share for the period ===
    const eligibleAmount = Number(((netProfit * (partner.percentage || 0)) / 100).toFixed(2));

    // === 3) Check how much the partner already took in this period ===
    const paidAgg = await PARTNER_DIVIDEND_PAYOUT.aggregate([
      {
        $match: {
          partnerId: partner._id,
          periodFrom: { $eq: start },
          periodTo: { $eq: end },
          status: "Paid",
        }
      },
      { $group: { _id: null, taken: { $sum: "$amount" } } }
    ]);
    const alreadyTaken = paidAgg[0]?.taken || 0;

    const available = Number((eligibleAmount - alreadyTaken).toFixed(2));
    if (available <= 0) {
      return res.status(400).json({ message: "No remaining dividend available for this period" });
    }

    if (amount > available) {
      return res.status(400).json({
        message: `Requested amount exceeds available dividend. Available: ${available}`
      });
    }

    // === 4) Create TRANSACTION (money out) ==

    const dividendAccount =
      await ACCOUNTS.findOne({ accountType: "Equity", accountName: "Partner Dividend" }).lean();
    if (!dividendAccount) {
      return res.status(400).json({ message: "Equity account 'Partner Dividend' not found" });
    }

    const refId = await generateUniqueRefId();

    // In your system, "Debit" means money going out
    const txn = await TRANSACTION.create({
      restaurantId: dividendAccount.restaurantId || null,
      accountId: dividendAccount._id,
      paymentType: paymentModeId || null,
      amount: amount,
      type: "Debit",
      referenceId: refId,
      referenceType: "Dividend",
      description: note || `Dividend payout to ${partner.name} for period ${start.toISOString().slice(0,10)} to ${end.toISOString().slice(0,10)}`,
      createdById: user._id,
      createdBy: user.name
    });

    // === 5) Save payout record ===
    const payout = await PARTNER_DIVIDEND_PAYOUT.create({
      partnerId: partner._id,
      periodFrom: start,
      periodTo: end,
      netProfit,
      percentage: partner.percentage,
      eligibleAmount,
      amount,
      paymentModeId,
      transactionId: txn._id,
      referenceId: refId,
      note,
      status: "Paid",
      createdById: user._id,
      createdBy: user.name
    });

    // const remaining = Number((available - amount).toFixed(2));

    return res.status(201).json({
      message: "Dividend payout recorded",
    });

  } catch (err) {
    next(err);
  }
};


export const getAvailablePartnerDividends = async (req, res, next) => {
  try {
    const { fromDate, toDate } = req.query;

       const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found!" });

    if (!fromDate || !toDate) {
      return res.status(400).json({ message: "fromDate and toDate are required" });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    // === 1) SALES from PAYMENT_RECORD
    const paymentsAgg = await PAYMENT_RECORD.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, totalBeforeVAT: { $sum: "$beforeVat" } } }
    ]);
    const revenue = paymentsAgg[0]?.totalBeforeVAT || 0;

    // === 2) COGS from PURCHASE
    const purchasesAgg = await PURCHASE.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, totalCOGS: { $sum: "$totalBeforeVAT" } } }
    ]);
    const cogs = purchasesAgg[0]?.totalCOGS || 0;

    // === 3) Operating Expenses from EXPENSE
    const expenseDocs = await EXPENSE.find({ createdAt: { $gte: start, $lte: end } }).lean();
    let totalExpenses = 0;
    for (const exp of expenseDocs) {
      for (const item of exp.expenseItems) {
        totalExpenses += item.totalBeforeVAT || 0;
      }
    }

    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - totalExpenses;

    if (netProfit <= 0) {
      return res.status(200).json({
        message: "No dividend available for the selected period",
      });
    }

    // === 4) Get all partners
    const partners = await PARTNER.find().lean();

    // === 5) Get payouts already made during this period
    const payouts = await PARTNER_DIVIDEND_PAYOUT.aggregate([
      {
        $match: {
          periodFrom: { $eq: start },
          periodTo: { $eq: end },
          status: "Paid"
        }
      },
      {
        $group: {
          _id: "$partnerId",
          totalPaid: { $sum: "$amount" }
        }
      }
    ]);
    const paidMap = {};
    payouts.forEach(p => {
      paidMap[p._id.toString()] = p.totalPaid;
    });

    // === 6) Build result per partner
    const data = partners.map(partner => {
      const eligible = Number(((netProfit * (partner.percentage || 0)) / 100).toFixed(2));
      const alreadyTaken = paidMap[partner._id.toString()] || 0;
      const remaining = Number((eligible - alreadyTaken).toFixed(2));
      return {
        partnerId: partner._id,
        name: partner.name,
        percentage: partner.percentage,
        eligible,
        alreadyTaken,
        remaining
      };
    });

    res.status(200).json({
      fromDate,
      toDate,
      netProfit,
      data
    });

  } catch (err) {
    next(err);
  }
};


