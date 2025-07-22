import mongoose from "mongoose";
import USER from '../../model/userModel.js';
import ORDER from '../../model/oreder.js';
import PAYMENT from '../../model/paymentRecord.js'
import RESTAURANT from "../../model/restaurant.js";
import CUSTOMER_TYPE from '../../model/customerTypes.js'
import {  generatePDF } from '../../config/pdfGeneration.js'
import ExcelJS from 'exceljs';


export const getALLOrderSummary = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found" });

    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const {
      fromDate,
      toDate,
      customerTypeId,
      paymentMethod,
      status,
      search,
      minPrice,
      maxPrice,
    } = req.query;

    const matchStage = {};

    // Date range
    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    // Customer Type
    if (customerTypeId) {
      matchStage.customerTypeId = new mongoose.Types.ObjectId(customerTypeId);
    }

    // Status
    if (status) {
      matchStage.status = status;
    }

    const pipeline = [
      { $match: matchStage },

      {
        $lookup: {
          from: "paymentrecords",
          localField: "_id",
          foreignField: "orderId",
          as: "paymentInfo",
        },
      },
      { $unwind: { path: "$paymentInfo", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$paymentInfo.methods", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "accounts",
          localField: "paymentInfo.methods.accountId",
          foreignField: "_id",
          as: "account",
        },
      },
      { $unwind: { path: "$account", preserveNullAndEmptyArrays: true } },

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
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },

      {
        $addFields: {
          order_id_str: { $toString: "$order_id" },
        },
      },
    ];

    // Payment Method filter
    if (paymentMethod) {
      pipeline.push({
        $match: {
          "account.accountName": paymentMethod,
        },
      });
    }

    // Search filter
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { orderNo: { $regex: search, $options: "i" } },
            { order_id_str: { $regex: search, $options: "i" } },
            { ticketNo: { $regex: search, $options: "i" } },
            { "table.name": { $regex: search, $options: "i" } },
            { "customer.name": { $regex: search, $options: "i" } },
            { "customerType.type": { $regex: search, $options: "i" } },
            { "account.accountName": { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    pipeline.push(
      {
        $group: {
          _id: "$_id",
          order_id: { $first: "$order_id" },
          orderNo: { $first: "$orderNo" },
          ticketNo: { $first: "$ticketNo" },
          orderType: { $first: "$orderType" },
          table: { $first: "$table.name" },
          customerType: { $first: "$customerType.type" },
          discount: { $first: "$discount" },
          subTotal: { $first: "$subTotal" },
          grandTotal: { $first: "$paymentInfo.grandTotal" },
          paidAmount: { $first: "$paymentInfo.paidAmount" },
          customer: { $first: "$customer.name" },
          status: { $first: "$status" },
          createdAt: { $first: "$createdAt" },
          paymentMethods: {
            $push: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$paymentInfo.methods.amount", null] },
                    { $ne: ["$account.accountName", null] },
                  ],
                },
                {
                  type: "$account.accountName",
                  amount: "$paymentInfo.methods.amount",
                },
                "$$REMOVE",
              ],
            },
          },
        },
      },
      {
        $addFields: {
          grandTotal: { $ifNull: ["$grandTotal", 0] },
          paidAmount: { $ifNull: ["$paidAmount", 0] },
        },
      }
    );

    // 💰 Apply grandTotal price filtering
    const priceFilter = {};
    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    if (!isNaN(min)) priceFilter.$gte = min;
    if (!isNaN(max)) priceFilter.$lte = max;
    if (Object.keys(priceFilter).length > 0) {
      pipeline.push({
        $match: {
          grandTotal: priceFilter,
        },
      });
    }

    pipeline.push(
      {
        $sort: { createdAt: -1 },
      },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: "count" }],
        },
      },
      {
        $project: {
          data: 1,
          totalCount: {
            $ifNull: [{ $arrayElemAt: ["$totalCount.count", 0] }, 0],
          },
        },
      }
    );

    const result = await ORDER.aggregate(pipeline);

    return res.json({
      page,
      limit,
      totalCount: result[0]?.totalCount || 0,
      data: result[0]?.data || [],
    });
  } catch (err) {
    next(err);
  }
};



