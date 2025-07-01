import ACCOUNTS from '../../model/account.js'
import USER from '../../model/userModel.js';
import RESTAURANT from '../../model/restaurant.js';
import TRANSACTION from '../../model/transaction.js';
import mongoose from 'mongoose';
import { generatePDF } from '../../config/pdfGeneration.js';
import {  generateUniqueRefId } from '../../controller/POS controller/posOrderCntrl.js'



export const createAccounts = async (req, res,next) => {
    try {
      const {
        restaurantId,
        accountName,
        accountType,
        description,
        openingBalance,
        showInPos,
        parentAccountId
      } = req.body;

      const userId = req.user;

   const user = await USER.findOne({ _id: userId })
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

        if(!restaurantId){
            return res.status(400).json({ message:'Restaurnt Id is required!'})
        }
        if(!accountName){
            return res.status(400).json({ message:'Account name is required!'})
        }
        if(!accountType){
            return res.status(400).json({ message:'Account type is required!'})
        }

      // Optional: prevent duplicate account names in same restaurant
      const existing = await ACCOUNTS.findOne({ restaurantId, accountName });
      if (existing) {
        return res.status(400).json({ message: 'Account name already exists.' });
      }

          // Optional: Validate parent account exists
    if (parentAccountId) {
      const parent = await ACCOUNTS.findOne({ _id: parentAccountId, restaurantId });
      
      if (!parent) {
        return res.status(400).json({ message: "Parent account not found." });
      }
    }
  
      const newAccount = new ACCOUNTS({
        restaurantId,
        accountName,
        accountType,
        description,
        openingBalance,
        showInPos,
          parentAccountId: parentAccountId || null,
          createdBy:user.name,
          createdById:user._id
      });
  
      await newAccount.save();
  
      res.status(201).json({
        message: 'Account created successfully.',
        data: newAccount
      });
    } catch (err) {
      next(err)
    }
  };



  export const getAccounts = async(req,res,next)=>{
    try {

          const { restaurantId } = req.params;
    const userId = req.user;

    const user = await USER.findById(userId);
    if (!user) {
      return res.status(400).json({ message: "User not found!" });
    }

    // Fetch all accounts with parentAccountId populated
    const accounts = await ACCOUNTS.find({  })
      .populate({ path: 'parentAccountId', select: 'accountName' });

    // Get all transaction totals grouped by accountId
    const transactions = await TRANSACTION.aggregate([
      {
        $group: {
          _id: '$accountId',
          totalCredit: {
            $sum: {
              $cond: [{ $eq: ['$type', 'Credit'] }, '$amount', 0]
            }
          },
          totalDebit: {
            $sum: {
              $cond: [{ $eq: ['$type', 'Debit'] }, '$amount', 0]
            }
          }
        }
      }
    ]);

    // Step 1: Build initial balance map
    const balanceMap = {};
    transactions.forEach(tx => {
      balanceMap[tx._id.toString()] = {
        credit: tx.totalCredit || 0,
        debit: tx.totalDebit || 0,
      };
    });

    // Step 2: Build account map with base currentBalance
    const accountMap = {};
   accounts.forEach(acc => {
  const bal = balanceMap[acc._id.toString()] || { credit: 0, debit: 0 };
  let currentBalance;

  if (["Expense", "Purchase"].includes(acc.accountType)) {
    currentBalance = bal.debit || 0;
  } else {
    currentBalance = (acc.openingBalance || 0) + bal.credit - bal.debit;
  }

  accountMap[acc._id.toString()] = {
    ...acc._doc,
    currentBalance,
    children: []
  };
});

    // Step 3: Build parent-child relationships
    Object.values(accountMap).forEach(acc => {
      const parentId = acc.parentAccountId?._id?.toString();
      if (parentId && accountMap[parentId]) {
        accountMap[parentId].children.push(acc._id.toString());
      }
    });

    // Step 4: Recursive function to add child balances to parent
    const addChildBalances = (accountId) => {
      const acc = accountMap[accountId];
      if (!acc) return 0;

      let total = acc.currentBalance;
      for (const childId of acc.children) {
        total += addChildBalances(childId);
      }

      acc.currentBalance = total;
      return total;
    };

    // Step 5: Apply roll-up from top-level accounts (no parent)
    Object.values(accountMap).forEach(acc => {
      if (!acc.parentAccountId) {
        addChildBalances(acc._id.toString());
      }
    });

    // Step 6: Format final output
    const result = Object.values(accountMap).map(acc => ({
      _id: acc._id,
      accountName: acc.accountName,
      accountType: acc.accountType,
      description: acc.description,
      openingBalance: acc.openingBalance,
      showInPos: acc.showInPos,
      currentBalance: acc.currentBalance,
      parentAccountId: acc.parentAccountId?._id || null,
      parentAccountName: acc.parentAccountId?.accountName || null,
      createdAt: acc.createdAt,
      createdBy: acc.createdBy,
    }));

    return res.status(200).json({ data: result });
    } catch (err) {
        next(err)
    }
  }


  export const updateAccount = async (req, res, next) => {
    try {

      const {
        restaurantId,
        accountName,
        accountId,
        accountType,
        description,
        showInPos,
        parentAccountId,
        openingBalance
      } = req.body;
  
      const userId = req.user;
      const user = await USER.findOne({ _id: userId });
      if (!user) {
        return res.status(400).json({ message: "User not found!" });
      }
  
      if (!restaurantId || !accountName || !accountType) {
        return res.status(400).json({ message: "Missing required fields!" });
      }
  
      const existingAccount = await ACCOUNTS.findOne({
        _id: { $ne: accountId }, // exclude current account from check
        restaurantId,
        accountName
      });
  
      if (existingAccount) {
        return res.status(400).json({ message: "Account name already exists." });
      }

        if (parentAccountId && parentAccountId === accountId) {
      return res.status(400).json({ message: "Parent account cannot be the same as the account being updated." });
    }
  
      const updated = await ACCOUNTS.findByIdAndUpdate(
        accountId,
        {
          restaurantId,
          accountName,
          accountType,
          description,
          openingBalance,
          showInPos,
          parentAccountId: parentAccountId || null,
        },
        { new: true }
      );
  
      if (!updated) {
        return res.status(404).json({ message: "Account not found." });
      }
  
      res.status(200).json({
        message: "Account updated successfully.",
        data: updated
      });
    } catch (err) {
      next(err);
    }
  };

  export const deleteAccount = async (req, res, next) => {
    try {
      const { accountId } = req.params;

      const userId = req.user;

      const user = await USER.findOne({ _id: userId })
           if (!user) {
               return res.status(400).json({ message: "User not found!" });
           }
  
      const account = await ACCOUNTS.findById(accountId);
      if (!account) {
        return res.status(404).json({ message: "Account not found." });
      }
  
      // const hasTransactions = await TRANSACTION.exists({ accountId });
      // if (hasTransactions) {
      //   return res.status(400).json({ message: "Cannot delete account linked to transactions." });
      // }
  
      await ACCOUNTS.findByIdAndDelete(accountId);
  
      res.status(200).json({ message: "Account permanently deleted." });
    } catch (err) {
      next(err);
    }
  };
  




