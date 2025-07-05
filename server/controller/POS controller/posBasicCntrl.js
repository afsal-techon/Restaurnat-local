import TABLES from '../../model/tables.js';
import FLOORS from '../../model/floor.js';
import USER from '../../model/userModel.js';
import mongoose from 'mongoose';
import RESTAURANT from '../../model/restaurant.js';
import CUSTOMER_TYPE from '../../model/customerTypes.js'
import CUSTOMER from '../../model/customer.js'
import { generateUniqueRefId } from '../../controller/POS controller/posOrderCntrl.js';
import ORDER from '../../model/oreder.js';
import PAYMENT from '../../model/paymentRecord.js'
import TRANSACTION from '../../model/transaction.js'
import { generatePDF } from '../../config/pdfGeneration.js'



export const getFloorsForPOS = async (req, res, next) => {
    try {
        const { restaurantId } = req.params;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId})
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant ID is required!" });
        }

        let filter = {};
        if (user.role === "CompanyAdmin") {
            filter = { _id: restaurantId, companyAdmin: user._id };
        } else if (user.role === "User") {
            filter = { _id: restaurantId }; // assuming 'user' field exists in restaurant
        } else {
            return res.status(403).json({ message: "Unauthorized access!" });
        }

        // Aggregation to include the number of tables (optional)
        const floors = await FLOORS.aggregate([
            { $match: { restaurantId: new mongoose.Types.ObjectId(restaurantId)} },
            {
                $lookup: {
                    from: 'tables', // Collection name for tables
                    localField: '_id', // Field in the floors collection
                    foreignField: 'floorId', // Field in the tables collection
                    as: 'tables', // Alias for the joined data
                },
            },
            {
                $addFields: {
                    tableCount: { $size: { $ifNull: ['$tables', []] } }, // Handle missing tables gracefully
                },
            },
            {
                $project: {
                    tables: 0, // Exclude the tables array if only the count is needed
                },
            },
         // Sort by creation date
        ]);

        return res.status(200).json({ floors });
    } catch (err) {
        next(err);
    }
};



export const getTablesForPOS = async (req,res,next)=>{
    try {

        const { restaurantId } = req.params;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId })
        if (!user) {
            return res.status(404).json({ message: "User not found!" });
        }

        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant Id is required!" });
        }

        const tables = await TABLES.find({ restaurantId})
        .lean();

        return res.status(200).json({ tables })
        
    } catch (err) {
        next(err)
    }
}



export const createCustomerForPOS = async (req,res,next)=>{
    try {

        const { restaurantId, name, mobileNo, address, credit } = req.body;

        const userId = req.user;
        const user = await USER.findOne({ _id: userId })
      if (!user) {
        return res.status(400).json({ message: "User not found!" });
      }
        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant Id is required!" });
        }
        if(!name){
            return res.status(400).json({ message:'Customer name is required!'})
        }
        if(!mobileNo){
            return res.status(400).json({ message:'Mobile number is required!'})
        }

        let filter = {};
        if (user.role === "CompanyAdmin") {
          filter = { _id: restaurantId, companyAdmin: user._id };
        } else if (user.role === "User") {
          filter = { _id: restaurantId };
        } else {
          return res.status(403).json({ message: "Unauthorized!" });
        }

        const restaurant = await RESTAURANT.findOne(filter);
        if (!restaurant) {
          return res.status(404).json({ message: "Restaurant not found!" });
        }

        const existingCustomer = await CUSTOMER.findOne({
            restaurantId,
            mobileNo
        });

    if (existingCustomer) {
        return res.status(409).json({ success: false, message: 'Customer with this mobile number already exists' });
      }

    const customer =   await CUSTOMER.create({
        restaurantId,
        name,
        mobileNo,
        address,
         credit: parseFloat((credit ?? 0).toFixed(2)),
        createdById:user._id,
        createdBy:user.name,
      
      })

        return res.status(200).json({ data: customer })
        
    } catch (err) {
        next(err)
    }
}