export const getSingleOrder = async (req, res, next) => {
  try {
     
    const { orderId } = req.params;

     const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found" });

    if(!orderId){
        return res.status(400).json({ message:'Order Id is required!'})
    }

      const order = await ORDER.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(orderId) } },

      // Lookup payment info
      {
        $lookup: {
          from: "paymentrecords",
          localField: "_id",
          foreignField: "orderId",
          as: "paymentInfo"
        }
      },
      { $unwind: { path: "$paymentInfo", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$paymentInfo.methods", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "accounts",
          localField: "paymentInfo.methods.accountId",
          foreignField: "_id",
          as: "account"
        }
      },
      { $unwind: { path: "$account", preserveNullAndEmptyArrays: true } },

      // Table / customer type / customer
      {
        $lookup: {
          from: "tables",
          localField: "tableId",
          foreignField: "_id",
          as: "table"
        }
      },
      { $unwind: { path: "$table", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "customertypes",
          localField: "customerTypeId",
          foreignField: "_id",
          as: "customerType"
        }
      },
      { $unwind: { path: "$customerType", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer"
        }
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },

      // Look up food image
      {
        $lookup: {
          from: "foods",
          localField: "items.foodId",
          foreignField: "_id",
          as: "foodItems"
        }
      },

      // Look up combo image
      {
        $lookup: {
          from: "combos",
          localField: "items.comboId",
          foreignField: "_id",
          as: "comboItems"
        }
      },

      // Group and reshape
      {
        $group: {
          _id: "$_id",
          order_id: { $first: "$order_id" },
          orderNo: { $first: "$orderNo" },
          ticketNo: { $first: "$ticketNo" },
          orderType: { $first: "$orderType" },
          table: { $first: "$table.name" },
          customerType: { $first: "$customerType.type" },
          
          discount: { $first: "$discount" },
          subTotal: { $first: "$subTotal" },
          vat: { $first: "$vat" },
          grandTotal: { $first: "$paymentInfo.grandTotal" },
          paidAmount: { $first: "$paymentInfo.paidAmount" },
          status: { $first: "$status" },
          createdAt: { $first: "$createdAt" },
          rawItems: { $first: "$items" },
          foodItems: { $first: "$foodItems" },
          comboItems: { $first: "$comboItems" },
          customer: {
            $first: {
              name: "$customer.name",
              address: "$customer.address",
              mobileNo: "$customer.mobileNo"
            }
          },
          paymentMethodList: {
            $addToSet: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$paymentInfo.methods", null] },
                    { $ne: ["$paymentInfo.methods.amount", null] },
                    { $ne: ["$account.accountName", null] }
                  ]
                },
                {
                  type: "$account.accountName",
                  amount: "$paymentInfo.methods.amount"
                },
                "$$REMOVE"
              ]
            }
          }
        }
      },

      // Final stage to attach food & combo images into each item
      {
        $addFields: {
          items: {
            $map: {
              input: "$rawItems",
              as: "item",
              in: {
                $mergeObjects: [
                  "$$item",
                  {
                    foodImage: {
                      $let: {
                        vars: {
                          found: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: "$foodItems",
                                  as: "fi",
                                  cond: { $eq: ["$$fi._id", "$$item.foodId"] }
                                }
                              },
                              0
                            ]
                          }
                        },
                        in: "$$found.image"
                      }
                    },
                    comboImage: {
                      $let: {
                        vars: {
                          found: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: "$comboItems",
                                  as: "ci",
                                  cond: { $eq: ["$$ci._id", "$$item.comboId"] }
                                }
                              },
                              0
                            ]
                          }
                        },
                        in: "$$found.image"
                      }
                    }
                  }
                ]
              }
            }
          },
          grandTotal: { $ifNull: ["$grandTotal", 0] },
          paidAmount: { $ifNull: ["$paidAmount", 0] }
        }
      },

      // Cleanup: remove `rawItems`, `foodItems`, `comboItems` if needed
      {
        $project: {
          rawItems: 0,
          foodItems: 0,
          comboItems: 0
        }
      }
    ]);

    if (!order.length) {
      return res.status(404).json({ message: "Order not found" });
    }

    return res.status(200).json(order[0]);
  } catch (error) {
    next(error);
  }
};



