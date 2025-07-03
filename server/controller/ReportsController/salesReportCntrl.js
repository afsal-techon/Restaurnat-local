import mongoose from "mongoose";
import USER from '../../model/userModel.js';
import ORDER from '../../model/oreder.js';
import PAYMENT from '../../model/paymentRecord.js'
import { generatePDF } from '../../config/pdfGeneration.js'
import RESTAURANT from '../../model/restaurant.js'
import CUSTOMER_TYPE from '../../model/customerTypes.js'






export const getDailySalesReport = async(req,res,next)=>{
    try {

      const userId = req.user;
    const user = await USER.findOne({ _id: userId });
    if (!user) return res.status(400).json({ message: "User not found!" });

    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

     const {
      fromDate,
      toDate,
      customerTypeId,
      paymentMethod,
      search,
    } = req.query;

    const matchStage = { "order.status": "Completed" };

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    if (customerTypeId) {
      matchStage["order.customerTypeId"] = new mongoose.Types.ObjectId(customerTypeId);
    }

    // Common initial pipeline
    const basePipeline = [
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order"
        }
      },
      { $unwind: "$order" },
      { $match: matchStage },
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
      { $unwind: { path: "$table", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$customerType", preserveNullAndEmptyArrays: true } },
      { $unwind: "$methods" },
      {
        $lookup: {
          from: "accounts",
          localField: "methods.accountId",
          foreignField: "_id",
          as: "account"
        }
      },
      { $unwind: { path: "$account", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$_id",
          orderNo: { $first: "$order.orderNo" },
          orderId: { $first: "$order.order_id" },
          customer: { $first: "$order.customerId.name" },
          table: { $first: "$table.name" },
          customerType: { $first: "$customerType.type" },
          discount: { $first: "$order.discount" },
          amount: { $first: "$grandTotal" },
          date: { $first: "$createdAt" },
          paymentMethods: {
            $push: {
              type: "$account.accountName",
              amount: "$methods.amount"
            }
          },
          dueAmount: { $first: "$dueAmount" },
        
        }
      }
    ];

    if (paymentMethod) {
      basePipeline.push({
        $match: {
          paymentMethods: {
            $elemMatch: { type: paymentMethod }
          }
        }
      });
    }

    if (search) {
      basePipeline.push({
        $match: {
          $or: [
            { orderNo: { $regex: search, $options: "i" } },
            { orderId: { $regex: search, $options: "i" } },
            { customerType: { $regex: search, $options: "i" } },
            { table: { $regex: search, $options: "i" } },
            { "paymentMethods.type": { $regex: search, $options: "i" } },
           
          ]
        }
      });
    }

    // Make full data pipeline
    const dataPipeline = [...basePipeline,
      { $sort: { date: -1 } },
      { $skip: skip },
      { $limit: limit }
    ];

    const [data, countResult] = await Promise.all([
      PAYMENT.aggregate(dataPipeline),
      PAYMENT.aggregate([...basePipeline, { $count: "total" }])
    ]);

    const totalCount = countResult[0]?.total || 0;

    return res.status(200).json({
      page,
      limit,
      totalCount,
      data
    });

        
    } catch (err) {
        next(err)
    }
}



export const getCategoryWiseSalesReport = async (req, res, next) => {
  try {
    const user = await USER.findOne({ _id: req.user });
    if (!user) {
      return res.status(400).json({ message: "User not found!" });
    }

    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || "";

    const data = await ORDER.aggregate([
      { $match: { status: "Completed" } },
      { $unwind: "$items" },
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
            { $unwind: "$items.items" },
            {
              $addFields: {
                "items.items.computedQty": {
                  $multiply: ["$items.items.qty", "$items.qty"]
                },
                "items.items.computedTotal": {
                  $multiply: ["$items.items.price", "$items.qty"]
                }
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
                totalQty: { $sum: "$items.items.computedQty" },
                totalSales: { $sum: "$items.items.computedTotal" },
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
          all: { $concatArrays: ["$directFood", "$comboFood"] },
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
      {
        $match: {
          categoryName: { $regex: search, $options: "i" },
        },
      },
      { $sort: { totalSales: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: "count" }],
        },
      },
      {
        $project: {
          data: 1,
          totalCount: { $arrayElemAt: ["$totalCount.count", 0] },
        },
      },
    ]);

    const response = {
      data: data[0]?.data || [],
      totalCount: data[0]?.totalCount || 0,
      page,
      limit,
    };

    return res.status(200).json(response);

  } catch (error) {
    next(error);
  }
};