export const getCustomersForPOS = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user;
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    //  Validate user
    const user = await USER.findOne({ _id: userId });
    if (!user) {
      return res.status(400).json({ message: "User not found!" });
    }

    if (!restaurantId) {
      return res.status(400).json({ message: "Restaurant Id is required!" });
    }

    //  Total customer count
    const totalCount = await CUSTOMER.countDocuments({ restaurantId });

    //  Get paginated customers
    const customers = await CUSTOMER.find({ restaurantId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Aggregate total orders and total spent
     const customerIds = customers.map(c => c._id);

    // Aggregate only total orders
    const orderStats = await ORDER.aggregate([
      {
        $match: {
          customerId: { $in: customerIds },
          status: "Completed"
        }
      },
      {
        $group: {
          _id: "$customerId",
          totalOrders: { $sum: 1 }
        }
      }
    ]);

    // Map totalOrders by customerId
    const orderMap = {};
    orderStats.forEach(stat => {
      orderMap[stat._id.toString()] = stat.totalOrders;
    });

    // Merge customer data
    const customerSummary = customers.map(c => ({
      ...c._doc,
      totalOrders: orderMap[c._id.toString()] || 0,
    }));

    return res.status(200).json({
      data: customerSummary,
      totalCount,
      page,
      limit
    });


  } catch (err) {
    console.error("Error in getCustomersForPOS:", err);
    next(err);
  }
};



  export const updateCustomerforPOS = async (req, res, next) => {
    try {
      const { customerId, restaurantId, name, mobileNo, address,credit  } = req.body;
      const userId = req.user;
  
      if (!customerId) {
        return res.status(400).json({ message: "Customer Id is required!" });
      }
  
      if (!restaurantId) {
        return res.status(400).json({ message: "Restaurant Id is required!" });
      }
  
      if (!name) {
        return res.status(400).json({ message: "Customer name is required!" });
      }
  
      if (!mobileNo) {
        return res.status(400).json({ message: "Mobile number is required!" });
      }
  
      const user = await USER.findOne({ _id: userId,  });
      if (!user) {
        return res.status(400).json({ message: "User not found!" });
      }
  
      // Role-based restaurant access
      let filter = {};
      if (user.role === "CompanyAdmin") {
        filter = { _id: restaurantId, companyAdmin: user._id };
      } else if (user.role === "User") {
        filter = { _id: restaurantId };
      } else {
        return res.status(403).json({ message: "Unauthorized!" });
      }
  
      const restaurant = await RESTAURANT.findOne(filter);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found!" });
      }
  
      const customer = await CUSTOMER.findOne({
        _id: customerId,
        restaurantId
      });
  
      if (!customer) {
        return res.status(404).json({ message: "Customer not found!" });
      }
  
      // Check for duplicate mobileNo excluding current customer
      const duplicate = await CUSTOMER.findOne({
        _id: { $ne: customerId },
        restaurantId,
        mobileNo,
      });
  
      if (duplicate) {
        return res.status(409).json({ message: "Mobile number already exists!" });
      }
  
      // Update fields
      customer.name = name.trim();
      customer.mobileNo = mobileNo.trim();
      customer.address = address?.trim() || "";
      customer.credit = credit;
  
      await customer.save();
  
      return res.status(200).json({
        success: true,
        message: "Customer updated successfully",
        data: customer,
      });
    } catch (err) {
      next(err);
    }
  };
  

  

  export const getCustomerTypesForPOS = async (req, res, next) => {
    try {
        const { restaurantId } = req.params;
        const userId = req.user;

        // Validate restaurantId
        if (!restaurantId) {
            return res.status(400).json({ message: "Valid restaurantId is required!" });
        }

        // Check user exists
        const user = await USER.findById(userId);
        if (!user) return res.status(400).json({ message: "User not found!" });

        // Verify restaurant exists and user has access
        const restaurant = await RESTAURANT.findOne({_id:restaurantId});
        if (!restaurant) {
            return res.status(404).json({ message: "Restaurant not found!" });
        }

        // Get all customer types for this restaurant
        const customerTypes = await CUSTOMER_TYPE.find({})

        return res.status(200).json({data:customerTypes});
    } catch (err) {
        next(err);
    }
};