export const getCancelledOrders = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found" });

    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const {
      fromDate,
      toDate,
      customerTypeId,
      search,
      minPrice,
      maxPrice
    } = req.query;

    const matchStage = { status: "Cancelled" };

    // 🗓️ Date filter
    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    // 👤 Customer Type filter
    if (customerTypeId) {
      matchStage.customerTypeId = new mongoose.Types.ObjectId(customerTypeId);
    }

    // 💰 Min/Max price filter
    const priceFilter = {};
    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    if (!isNaN(min)) priceFilter.$gte = min;
    if (!isNaN(max)) priceFilter.$lte = max;
    if (Object.keys(priceFilter).length > 0) {
      matchStage.totalAmount = priceFilter;
    }

    const pipeline = [
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "customertypes",
          localField: "customerTypeId",
          foreignField: "_id",
          as: "customerType"
        }
      },
      {
        $unwind: { path: "$customerType", preserveNullAndEmptyArrays: true }
      },
      {
        $lookup: {
          from: "tables",
          localField: "tableId",
          foreignField: "_id",
          as: "table"
        }
      },
      {
        $unwind: { path: "$table", preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          _id: 1,
          order_id: 1,
          orderNo: 1,
          ticketNo: 1,
          orderType: 1,
          customerType: "$customerType.type",
          table: "$table.name",
          status: 1,
          subTotal: 1,
          discount: 1,
          vat: 1,
          totalAmount: 1,
          items: 1,
          createdAt: 1
        }
      }
    ];

    // 🔍 Search stage
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { order_id: { $regex: search, $options: "i" } },
            { orderNo: { $regex: search, $options: "i" } },
            { ticketNo: { $regex: search, $options: "i" } },
            { customerType: { $regex: search, $options: "i" } },
            { table: { $regex: search, $options: "i" } }
          ]
        }
      });
    }

    const result = await ORDER.aggregate(pipeline);

    // 📊 Count for pagination
    const countPipeline = [{ $match: matchStage }, { $count: "total" }];
    const countResult = await ORDER.aggregate(countPipeline);
    const totalCount = countResult[0]?.total || 0;

    return res.json({
      page,
      limit,
      totalCount,
      data: result
    });

  } catch (error) {
    next(error);
  }
};




//pdf

export const generateOrderSummaryPDF = async (req, res, next) => {
  try {
    const {
      fromDate,
      toDate,
      customerTypeId,
      paymentMethod,
      status,
      search,
      minPrice,
      maxPrice
    } = req.query;

    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found" });

    const restaurant = await RESTAURANT.findOne();
    const currency = restaurant?.currency || 'AED';

    const matchStage = {};

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }
    if (customerTypeId) {
      matchStage.customerTypeId = new mongoose.Types.ObjectId(customerTypeId);
    }
    if (status) {
      matchStage.status = status;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "paymentrecords",
          localField: "_id",
          foreignField: "orderId",
          as: "paymentInfo"
        }
      },
      { $unwind: { path: "$paymentInfo", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$paymentInfo.methods", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "accounts",
          localField: "paymentInfo.methods.accountId",
          foreignField: "_id",
          as: "account"
        }
      },
      { $unwind: { path: "$account", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "tables",
          localField: "tableId",
          foreignField: "_id",
          as: "table"
        }
      },
      { $unwind: { path: "$table", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "customertypes",
          localField: "customerTypeId",
          foreignField: "_id",
          as: "customerType"
        }
      },
      { $unwind: { path: "$customerType", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer"
        }
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } }
    ];

    if (paymentMethod) {
      pipeline.push({
        $match: {
          "account.accountName": paymentMethod
        }
      });
    }

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { orderNo: { $regex: search, $options: "i" } },
            { order_id: { $regex: search, $options: "i" } },
            { ticketNo: { $regex: search, $options: "i" } },
            { "table.name": { $regex: search, $options: "i" } },
            { "customer.name": { $regex: search, $options: "i" } },
            { "customerType.type": { $regex: search, $options: "i" } },
            { "account.accountName": { $regex: search, $options: "i" } }
          ]
        }
      });
    }

    pipeline.push(
      {
        $group: {
          _id: "$_id",
          order_id: { $first: "$order_id" },
          orderNo: { $first: "$orderNo" },
          customer: { $first: "$customer.name" },
          ticketNo: { $first: "$ticketNo" },
          table: { $first: "$table.name" },
          customerType: { $first: "$customerType.type" },
          discount: { $first: "$discount" },
          amount: { $first: "$paymentInfo.grandTotal" },
          status: { $first: "$status" },
          createdAt: { $first: "$createdAt" },
          paymentMethods: {
            $push: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$paymentInfo.methods.amount", null] },
                    { $ne: ["$account.accountName", null] }
                  ]
                },
                {
                  type: "$account.accountName",
                  amount: "$paymentInfo.methods.amount"
                },
                "$$REMOVE"
              ]
            }
          }
        }
      },
      {
        $addFields: {
          amount: { $ifNull: ["$amount", 0] }
        }
      }
    );

    // 💰 minPrice/maxPrice filter
    const priceFilter = {};
    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    if (!isNaN(min)) priceFilter.$gte = min;
    if (!isNaN(max)) priceFilter.$lte = max;
    if (Object.keys(priceFilter).length > 0) {
      pipeline.push({ $match: { amount: priceFilter } });
    }

    pipeline.push({ $sort: { createdAt: -1 } });

    const result = await ORDER.aggregate(pipeline);

    const customerType = customerTypeId
      ? (await CUSTOMER_TYPE.findById(customerTypeId).lean())?.type
      : null;

    const pdfBuffer = await generatePDF("orderSummaryTemp", {
      data: result,
      currency,
      filters: {
        fromDate,
        toDate,
        paymentMethod,
        customerType,
        status,
        search,
        minPrice,
        maxPrice
      }
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Order-Summary-${Date.now()}.pdf"`
    });

    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};