export const getTransactionList = async (req, res, next) => {
  try {
    const { accountId, fromDate, toDate, search = '' } = req.query;
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found!" });

    const mainAccount = await ACCOUNTS.findById(accountId);
    if (!mainAccount) return res.status(400).json({ message: 'Account not found!' });

    // Get all child accounts if any
    const childAccounts = await ACCOUNTS.find({ parentAccountId: accountId }, { _id: 1 });

    // Prepare accountId list to match in transactions
    const accountIdsToMatch = [mainAccount._id, ...childAccounts.map(acc => acc._id)];

    const matchStage = {
      accountId: { $in: accountIdsToMatch }
    };

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
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
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
                let: { parentId: "$accountInfo.parentAccountId" },
                pipeline: [
                  { $match: { $expr: { $eq: ["$_id", "$$parentId"] } } }
                ],
                as: "parentInfo"
              }
            },
            { $unwind: { path: "$parentInfo", preserveNullAndEmptyArrays: true } },
            //  New lookup for paymentType
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
              $project: {
                _id: 1,
                referenceType: 1,
                referenceId: 1,
                type: 1,
                amount: 1,
                narration: 1,
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



export const generateTransactionListPDF = async (req, res, next) => {
  try {
    const { accountId, fromDate, toDate, search = '' } = req.query;

    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: 'User not found!' });

    const mainAccount = await ACCOUNTS.findById(accountId).lean();
    if (!mainAccount) return res.status(400).json({ message: 'Account not found!' });

    // Fetch currency from restaurant
    const restaurant = await RESTAURANT.findOne().lean();
    const currency = restaurant?.currency || 'AED';

    // Get child accounts under the selected parent
    const childAccounts = await ACCOUNTS.find({ parentAccountId: accountId }).lean();
    const accountIdsToMatch = [mainAccount._id, ...childAccounts.map(a => a._id)];

    const matchStage = {
      accountId: { $in: accountIdsToMatch }
    };

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
            { narration: { $regex: search, $options: 'i' } }
          ]
        }
      : null;

    const pipeline = [
      { $match: matchStage },
      ...(searchStage ? [{ $match: searchStage }] : []),
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'accounts',
          localField: 'accountId',
          foreignField: '_id',
          as: 'acct'
        }
      },
      { $unwind: '$acct' },
      {
        $project: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          referenceId: 1,
          referenceType: 1,
          accountType: '$acct.accountType',
          paymentType: '$acct.accountName',
          amount: 1
        }
      }
    ];

    const data = await TRANSACTION.aggregate(pipeline);
    const totalAmount = data.reduce((sum, tx) => sum + tx.amount, 0);

    const pdfBuffer = await generatePDF('transactionListTemp', {
      data,
      currency,
      totalAmount,
      filters: {
        fromDate,
        toDate,
        search
      }
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="transactions-${Date.now()}.pdf"`
    });

    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

  

export const createTransactionModule= async(req,res,next)=>{
  try {
    console.log(req.body)

    const  { date,accountId,note,amount,accountType,paymentAccountId} = req.body;

    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: 'User not found!' });

    if(!date){
      return res.status(400).json({ message:"Date is required!"})
    }
    if(!accountId){
      return res.status(400).json({ message:'Account Id is required!'})
    }
    if(!accountType){
      return res.status(400).json({ message:'Account Type is required!'})
    }
    if(!paymentAccountId){
      return res.status(400).json({ message:"Payment Type is required!"})
    }

    if(!amount){
      return res.status(400).json({message:'Amount is required!'})
    }



    const account = ACCOUNTS.findById(accountId).lean();

    if(!account){
      return res.status(400).json({ message:'Account not found!'})
    }

    const refId = await generateUniqueRefId();

     const debitTXn = {
      restaurantId: account.restaurantId || null,
      accountId: accountId,
      paymentType:paymentAccountId || null,
      amount,
      type:"Debit", // it's an outgoing expense/purchase
      referenceId: refId,
      referenceType: accountType, // Use account type as reference
      description: note || `Manual ${account.accountType} entry`,
      createdById: user._id,
      createdBy: user.name,
      createdAt: new Date(date),
    };

        // Create CREDIT transaction in Payment (Cash/Bank/Card) account
    const creditTxn = {
      restaurantId: account.restaurantId || null,
      accountId: paymentAccountId,
      amount,
      type: "Credit",
      referenceId: refId,
      referenceType: accountType,
      description: note || `Payment for ${accountType}`,
      createdById: user._id,
      createdBy: user.name,
      createdAt: new Date(date),
    };

    await TRANSACTION.insertMany([debitTXn,creditTxn])

    return res.status(200).json({ message: "Transaction created successfully!" });
    
  } catch (err) {
    next(err)
  }
}


export const getPurchseExpenceList = async (req, res, next) => {
  try {
    const { fromDate, toDate, search = '' } = req.query;
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

      // Filter only Expense or Purchase transactions
      {
        $match: {
          "accountInfo.accountType": { $in: ["Expense", "Purchase"] }
        }
      },

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

      {
        $project: {
          _id: 1,
          referenceType: 1,
          referenceId: 1,
          type: 1,
          amount: 1,
          narration: 1,
          createdAt: 1,
               paymentType: {
            $ifNull: ["$paymentTypeInfo.accountName", null]
          },
          account: {
            name: "$accountInfo.accountName",
            type: "$accountInfo.accountType"
          },
          parentAccount: {
            name: "$parentInfo.accountName",
            type: "$parentInfo.accountType"
          }
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit }
          ],
          totalCount: [
            { $count: "count" }
          ],
          totalAmount: [
            {
              $group: {
                _id: null,
                sum: { $sum: "$amount" }
              }
            }
          ]
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



export const generatePurchseExpencePDF = async (req, res, next) => {
  try {
    const { fromDate, toDate, search = '' } = req.query;

    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(400).json({ message: "User not found!" });

    const restaurant = await RESTAURANT.findOne().lean();
    const currency = restaurant?.currency || 'AED';

    const matchStage = {};

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
        $match: {
          "accountInfo.accountType": { $in: ["Expense", "Purchase"] }
        }
      },
      {
        $project: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          referenceId: 1,
          referenceType: 1,
          accountType: "$accountInfo.accountType",
          accountName: "$accountInfo.accountName",
          amount: 1
        }
      },
      { $sort: { date: -1 } }
    ];

    const data = await TRANSACTION.aggregate(pipeline);

    const totalAmount = data.reduce((sum, t) => sum + (t.amount || 0), 0);

    const pdfBuffer = await generatePDF("purchaseExpenceTemp", {
      data,
      currency,
      totalAmount,
      filters: { fromDate, toDate, search }
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="purchase-expense-${Date.now()}.pdf"`
    });

    return res.send(pdfBuffer);

  } catch (err) {
    next(err);
  }
};