export const payCustomerDue = async(req,res,next)=>{
  try {

    const userId = req.user;

    const { restaurantId,customerId, amount, accountId, note } = req.body;

    const user = await USER.findById(userId).lean();
    if (!user) return res.status(400).json({ message: "User not found" });

       const customer = await CUSTOMER.findOne({ _id: customerId });
     if (!customer) return res.status(404).json({ message: "Customer not found" });

     if(!amount){
      return res.status(400).json({ message:'Amount is required!'})
     }

     if(!accountId){
      return res.status(400).json({message:'Account Id is required'})
     }

      const currentCredit = customer.credit || 0;


      if(amount > currentCredit){
         return res.status(400).json({ message: "Amount exceeds customer's due" });
      }

      customer.credit = currentCredit - amount;
      customer.totalSpend += amount;
      await customer.save();


       const refId = await generateUniqueRefId();

          await TRANSACTION.create({
          restaurantId,
          accountId,
          amount,
          type: "Credit",
          referenceId: refId,
          referenceType: "Due Payment",
          description: note || `Customer Due Payment by ${customer.name}`,
          createdById: userId,
          createdBy:user.name,
          customerId: customer._id,
    });

       return res.status(200).json({
      message: "Due payment recorded successfully",
    });
    
  } catch (err) {
     next(err)
  }
}