export const generateCancelledOrdersPDF = async (req, res, next) => {
  try {
    const {
      fromDate,
      toDate,
      customerTypeId,
      search = '',
      minPrice,
      maxPrice
    } = req.query;

    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found" });

    const restaurant = await RESTAURANT.findOne({});
    const currency = restaurant?.currency || 'AED';

    const matchStage = { status: "Cancelled" };

    // 📅 Date Range Filter
    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    // 👤 Customer Type Filter
    if (customerTypeId) {
      matchStage.customerTypeId = new mongoose.Types.ObjectId(customerTypeId);
    }

    // 💰 Min/Max Price Filter
    const priceFilter = {};
    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    if (!isNaN(min)) priceFilter.$gte = min;
    if (!isNaN(max)) priceFilter.$lte = max;
    if (Object.keys(priceFilter).length > 0) {
      matchStage.totalAmount = priceFilter;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "customertypes",
          localField: "customerTypeId",
          foreignField: "_id",
          as: "customerType"
        }
      },
      { $unwind: { path: "$customerType", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          order_id: 1,
          orderNo: 1,
          createdAt: 1,
          customerType: "$customerType.type",
          totalAmount: 1,
          kot: "$ticketNo"
        }
      },
      {
        $addFields: {
          createdDate: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          }
        }
      },
      {
        $match: {
          $or: [
            { order_id: { $regex: search, $options: "i" } },
            { orderNo: { $regex: search, $options: "i" } },
            { kot: { $regex: search, $options: "i" } },
            { customerType: { $regex: search, $options: "i" } },
          ]
        }
      },
      { $sort: { createdAt: -1 } }
    ];

    const result = await ORDER.aggregate(pipeline);

    const pdfBuffer = await generatePDF("cancelledOrdersTemp", {
      data: result,
      currency,
      filters: {
        fromDate: fromDate ? new Date(fromDate).toLocaleDateString() : null,
        toDate: toDate ? new Date(toDate).toLocaleDateString() : null,
        search,
        minPrice,
        maxPrice
      },
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Cancelled-orders-report-${Date.now()}.pdf"`
    });

    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};


