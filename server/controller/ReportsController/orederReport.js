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


   
 const result = await ORDER.aggregate([
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

            // Group to consolidate records
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
      // Default fallback for missing values
      {
        $addFields: {
          grandTotal: { $ifNull: ["$grandTotal", 0] },
          paidAmount: { $ifNull: ["$paidAmount", 0] }
        }
      },

      // Final sort
      { $sort: { createdAt: -1 } }
    ]);
    const totalCount = await ORDER.countDocuments({});



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

    const result = await ORDER.aggregate([
      {
        $match: { status: "Cancelled" }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      },
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
    ]);

    const totalCount = await ORDER.countDocuments({ status: "Cancelled" });

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