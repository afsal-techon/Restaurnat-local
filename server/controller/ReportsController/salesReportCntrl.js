import mongoose from "mongoose";
import USER from '../../model/userModel.js';
import RESTAURANT from '../../model/restaurant.js'
import CATEGORY from '../../model/category.js'
import FOOD from '../../model/food.js'
import CUSTOMER_TYPE from '../../model/customerTypes.js';
import ORDER from '../../model/oreder.js';
import COMBO from '../../model/combo.js'
import CUSTOMER from '../../model/customer.js';
import PAYMENT from '../../model/paymentRecord.js'
import { getIO  } from "../../config/socket.js";
import ACCOUNTS from '../../model/account.js'





export const getDailySalesReport = async(req,res,next)=>{
    try {

        const userId = req.user;
        const user = await USER.findOne({ _id: userId, });
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;


       const pipeline = [
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order"
        }
      },
      { $unwind: "$order" },
      { $match: { "order.status": "Completed" } },
      {
        $lookup: {
          from: "tables",
          localField: "order.tableId",
          foreignField: "_id",
          as: "table"
        }
      },
      {
        $lookup: {
          from: "customertypes",
          localField: "order.customerTypeId",
          foreignField: "_id",
          as: "customerType"
        }
      },
      {
        $unwind: { path: "$table", preserveNullAndEmptyArrays: true }
      },
      {
        $unwind: { path: "$customerType", preserveNullAndEmptyArrays: true }
      },
      {
        $unwind: "$methods"
      },
      {
        $lookup: {
          from: "accounts",
          localField: "methods.accountId",
          foreignField: "_id",
          as: "account"
        }
      },
      {
        $unwind: { path: "$account", preserveNullAndEmptyArrays: true }
      },
      {
        $group: {
          _id: "$_id",
          orderNo: { $first: "$order.orderNo" },
          orderId: { $first: "$order.order_id" },
          customer:{$first:"$order.customerId.name"},
          table: { $first: "$table.name" },
          customerType: { $first: "$customerType.type" },
          amount: { $first: "$grandTotal" },
          date: { $first: "$createdAt" },
          paymentMethods: {
            $push: {
              type: "$account.accountName",
              amount: "$methods.amount"
            }
          },
          paidAmount: { $first: "$paidAmount" },
          dueAmount: { $first: "$dueAmount" },
          createdBy: { $first: "$createdBy" }
        }
      },
      { $sort: { date: -1 } },
      { $skip: skip },
      { $limit: limit }
    ];

      const data = await PAYMENT.aggregate(pipeline);

         const totalCountPipeline = [
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",


          as: "order"
        }
      },
      { $unwind: "$order" },
      { $match: { "order.status": "Completed" } },
      { $count: "total" }
    ];

        const totalResult = await PAYMENT.aggregate(totalCountPipeline);
    const totalCount = totalResult[0]?.total || 0;

        res.status(200).json({
      page,
      limit,
      totalCount,
      data
    });


        
    } catch (err) {
        next(err)
    }
}