//excel
export const orderSummaryExcel= async (req, res, next) => {
  try {
    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found" });

    const {
      fromDate,
      toDate,
      customerTypeId,
      paymentMethod,
      status,
      search,
      minPrice,
      maxPrice,
    } = req.query;

    const matchStage = {};

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    if (customerTypeId) {
      matchStage.customerTypeId = new mongoose.Types.ObjectId(customerTypeId);
    }

    if (status) {
      matchStage.status = status;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "paymentrecords",
          localField: "_id",
          foreignField: "orderId",
          as: "paymentInfo",
        },
      },
      { $unwind: { path: "$paymentInfo", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$paymentInfo.methods", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "accounts",
          localField: "paymentInfo.methods.accountId",
          foreignField: "_id",
          as: "account",
        },
      },
      { $unwind: { path: "$account", preserveNullAndEmptyArrays: true } },
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
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          order_id_str: { $toString: "$order_id" },
        },
      },
    ];

    if (paymentMethod) {
      pipeline.push({ $match: { "account.accountName": paymentMethod } });
    }

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { orderNo: { $regex: search, $options: "i" } },
            { order_id_str: { $regex: search, $options: "i" } },
            { ticketNo: { $regex: search, $options: "i" } },
            { "customer.name": { $regex: search, $options: "i" } },
            { "customerType.type": { $regex: search, $options: "i" } },
            { "account.accountName": { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    pipeline.push({
      $group: {
        _id: "$_id",
        date: { $first: "$createdAt" },
        orderId: { $first: "$order_id" },
        kot: { $first: "$ticketNo" },
        customer: { $first: "$customer.name" },
        customerType: { $first: "$customerType.type" },
        discount: { $first: "$discount" },
        amount: { $first: "$paymentInfo.grandTotal" },
        status: { $first: "$status" },
        paymentMethods: {
          $push: {
            $cond: [
              {
                $and: [
                  { $ne: ["$paymentInfo.methods.amount", null] },
                  { $ne: ["$account.accountName", null] },
                ],
              },
              {
                type: "$account.accountName",
                amount: "$paymentInfo.methods.amount",
              },
              "$$REMOVE",
            ],
          },
        },
      },
    });

    const priceFilter = {};
    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    if (!isNaN(min)) priceFilter.$gte = min;
    if (!isNaN(max)) priceFilter.$lte = max;
    if (Object.keys(priceFilter).length) {
      pipeline.push({ $match: { amount: priceFilter } });
    }

    pipeline.push({ $sort: { date: -1 } });

    const data = await ORDER.aggregate(pipeline);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Order Summary");
 worksheet.mergeCells('A1:I1');
const titleRow = worksheet.getCell('A1');
titleRow.value = 'Order Summary';
titleRow.font = { size: 16, bold: true };
titleRow.alignment = { vertical: 'middle', horizontal: 'center' };

worksheet.addRow([]);

// 👉 Filter summary row
const filters = [];
if (fromDate && toDate) {
  filters.push(`Date: ${fromDate} to ${toDate}`);
}
if (customerTypeId) {
  filters.push(`Customer Type ID: ${customerTypeId}`);
}
if (status) {
  filters.push(`Status: ${status}`);
}
if (paymentMethod) {
  filters.push(`Payment Method: ${paymentMethod}`);
}
if (minPrice || maxPrice) {
  filters.push(`Amount: ${minPrice || 0} to ${maxPrice || '∞'}`);
}
if (search) {
  filters.push(`Search: ${search}`);
}

if (filters.length > 0) {
  const filterRow = worksheet.addRow(filters);
  filterRow.eachCell(cell => {
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  worksheet.addRow([]);
}

// Add column headings manually
const headerRow = worksheet.addRow([
  "Date", "Order ID", "KOT", "Customer", "Customer Type", "Payment Methods", "Discount","Amount","Status"
]);

headerRow.eachCell((cell) => {
  cell.font = { bold: true };
});

    worksheet.columns = [
      {key: "date", width: 20 },
      {key: "orderId", width: 30 },
      {key: "kot", width: 15 },
      {key: "customer", width: 25 },
      {key: "customerType", width: 20 },
      {key: "payments", width: 30 },
      { key: "discount", width: 15 },
      { key: "amount", width: 15 },
      { key: "status", width: 15 },
    ];


 data.forEach((order) => {
  const paymentString =
    Array.isArray(order.paymentMethods) && order.paymentMethods.length > 0
      ? order.paymentMethods
          .filter(p => p && p.type && p.amount != null)
          .map(p => `${p.type}: ${p.amount}`)
          .join(", ")
      : "Pending";

  worksheet.addRow([
    new Date(order.date),
    order.orderId || "-",
    order.kot || "-",
    order.customer || "Walk-in",
    order.customerType || "N/A",
    paymentString || "Pending",
    order.discount ?? 0,
    order.amount ?? 0,
    order.status || "-",
  ]);
});

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=OrderSummary.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
};


export const getCancelledOrdersExcel = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found" });

    const {
      fromDate,
      toDate,
      customerTypeId,
      search,
      minPrice,
      maxPrice
    } = req.query;

    const matchStage = { status: "Cancelled" };

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    if (customerTypeId) {
      matchStage.customerTypeId = new mongoose.Types.ObjectId(customerTypeId);
    }

    const priceFilter = {};
    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    if (!isNaN(min)) priceFilter.$gte = min;
    if (!isNaN(max)) priceFilter.$lte = max;
    if (Object.keys(priceFilter).length > 0) {
      matchStage.totalAmount = priceFilter;
    }

    const pipeline = [
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "customertypes",
          localField: "customerTypeId",
          foreignField: "_id",
          as: "customerType"
        }
      },
      { $unwind: { path: "$customerType", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "tables",
          localField: "tableId",
          foreignField: "_id",
          as: "table"
        }
      },
      { $unwind: { path: "$table", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          order_id: 1,
          ticketNo: 1,
          customerType: "$customerType.type",
          tableName: "$table.name",
          totalAmount: 1,
          createdAt: 1
        }
      }
    ];

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { order_id: { $regex: search, $options: "i" } },
            { ticketNo: { $regex: search, $options: "i" } },
            { customerType: { $regex: search, $options: "i" } },
            { tableName: { $regex: search, $options: "i" } }
          ]
        }
      });
    }

    const data = await ORDER.aggregate(pipeline);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Cancelled Orders");

    // Heading
  worksheet.mergeCells('A1:E1');
