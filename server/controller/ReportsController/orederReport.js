import mongoose from "mongoose";
import USER from '../../model/userModel.js';
import ORDER from '../../model/oreder.js';
import PAYMENT from '../../model/paymentRecord.js'



export const getALLOrderSummary = async(req,res,next)=>{
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
      search
    } = req.query;

    const matchStage = {};

    //  Date range filter
    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    // 👥 Customer type filter
    if (customerTypeId) {
      matchStage.customerTypeId = new mongoose.Types.ObjectId(customerTypeId);
    }

    //  Order status filter
    if (status) {
      matchStage.status = status;
    }

    const pipeline = [
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },

      // Payment Records
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

      // Account lookup for payment methods
      {
        $lookup: {
          from: "accounts",
          localField: "paymentInfo.methods.accountId",
          foreignField: "_id",
          as: "account"
        }
      },
      { $unwind: { path: "$account", preserveNullAndEmptyArrays: true } },

      // Table lookup
      {
        $lookup: {
          from: "tables",
          localField: "tableId",
          foreignField: "_id",
          as: "table"
        }
      },
      { $unwind: { path: "$table", preserveNullAndEmptyArrays: true } },

      // Customer type lookup
      {
        $lookup: {
          from: "customertypes",
          localField: "customerTypeId",
          foreignField: "_id",
          as: "customerType"
        }
      },
      { $unwind: { path: "$customerType", preserveNullAndEmptyArrays: true } },

      // Customer lookup
      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer"
        }
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
    ];

    //  Payment method filter
    if (paymentMethod) {
      pipeline.push({
        $match: {
          "account.accountName": paymentMethod
        }
      });
    }

    //  Search filter
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
            { "account.accountName": { $regex: search, $options: "i" } },
            { createdBy: { $regex: search, $options: "i" } }
          ]
        }
      });
    }

    // Grouping + Cleanup
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
          createdBy: { $first: "$createdBy" },
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
          grandTotal: { $ifNull: ["$grandTotal", 0] },
          paidAmount: { $ifNull: ["$paidAmount", 0] }
        }
      },
      { $sort: { createdAt: -1 } }
    );

    const result = await ORDER.aggregate(pipeline);

    const totalCountMatch = {};

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      totalCountMatch.createdAt = { $gte: start, $lte: end };
    }

    if (customerTypeId) {
      totalCountMatch.customerTypeId = new mongoose.Types.ObjectId(customerTypeId);
    }

    if (status) {
      totalCountMatch.status = status;
    }

    const totalCount = await ORDER.countDocuments(totalCountMatch);

    res.json({
      page,
      limit,
      totalCount,
      data: result
    });
    
  } catch (err) {
    next(err)
  }
}


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
          createdBy: { $first: "$createdBy" },
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
      search
    } = req.query;



    // Build match stage
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
          createdBy: 1,
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

    // Add search stage
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { order_id: { $regex: search, $options: "i" } },
            { orderNo: { $regex: search, $options: "i" } },
            { ticketNo: { $regex: search, $options: "i" } },
            { customerType: { $regex: search, $options: "i" } },
            { table: { $regex: search, $options: "i" } },
            { createdBy: { $regex: search, $options: "i" } }
          ]
        }
      });
    }

    const result = await ORDER.aggregate(pipeline);

    // Count based on match stage (filtered)
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