export const getItemWiseSalesReport = async (req, res, next) => {
  try {
    const userId = req.user;
    const user = await USER.findById(userId);
    if (!user) return res.status(400).json({ message: "User not found" });  

        const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || "";

    const data = await ORDER.aggregate([
      {
        $match: { status: "Completed" }
      },
      { $unwind: "$items" },
      {
        $facet: {
          directItems: [
            { $match: { "items.isCombo": false } },
            {
              $lookup: {
                from: "foods",
                localField: "items.foodId",
                foreignField: "_id",
                as: "foodInfo"
              }
            },
            { $unwind: "$foodInfo" },
            {
              $lookup: {
                from: "categories",
                localField: "foodInfo.categoryId",
                foreignField: "_id",
                as: "categoryInfo"
              }
            },
            { $unwind: "$categoryInfo" },
            {
              $group: {
                _id: {
                  itemId: "$items.foodId",
                  orderId: "$_id"
                },
                itemName: { $first: "$items.foodName" },
                category: { $first: "$categoryInfo.name" },
                qty: { $sum: "$items.qty" },
                total: { $sum: "$items.total" }
              }
            },
            {
              $group: {
                _id: "$_id.itemId",
                itemName: { $first: "$itemName" },
                category: { $first: "$category" },
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
              $addFields: {
                "items.items.computedQty": {
                  $multiply: ["$items.items.qty", "$items.qty"]
                },
                "items.items.computedTotal": {
                  $multiply: ["$items.items.price", "$items.qty"]
                }
              }
            },
            {
              $lookup: {
                from: "foods",
                localField: "items.items.foodId",
                foreignField: "_id",
                as: "foodInfo"
              }
            },
            { $unwind: "$foodInfo" },
            {
              $lookup: {
                from: "categories",
                localField: "foodInfo.categoryId",
                foreignField: "_id",
                as: "categoryInfo"
              }
            },
            { $unwind: "$categoryInfo" },
            {
              $group: {
                _id: {
                  itemId: "$items.items.foodId",
                  orderId: "$_id"
                },
                itemName: { $first: "$items.items.foodName" },
                category: { $first: "$categoryInfo.name" },
                qty: { $sum: "$items.items.computedQty" },
                total: { $sum: "$items.items.computedTotal" }
              }
            },
            {
              $group: {
                _id: "$_id.itemId",
                itemName: { $first: "$itemName" },
                category: { $first: "$category" },
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

      // Search filter (case-insensitive)
      ...(search
        ? [{
            $match: {
              $or: [
                { "all.itemName": { $regex: search, $options: "i" } },
                { "all.category": { $regex: search, $options: "i" } }
              ]
            }
          }]
        : []),

      {
        $group: {
          _id: "$all._id",
          itemName: { $first: "$all.itemName" },
          category: { $first: "$all.category" },
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


export const getCustomerTypeWiseSalesReport = async (req, res, next) => {
  try {
    const userId = req.user;
    const user = await USER.findById(userId);
    if (!user) return res.status(400).json({ message: "User not found" });

   const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    const pipeline = [
      { $match: { status: "Completed" } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "customertypes",
          localField: "customerTypeId",
          foreignField: "_id",
          as: "customerType"
        }
      },
      { $unwind: "$customerType" },
      {
        $group: {
          _id: {
            customerTypeId: "$customerType._id",
            orderId: "$_id"
          },
          customerType: { $first: "$customerType.type" },
          totalQty: { $sum: "$items.qty" },
          totalSales: { $sum: "$items.total" }
        }
      },
      {
        $group: {
          _id: "$_id.customerTypeId",
          customerType: { $first: "$customerType" },
          totalQty: { $sum: "$totalQty" },
          totalSales: { $sum: "$totalSales" },
          orderIds: { $addToSet: "$_id.orderId" }
        }
      },
      {
        $addFields: {
          orderCount: { $size: "$orderIds" }
        }
      }
    ];

    // 🔍 Add search if provided
    if (search) {
      pipeline.push({
        $match: {
          customerType: { $regex: search, $options: "i" }
        }
      });
    }

    pipeline.push(
      {
        $project: {
          _id: 0,
          customerType: 1,
          totalQty: 1,
          totalSales: 1,
          orderCount: 1
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
    );

    const result = await ORDER.aggregate(pipeline);

    const response = {
      data: result[0]?.data || [],
      totalCount: result[0]?.totalCount || 0,
      page,
      limit
    };

    return res.status(200).json(response);

  } catch (err) {
    next(err);
  }
};





//pdf section
export const generateDailySalesPDF = async(req,res,next)=>{
  try {

        const {
      fromDate,
      toDate,
      customerTypeId,
      paymentMethod,
      search
    } = req.query;

    

        const userId = req.user;
    const user = await USER.findById(userId).lean();
    if (!user) return res.status(400).json({ message: "User not found" });

    const restaurnat = await RESTAURANT.findOne();
    const currency = restaurnat.currency || 'AED'

        const matchStage = { "order.status": "Completed" };

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      matchStage.createdAt = { $gte: start, $lte: end };
    }

    if (customerTypeId) {
      matchStage["order.customerTypeId"] = new mongoose.Types.ObjectId(customerTypeId);
    }

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
      { $match: matchStage },
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
      { $unwind: { path: "$table", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$customerType", preserveNullAndEmptyArrays: true } },
      { $unwind: "$methods" },
      {
        $lookup: {
          from: "accounts",
          localField: "methods.accountId",
          foreignField: "_id",
          as: "account"
        }
      },
      { $unwind: { path: "$account", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$_id",
          orderNo: { $first: "$order.orderNo" },
          orderId: { $first: "$order.order_id" },
          customer: { $first: "$order.customerId.name" },
          table: { $first: "$table.name" },
          customerType: { $first: "$customerType.type" },
          discount: { $first: "$order.discount" },
          amount: { $first: "$grandTotal" },
          date: { $first: "$createdAt" },
          paymentMethods: {
            $push: {
              type: "$account.accountName",
              amount: "$methods.amount"
            }
          },
          dueAmount: { $first: "$dueAmount" },
         
        }
      }
    ];

    if (paymentMethod) {
      pipeline.push({
        $match: {
          paymentMethods: {
            $elemMatch: { type: paymentMethod }
          }
        }
      });
    }

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { orderNo: { $regex: search, $options: "i" } },
            { orderId: { $regex: search, $options: "i" } },
            { customerType: { $regex: search, $options: "i" } },
            { table: { $regex: search, $options: "i" } },
            { "paymentMethods.type": { $regex: search, $options: "i" } },
           
          ]
        }
      });
    }

    let customerType = null;

    if (customerTypeId) {
  const typeDoc = await CUSTOMER_TYPE.findById(customerTypeId).lean();
  customerType = typeDoc?.type || null;
}

    const result = await PAYMENT.aggregate(pipeline);

    
    // Pass data to EJS template
      const pdfBuffer = await generatePDF("dailySaleTemp", {
      data: result,
      currency,
      filters: { fromDate, toDate, paymentMethod, customerType, search }
    });

        res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Daily-sales-report-${Date.now()}.pdf"`,
    });

    return res.send(pdfBuffer);
    
  } catch (err) {
    next(err)
  }
}

export const generateCategorySalesPDF = async(req,res,next)=>{
  try {

     const {  search = '' } = req.query;
    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: 'User not found' });

    
    const restaurant = await RESTAURANT.findOne()
    const currency = restaurant?.currency || 'AED';


    const pipeline = [
      { $match: { status: "Completed" } },
      { $unwind: "$items" },
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
            { $unwind: "$items.items" },
            {
              $addFields: {
                "items.items.computedQty": {
                  $multiply: ["$items.items.qty", "$items.qty"]
                },
                "items.items.computedTotal": {
                  $multiply: ["$items.items.price", "$items.qty"]
                }
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
                totalQty: { $sum: "$items.items.computedQty" },
                totalSales: { $sum: "$items.items.computedTotal" },
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
          all: { $concatArrays: ["$directFood", "$comboFood"] },
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
      {
        $match: {
          categoryName: { $regex: search, $options: "i" },
        },
      },
      { $sort: { totalSales: -1 } },
    ];

    const result = await ORDER.aggregate(pipeline);

    const pdfBuffer = await generatePDF("categorySalesTemp", {
      data: result,
      currency,
      filters: { search },
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Category-sales-report-${Date.now()}.pdf"`,
    });

    return res.send(pdfBuffer);

    
  } catch (err) {
    next(err)
  }
}

export const generateItemWiseSalesPDF = async (req, res, next) => {
  try {
    const { search = "" } = req.query;
    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found" });

    const restaurant = await RESTAURANT.findOne({ });
    const currency = restaurant?.currency || "AED";

    const pipeline = [
      { $match: { status: "Completed" } },
      { $unwind: "$items" },
      {
        $facet: {
          directItems: [
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
                  itemId: "$items.foodId",
                  orderId: "$_id",
                },
                itemName: { $first: "$items.foodName" },
                category: { $first: "$categoryInfo.name" },
                qty: { $sum: "$items.qty" },
                total: { $sum: "$items.total" },
              },
            },
            {
              $group: {
                _id: "$_id.itemId",
                itemName: { $first: "$itemName" },
                category: { $first: "$category" },
                totalQty: { $sum: "$qty" },
                totalSales: { $sum: "$total" },
                orderIds: { $addToSet: "$_id.orderId" },
              },
            },
            {
              $addFields: {
                orderCount: { $size: "$orderIds" },
              },
            },
          ],
          comboItems: [
            { $match: { "items.isCombo": true } },
            { $unwind: "$items.items" },
            {
              $addFields: {
                "items.items.computedQty": {
                  $multiply: ["$items.items.qty", "$items.qty"],
                },
                "items.items.computedTotal": {
                  $multiply: ["$items.items.price", "$items.qty"],
                },
              },
            },
            {
              $lookup: {
                from: "foods",
                localField: "items.items.foodId",
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
                  itemId: "$items.items.foodId",
                  orderId: "$_id",
                },
                itemName: { $first: "$items.items.foodName" },
                category: { $first: "$categoryInfo.name" },
                qty: { $sum: "$items.items.computedQty" },
                total: { $sum: "$items.items.computedTotal" },
              },
            },
            {
              $group: {
                _id: "$_id.itemId",
                itemName: { $first: "$itemName" },
                category: { $first: "$category" },
                totalQty: { $sum: "$qty" },
                totalSales: { $sum: "$total" },
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
          all: { $concatArrays: ["$directItems", "$comboItems"] },
        },
      },
      { $unwind: "$all" },

      ...(search
        ? [
            {
              $match: {
                $or: [
                  { "all.itemName": { $regex: search, $options: "i" } },
                  { "all.category": { $regex: search, $options: "i" } },
                ],
              },
            },
          ]
        : []),

      {
        $group: {
          _id: "$all._id",
          itemName: { $first: "$all.itemName" },
          category: { $first: "$all.category" },
          totalQty: { $sum: "$all.totalQty" },
          totalSales: { $sum: "$all.totalSales" },
          totalOrders: { $sum: "$all.orderCount" },
        },
      },
      { $sort: { totalSales: -1 } },
    ];

    const result = await ORDER.aggregate(pipeline);

    const pdfBuffer = await generatePDF("itemSalesTemp", {
      data: result,
      currency,
      filters: { search },
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Item-sales-report-${Date.now()}.pdf"`,
    });

    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};


export const generateCustomerTypeWisePDF = async(req,res,next)=>{
  try {

       const { search = "" } = req.query;
    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found" });

    const restaurant = await RESTAURANT.findOne({ });
    const currency = restaurant?.currency || "AED";

    const pipeline = [
      { $match: { status: "Completed" } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "customertypes",
          localField: "customerTypeId",
          foreignField: "_id",
          as: "customerType"
        }
      },
      { $unwind: "$customerType" },
      {
        $group: {
          _id: {
            customerTypeId: "$customerType._id",
            orderId: "$_id"
          },
          customerType: { $first: "$customerType.type" },
          totalQty: { $sum: "$items.qty" },
          totalSales: { $sum: "$items.total" }
        }
      },
      {
        $group: {
          _id: "$_id.customerTypeId",
          customerType: { $first: "$customerType" },
          totalQty: { $sum: "$totalQty" },
          totalSales: { $sum: "$totalSales" },
          orderIds: { $addToSet: "$_id.orderId" }
        }
      },
      {
        $addFields: {
          orderCount: { $size: "$orderIds" }
        }
      },
      ...(search
        ? [{
            $match: {
              customerType: { $regex: search, $options: "i" }
            }
          }]
        : []),
      {
        $sort: { totalSales: -1 }
      },
      {
        $project: {
          customerType: 1,
          totalQty: 1,
          totalSales: 1,
          orderCount: 1
        }
      }
    ];

    const result = await ORDER.aggregate(pipeline);

    const pdfBuffer = await generatePDF("customerTypeSalesTemp", {
      data: result,
      currency,
      filters: { search }
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="CustomerType-sales-report-${Date.now()}.pdf"`,
    });

    return res.send(pdfBuffer);


    
  } catch (err) {
    next(err)
  }
}