const titleRow = worksheet.getCell('A1');
titleRow.value = 'Cancelled Orders';
titleRow.font = { size: 16, bold: true };
titleRow.alignment = { vertical: 'middle', horizontal: 'center' };

// Constructing filter info row
const filters = [];

if (fromDate && toDate) {
  filters.push(`Date: ${fromDate} to ${toDate}`);
}
if (customerTypeId) {
  const customerTypeDoc = await CUSTOMER_TYPE.findById(customerTypeId);
  if (customerTypeDoc) {
    filters.push(`Customer Type: ${customerTypeDoc.type}`);
  }
}
if (!isNaN(min)) {
  filters.push(`Min Amount: ${min}`);
}
if (!isNaN(max)) {
  filters.push(`Max Amount: ${max}`);
}
if (search) {
  filters.push(`Search: ${search}`);
}

// Insert filter info as the second row (below title)
if (filters.length > 0) {
  const filterText = filters.join(" | ");
  worksheet.mergeCells('A2:E2');
  const filterRow = worksheet.getCell('A2');
  filterRow.value = filterText;
  filterRow.font = {  size: 12 ,bold:true};
  filterRow.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.addRow([]);
} else {
  worksheet.addRow([]); // Maintain spacing if no filters
}


    // Column Headings
    const headerRow = worksheet.addRow([
      "Date", "Order Id", "Customer Type", "Amount", "KOT"
    ]);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
    });

    worksheet.columns = [
      { key: "date", width: 20 },
      { key: "orderId", width: 30 },
      { key: "customerType", width: 30 },
      { key: "amount", width: 15 },
      { key: "kot", width: 15 },
    ];

    // Data Rows
    data.forEach((order) => {
      const customerTypeWithTable = order.customerType
        ? `${order.customerType}${order.tableName ? ` (${order.tableName})` : ""}`
        : "N/A";

      worksheet.addRow({
        date: new Date(order.createdAt),
        orderId: order.order_id || "-",
        customerType: customerTypeWithTable,
        amount: order.totalAmount ?? 0,
        kot: order.ticketNo || "-",
      });
    });

    // Send file
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=CancelledOrders.xlsx");
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    next(err);
  }
};