export const getCategoryWiseSalesReport = async(req,res,next)=>{

    try {

        const user = await USER.findOne({ _id: req.user });
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

        const limit = parseInt(req.query.limit) || 10;
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * limit;

         const data = await ORDER.aggregate([
      {
        $match: {
          status: "Completed",
        },
      },
      {
        $unwind: "$items",
      },
      {
        $facet: {
          directFood: [
            { $match: { "items.isCombo": false } },
            {
              $lookup: {
                from: "foods",
                localField: "items.foodId",
                foreignField: "_id",
                as: "foodInfo",
              },
            },
            { $unwind: "$foodInfo" },
            {
              $lookup: {
                from: "categories",
                localField: "foodInfo.categoryId",
                foreignField: "_id",
                as: "categoryInfo",
              },
            },
            { $unwind: "$categoryInfo" },
          {
              $group: {
                _id: {
                  categoryId: "$categoryInfo._id",
                  orderId: "$_id",
                },
                categoryName: { $first: "$categoryInfo.name" },
                totalQty: { $sum: "$items.qty" },
                totalSales: { $sum: "$items.total" },
              },
            },
                    {
              $group: {
                _id: "$_id.categoryId",
                categoryName: { $first: "$categoryName" },
                totalQty: { $sum: "$totalQty" },
                totalSales: { $sum: "$totalSales" },
                orderIds: { $addToSet: "$_id.orderId" },
              },
            },
            {
              $addFields: {
                orderCount: { $size: "$orderIds" },
              },
            },
          ],
          comboFood: [
            { $match: { "items.isCombo": true } },
            {
              $unwind: {
                path: "$items.items", // nested items inside combo
              },
            },
            {
              $lookup: {
                from: "foods",
                localField: "items.items.foodId",
                foreignField: "_id",
                as: "comboFoodInfo",
              },
            },
            { $unwind: "$comboFoodInfo" },
            {
              $lookup: {
                from: "categories",
                localField: "comboFoodInfo.categoryId",
                foreignField: "_id",
                as: "categoryInfo",
              },
            },
            { $unwind: "$categoryInfo" },
            {
              $group: {
                _id: {
                  categoryId: "$categoryInfo._id",
                  orderId: "$_id",
                },
                categoryName: { $first: "$categoryInfo.name" },
                totalQty: { $sum: "$items.items.qty" },
                totalSales: { $sum: "$items.items.total" },
              },
            },
                {
              $group: {
                _id: "$_id.categoryId",
                categoryName: { $first: "$categoryName" },
                totalQty: { $sum: "$totalQty" },
                totalSales: { $sum: "$totalSales" },
                orderIds: { $addToSet: "$_id.orderId" },
              },
            },
            {
              $addFields: {
                orderCount: { $size: "$orderIds" },
              },
            },
          ],
        },
      },
      {
        $project: {
          all: {
            $concatArrays: ["$directFood", "$comboFood"],
          },
        },
      },
      { $unwind: "$all" },
      {
        $group: {
          _id: "$all._id",
          categoryName: { $first: "$all.categoryName" },
          totalQty: { $sum: "$all.totalQty" },
          totalSales: { $sum: "$all.totalSales" },
          totalOrders: { $sum: "$all.orderCount" },
        },
      },
      { $sort: { totalSales: -1 } },

       
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


    ]);

       const response = {
      data: data[0]?.data || [],
      totalCount: data[0]?.totalCount || 0,
      page,
      limit,
    };

    return res.status(200).json(response);
        
    } catch (error) {
        next(err)
    }
}


export const getItemWiseSalesReport = async (req, res, next) => {
  try {
    const userId = req.user;
    const user = await USER.findById(userId);
    if (!user) return res.status(400).json({ message: "User not found" });  

     const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

        const data = await ORDER.aggregate([
      {
        $match: { status: "Completed" }
      },
      {
        $unwind: "$items"
      },
      {
        $facet: {
          directItems: [
            { $match: { "items.isCombo": false } },
            {
              $group: {
                _id: {
                  itemId: "$items.foodId",
                  orderId: "$_id"
                },
                itemName: { $first: "$items.foodName" },
                qty: { $sum: "$items.qty" },
                total: { $sum: "$items.total" }
              }
            },
            {
              $group: {
                _id: "$_id.itemId",
                itemName: { $first: "$itemName" },
                totalQty: { $sum: "$qty" },
                totalSales: { $sum: "$total" },
                orderIds: { $addToSet: "$_id.orderId" }
              }
            },
            {
              $addFields: {
                orderCount: { $size: "$orderIds" }
              }
            }
          ],
          comboItems: [
            { $match: { "items.isCombo": true } },
            { $unwind: "$items.items" },
            {
              $group: {
                _id: {
                  itemId: "$items.items.foodId",
                  orderId: "$_id"
                },
                itemName: { $first: "$items.items.foodName" },
                qty: { $sum: "$items.items.qty" },
                total: { $sum: "$items.items.total" }
              }
            },
            {
              $group: {
                _id: "$_id.itemId",
                itemName: { $first: "$itemName" },
                totalQty: { $sum: "$qty" },
                totalSales: { $sum: "$total" },
                orderIds: { $addToSet: "$_id.orderId" }
              }
            },
            {
              $addFields: {
                orderCount: { $size: "$orderIds" }
              }
            }
          ]
        }
      },
      {
        $project: {
          all: { $concatArrays: ["$directItems", "$comboItems"] }
        }
      },
      { $unwind: "$all" },
      {
        $group: {
          _id: "$all._id",
          itemName: { $first: "$all.itemName" },
          totalQty: { $sum: "$all.totalQty" },
          totalSales: { $sum: "$all.totalSales" },
          orderCount: { $sum: "$all.orderCount" }
        }
      },
      { $sort: { totalSales: -1 } },
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
    ]);

    const response = {
      data: data[0]?.data || [],
      totalCount: data[0]?.totalCount || 0,
      page,
      limit
    };

    return res.status(200).json(response);

  } catch (error) {
      next(err)
  }

}