export const getCustomerOrderHistory = async (req, res, next) => {
  try {
  
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const {customerId, fromDate, toDate, search = '' } = req.query;

    if (!customerId) {
      return res.status(400).json({ message: "Customer ID is required" });
    }

    const matchStage = {
      customerId: new mongoose.Types.ObjectId(customerId),
      status: "Completed",
    };

    // Date filter
    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    const pipeline = [
      { $match: matchStage },
      { $sort: { createdAt: -1 } },

      // Search filtering stage (if search is applied)
      ...(search
        ? [
            {
              $lookup: {
                from: "customertypes",
                localField: "customerTypeId",
                foreignField: "_id",
                as: "customerTypeSearch",
              },
            },
            {
              $unwind: {
                path: "$customerTypeSearch",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $match: {
                $or: [
                  { order_id: { $regex: search, $options: "i" } },
                  { orderNo: { $regex: search, $options: "i" } },
                  { ticketNo: { $regex: search, $options: "i" } },
                  { "customerTypeSearch.type": { $regex: search, $options: "i" } },
                ],
              },
            },
          ]
        : []),

      {
        $facet: {
          metadata: [{ $count: "totalCount" }],
          data: [
            { $skip: skip },
            { $limit: limit },

            {
              $lookup: {
                from: "tables",
                localField: "tableId",
                foreignField: "_id",
                as: "table",
              },
            },
            { $unwind: { path: "$table", preserveNullAndEmptyArrays: true } },

            {
              $lookup: {
                from: "customertypes",
                localField: "customerTypeId",
                foreignField: "_id",
                as: "customerType",
              },
            },
            { $unwind: { path: "$customerType", preserveNullAndEmptyArrays: true } },

            {
              $lookup: {
                from: "paymentrecords",
                localField: "_id",
                foreignField: "orderId",
                as: "payment",
              },
            },
            { $unwind: { path: "$payment", preserveNullAndEmptyArrays: true } },

            {
              $unwind: {
                path: "$payment.methods",
                preserveNullAndEmptyArrays: true,
              },
            },

            {
              $lookup: {
                from: "accounts",
                localField: "payment.methods.accountId",
                foreignField: "_id",
                as: "paymentMethodAccount",
              },
            },
            {
              $unwind: {
                path: "$paymentMethodAccount",
                preserveNullAndEmptyArrays: true,
              },
            },

            {
              $group: {
                _id: "$_id",
                order_id: { $first: "$order_id" },
                orderNo: { $first: "$orderNo" },
                ticketNo: { $first: "$ticketNo" },
                discount: { $first: "$discount" },
                createdAt: { $first: "$createdAt" },
                status: { $first: "$status" },
                table: { $first: "$table.name" },
                customerType: { $first: "$customerType.type" },
                grandTotal: { $first: "$payment.grandTotal" },
                paidAmount: { $first: "$payment.paidAmount" },
                dueAmount: { $first: "$payment.dueAmount" },
                methods: {
                  $push: {
                    accountName: "$paymentMethodAccount.accountName",
                    amount: "$payment.methods.amount",
                  },
                },
              },
            },
            {
              $project: {
                _id: 1,
                order_id: 1,
                orderNo: 1,
                ticketNo: 1,
                discount: 1,
                createdAt: 1,
                table: 1,
                status: 1,
                customerType: 1,
                grandTotal: 1,
                paidAmount: 1,
                dueAmount: 1,
                methods: {
                  $filter: {
                    input: "$methods",
                    as: "m",
                    cond: { $ne: ["$$m.accountName", null] },
                  },
                },
              },
            },
          ],
        },
      },
    ];

    const result = await ORDER.aggregate(pipeline);

    const fullData = result[0]?.data || [];
    const totalCount = result[0]?.metadata[0]?.totalCount || 0;

    return res.status(200).json({
      data: fullData,
      totalCount,
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
};


export const getCustomerDueHistory = async (req, res, next) => {
  try {
    const { customerId, fromDate, toDate, search = '' } = req.query;
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const customer = await CUSTOMER.findById(customerId);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    const matchStage = {
      customerId: new mongoose.Types.ObjectId(customerId)
    };

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    if (search) {
      matchStage.$or = [
        { referenceId: { $regex: search, $options: 'i' } },
        { referenceType: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const pipeline = [
      { $match: matchStage },
      { $sort: { createdAt: 1 } },

      // Account Info
      {
        $lookup: {
          from: "accounts",
          localField: "accountId",
          foreignField: "_id",
          as: "accountInfo"
        }
      },
      { $unwind: "$accountInfo" },

      // FILTER ONLY Due Payment or Sale with accountType = "Due"
      {
        $match: {
          $or: [
            { referenceType: "Due Payment" },
            {
              referenceType: "Sale",
              "accountInfo.accountType": "Due"
            }
          ]
        }
      },

      // Parent Info
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

      // Payment Method
      {
        $lookup: {
          from: "accounts",
          localField: "paymentType",
          foreignField: "_id",
          as: "paymentTypeInfo"
        }
      },
      { $unwind: { path: "$paymentTypeInfo", preserveNullAndEmptyArrays: true } },

      // Reverse logic (for view)
      {
        $addFields: {
          credit: {
            $cond: [
              { $eq: ["$referenceType", "Due Payment"] },
              "$amount",
              0
            ]
          },
          debit: {
            $cond: [
              { $eq: ["$referenceType", "Sale"] },
              "$amount",
              0
            ]
          }
        }
      },

      // Grouping for running total
      {
        $group: {
          _id: null,
          transactions: { $push: "$$ROOT" },
          totalCredit: { $sum: "$credit" },
          totalDebit: { $sum: "$debit" }
        }
      },

      // Add running due
      {
        $addFields: {
          transactionsWithRunningBalance: {
            $reduce: {
              input: "$transactions",
              initialValue: {
                runningDue: 0,
                transactions: []
              },
              in: {
                runningDue: {
                  $add: [
                    "$$value.runningDue",
                    {
                      $cond: [
                        { $eq: ["$$this.referenceType", "Sale"] },
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
                            dueBalance: {
                              $add: [
                                "$$value.runningDue",
                                {
                                  $cond: [
                                    { $eq: ["$$this.referenceType", "Sale"] },
                                    "$$this.amount",
                                    { $multiply: ["$$this.amount", -1] }
                                  ]
                                }
                              ]
                            },
                            account: {
                              name: "$$this.accountInfo.accountName",
                              type: "$$this.accountInfo.accountType"
                            },
                            parentAccount: {
                              name: "$$this.parentInfo.accountName",
                              type: "$$this.parentInfo.accountType"
                            },
                            paymentMethod: {
                              $ifNull: ["$$this.paymentTypeInfo.accountName", null]
                            }
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
          allData: "$transactionsWithRunningBalance.transactions",
          totalCredit: 1,
          totalDebit: 1
        }
      },

      {
        $addFields: {
          data: { $slice: ["$allData", skip, limit] },
          totalCount: { $size: "$allData" },
          totalDue: {
            $subtract: ["$totalDebit", "$totalCredit"]
          }
        }
      },

      {
        $project: {
          data: 1,
          totalCount: 1,
          totalCredit: 1,
          totalDebit: 1,
          totalDue: 1
        }
      }
    ];

    const result = await TRANSACTION.aggregate(pipeline);

    const final = result[0] || {
      data: [],
      totalCount: 0,
      totalCredit: 0,
      totalDebit: 0,
      totalDue: 0
    };

    return res.status(200).json({
      data: final.data,
      totalCount: final.totalCount,
      totalCredit: final.totalCredit,
      totalDebit: final.totalDebit,
      totalDue: final.totalDue,
      page,
      limit
    });

  } catch (err) {
    next(err);
  }
};


export const generateCustomerDueHistoryPDF = async (req, res, next) => {
  try {
    const { customerId, fromDate, toDate, search = '' } = req.query;

    const customer = await CUSTOMER.findById(customerId).lean();
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const restaurant = await RESTAURANT.findOne().lean();
    const currency = restaurant?.currency || 'AED';

    const matchStage = { customerId: new mongoose.Types.ObjectId(customerId) };

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    if (search) {
      matchStage.$or = [
        { referenceId: { $regex: search, $options: 'i' } },
        { referenceType: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const pipeline = [
      { $match: matchStage },
      { $sort: { createdAt: 1 } },
      { $lookup: { from: 'accounts', localField: 'accountId', foreignField: '_id', as: 'accountInfo' } },
      { $unwind: '$accountInfo' },
      {
        $match: {
          $or: [
            { referenceType: 'Due Payment' },
            { referenceType: 'Sale', 'accountInfo.accountType': 'Due' }
          ]
        }
      },
      {
        $lookup: {
          from: 'accounts',
          let: { parentId: '$accountInfo.parentAccountId' },
          pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$parentId'] } } }],
          as: 'parentInfo'
        }
      },
      { $unwind: { path: '$parentInfo', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'accounts', localField: 'paymentType', foreignField: '_id', as: 'paymentTypeInfo' } },
      { $unwind: { path: '$paymentTypeInfo', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          credit: { $cond: [{ $eq: ['$referenceType', 'Due Payment'] }, '$amount', 0] },
          debit: { $cond: [{ $eq: ['$referenceType', 'Sale'] }, '$amount', 0] }
        }
      },
      {
        $group: {
          _id: null,
          transactions: { $push: '$$ROOT' },
          totalCredit: { $sum: '$credit' },
          totalDebit: { $sum: '$debit' }
        }
      },
      {
        $addFields: {
          transactionsWithRunningBalance: {
            $reduce: {
              input: '$transactions',
              initialValue: { runningDue: 0, transactions: [] },
              in: {
                runningDue: {
                  $add: [
                    '$$value.runningDue',
                    {
                      $cond: [
                        { $eq: ['$$this.referenceType', 'Sale'] },
                        '$$this.amount',
                        { $multiply: ['$$this.amount', -1] }
                      ]
                    }
                  ]
                },
                transactions: {
                  $concatArrays: [
                    '$$value.transactions',
                    [
                      {
                        $mergeObjects: [
                          '$$this',
                          {
                            dueBalance: {
                              $add: [
                                '$$value.runningDue',
                                {
                                  $cond: [
                                    { $eq: ['$$this.referenceType', 'Sale'] },
                                    '$$this.amount',
                                    { $multiply: ['$$this.amount', -1] }
                                  ]
                                }
                              ]
                            },
                            account: {
                              name: '$$this.accountInfo.accountName',
                              type: '$$this.accountInfo.accountType'
                            },
                            parentAccount: {
                              name: '$$this.parentInfo.accountName',
                              type: '$$this.parentInfo.accountType'
                            },
                            paymentMethod: {
                              $ifNull: ['$$this.paymentTypeInfo.accountName', null]
                            }
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
          data: '$transactionsWithRunningBalance.transactions',
          totalCredit: 1,
          totalDebit: 1,
          totalDue: { $subtract: ['$totalDebit', '$totalCredit'] }
        }
      }
    ];

    const result = await TRANSACTION.aggregate(pipeline);
    const final = result[0] || {
      data: [],
      totalCredit: 0,
      totalDebit: 0,
      totalDue: 0
    };

    // 🧾 Call your shared PDF generator
    const pdfBuffer = await generatePDF('customerDueHistoryTemp', {
      data: final.data,
      currency,
      totalCredit: final.totalCredit,
      totalDebit: final.totalDebit,
      totalDue: final.totalDue,
      filters: {
        fromDate,
        toDate,
        search,
        customerName: customer.name
      },
      customer
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="customer-due-${Date.now()}.pdf"`
    });

    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};






