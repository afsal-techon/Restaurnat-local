import mongoose from "mongoose";
import USER from '../../model/userModel.js';
import ORDER from '../../model/oreder.js';
import PAYMENT from '../../model/paymentRecord.js'
import { generatePDF } from '../../config/pdfGeneration.js'
import RESTAURANT from '../../model/restaurant.js'
import CUSTOMER_TYPE from '../../model/customerTypes.js'
import ExcelJS from 'exceljs';


export const getDailySalesReport = async (req, res, next) => {
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
      minPrice,
      maxPrice
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

    // Common pipeline before price filtering
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
          beforeVat: { $first: "$beforeVat" },
          amount: { $first: "$grandTotal" },
          vatAmount:{ $first: "$vatAmount" },
          date: { $first: "$createdAt" },
          paymentMethods: {
            $push: {
              type: "$account.accountName",
              amount: "$methods.amount"
            }
          },
          dueAmount: { $first: "$dueAmount" }
        }
      }
    ];

    // Filter by price range (after grouping, where amount is available)
    const priceMatch = {};
    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);

    if (!isNaN(min)) priceMatch.amount = { ...priceMatch.amount, $gte: min };
    if (!isNaN(max)) priceMatch.amount = { ...priceMatch.amount, $lte: max };

    if (Object.keys(priceMatch).length) {
      basePipeline.push({ $match: priceMatch });
    }

    // Filter by payment method
    if (paymentMethod) {
      basePipeline.push({
        $match: {
          paymentMethods: {
            $elemMatch: { type: paymentMethod }
          }
        }
      });
    }

    // Search filter
    if (search) {
      basePipeline.push({
        $match: {
          $or: [
            { orderNo: { $regex: search, $options: "i" } },
            { orderId: { $regex: search, $options: "i" } },
            { customerType: { $regex: search, $options: "i" } },
            { table: { $regex: search, $options: "i" } },
            { "paymentMethods.type": { $regex: search, $options: "i" } }
          ]
        }
      });
    }

    // Final pipeline for data and pagination
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

          const totalsPipeline = [
        ...basePipeline,
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$grandTotal" },
            totalVAT: { $sum: "$vatAmount" }
          }
        }
      ];

      const [totalsResult] = await PAYMENT.aggregate(totalsPipeline);
      const totalAmount = totalsResult?.totalAmount || 0;
      const totalVAT = totalsResult?.totalVAT || 0;

    return res.status(200).json({
      page,
      limit,
      totalCount,
      totalAmount,
      totalVAT,
      data
    });

  } catch (err) {
    next(err);
  }
};


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

    const minPrice = parseFloat(req.query.minPrice);
    const maxPrice = parseFloat(req.query.maxPrice);
    console.log(minPrice,'min')
    console.log(maxPrice,'masx')
    const priceFilter = {};

    if (!isNaN(minPrice)) {
      priceFilter.$gte = minPrice;
    }
    if (!isNaN(maxPrice)) {
      priceFilter.$lte = maxPrice;
    }

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

      //  Apply minPrice / maxPrice filter here
      ...(Object.keys(priceFilter).length
        ? [{ $match: { "all.totalSales": priceFilter } }]
        : []),

      //  Final group by category
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

    const min = parseFloat(req.query.minPrice);
    const max = parseFloat(req.query.maxPrice);
    const priceFilter = {};
    if (!isNaN(min)) priceFilter.$gte = min;
    if (!isNaN(max)) priceFilter.$lte = max;

    const data = await ORDER.aggregate([
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

      // ✅ Apply optional min/max totalSales filtering
      ...(Object.keys(priceFilter).length
        ? [{ $match: { "all.totalSales": priceFilter } }]
        : []),

      // ✅ Search filter
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
          orderCount: { $sum: "$all.orderCount" },
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

export const getCustomerTypeWiseSalesReport = async (req, res, next) => {
  try {
    const userId = req.user;
    const user = await USER.findById(userId);
    if (!user) return res.status(400).json({ message: "User not found" });

    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    const min = parseFloat(req.query.minPrice);
    const max = parseFloat(req.query.maxPrice);
    const priceFilter = {};
    if (!isNaN(min)) priceFilter.$gte = min;
    if (!isNaN(max)) priceFilter.$lte = max;

    const pipeline = [
      { $match: { status: "Completed" } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "customertypes",
          localField: "customerTypeId",
          foreignField: "_id",
          as: "customerType",
        },
      },
      { $unwind: "$customerType" },
      {
        $group: {
          _id: {
            customerTypeId: "$customerType._id",
            orderId: "$_id",
          },
          customerType: { $first: "$customerType.type" },
          totalQty: { $sum: "$items.qty" },
          totalSales: { $sum: "$items.total" },
        },
      },
      {
        $group: {
          _id: "$_id.customerTypeId",
          customerType: { $first: "$customerType" },
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

      //  Filter by totalSales using minPrice/maxPrice
      ...(Object.keys(priceFilter).length > 0
        ? [{ $match: { totalSales: priceFilter } }]
        : []),
      //  Search filter
      ...(search
        ? [
            {
              $match: {
                customerType: { $regex: search, $options: "i" },
              },
            },
          ]
        : []),

      {
        $project: {
          _id: 0,
          customerType: 1,
          totalQty: 1,
          totalSales: 1,
          orderCount: 1,
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
    ];

    const result = await ORDER.aggregate(pipeline);

    const response = {
      data: result[0]?.data || [],
      totalCount: result[0]?.totalCount || 0,
      page,
      limit,
    };

    return res.status(200).json(response);
  } catch (err) {
    next(err);
  }
};






//pdf section
export const generateDailySalesPDF = async (req, res, next) => {
  try {
    // 1. Extract query filters
    const {
      fromDate,
      toDate,
      customerTypeId,
      paymentMethod,
      search,
      minPrice,
      maxPrice
    } = req.query;

    // 2. Validate user
    const userId = req.user;
    const user = await USER.findById(userId).lean();
    if (!user) return res.status(400).json({ message: "User not found" });

    // 3. Restaurant & currency
    const restaurant = await RESTAURANT.findOne().lean();
    const currency = restaurant?.currency || 'AED';

    // 4. Base match on completed orders and date range
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

    // 5. Build aggregation pipeline
    const pipeline = [
      // join to orders
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

      // join to tables & customer types
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

      // unwind payment methods
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

      // group back into one record per payment
      {
        $group: {
          _id: "$_id",
          orderNo:      { $first: "$order.orderNo" },
          orderId:      { $first: "$order.order_id" },
          customer:     { $first: "$order.customerId.name" },
          table:        { $first: "$table.name" },
          customerType: { $first: "$customerType.type" },
          discount:     { $first: "$order.discount" },
          amount:       { $first: "$grandTotal" },
          date:         { $first: "$createdAt" },
          paymentMethods: {
            $push: {
              type:   "$account.accountName",
              amount: "$methods.amount"
            }
          },
          dueAmount: { $first: "$dueAmount" }
        }
      }
    ];

    // 6. Price range filtering (post-group)
    const priceMatch = {};
    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    if (!isNaN(min)) priceMatch.amount = { ...priceMatch.amount, $gte: min };
    if (!isNaN(max)) priceMatch.amount = { ...priceMatch.amount, $lte: max };
    if (Object.keys(priceMatch).length) {
      pipeline.push({ $match: priceMatch });
    }

    // 7. Payment method filter
    if (paymentMethod) {
      pipeline.push({
        $match: {
          paymentMethods: { $elemMatch: { type: paymentMethod } }
        }
      });
    }

    // 8. Search across key fields
    if (search) {
      const regex = { $regex: search, $options: "i" };
      pipeline.push({
        $match: {
          $or: [
            { orderNo: regex },
            { orderId: regex },
            { customerType: regex },
            { table: regex },
            { "paymentMethods.type": regex }
          ]
        }
      });
    }

    // 9. Execute aggregation
    const result = await PAYMENT.aggregate(pipeline);

    // 10. Look up readable customer type for header
    let customerTypeLabel = null;
    if (customerTypeId) {
      const typeDoc = await CUSTOMER_TYPE.findById(customerTypeId).lean();
      customerTypeLabel = typeDoc?.type || null;
    }

    // 11. Generate the PDF buffer
    const pdfBuffer = await generatePDF("dailySaleTemp", {
      data: result,
      currency,
      filters: {
        fromDate, toDate, paymentMethod,
        customerType: customerTypeLabel,
        search, minPrice, maxPrice
      }
    });

    // 12. Send PDF as download
    res.set({
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="Daily-sales-report-${Date.now()}.pdf"`
    });
    return res.send(pdfBuffer);

  } catch (err) {
    return next(err);
  }
};

export const generateCategorySalesPDF = async (req, res, next) => {
  try {
    const { search = '', minPrice, maxPrice } = req.query;
    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: 'User not found' });

    const restaurant = await RESTAURANT.findOne();
    const currency = restaurant?.currency || 'AED';

    const priceFilter = {};
    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    if (!isNaN(min)) priceFilter.$gte = min;
    if (!isNaN(max)) priceFilter.$lte = max;

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

      // ✅ Apply minPrice and maxPrice filter if present
      ...(Object.keys(priceFilter).length
        ? [{ $match: { "all.totalSales": priceFilter } }]
        : []),

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
      filters: { search, minPrice, maxPrice },
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Category-sales-report-${Date.now()}.pdf"`,
    });

    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};


export const generateItemWiseSalesPDF = async (req, res, next) => {
  try {
    const { search = "", minPrice, maxPrice } = req.query;
    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found" });

    const restaurant = await RESTAURANT.findOne({});
    const currency = restaurant?.currency || "AED";

    const priceFilter = {};
    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    if (!isNaN(min)) priceFilter.$gte = min;
    if (!isNaN(max)) priceFilter.$lte = max;

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

      ...(Object.keys(priceFilter).length > 0
        ? [{ $match: { "all.totalSales": priceFilter } }]
        : []),

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
      filters: {
        search,
        minPrice: !isNaN(min) ? min : undefined,
        maxPrice: !isNaN(max) ? max : undefined,
      },
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



export const generateCustomerTypeWisePDF = async (req, res, next) => {
  try {
    const { search = "", minPrice, maxPrice } = req.query;

    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found" });

    const restaurant = await RESTAURANT.findOne({});
    const currency = restaurant?.currency || "AED";

    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    const priceFilter = {};
    if (!isNaN(min)) priceFilter.$gte = min;
    if (!isNaN(max)) priceFilter.$lte = max;

    const pipeline = [
      { $match: { status: "Completed" } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "customertypes",
          localField: "customerTypeId",
          foreignField: "_id",
          as: "customerType",
        },
      },
      { $unwind: "$customerType" },
      {
        $group: {
          _id: {
            customerTypeId: "$customerType._id",
            orderId: "$_id",
          },
          customerType: { $first: "$customerType.type" },
          totalQty: { $sum: "$items.qty" },
          totalSales: { $sum: "$items.total" },
        },
      },
      {
        $group: {
          _id: "$_id.customerTypeId",
          customerType: { $first: "$customerType" },
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

      // 💰 Apply price filtering
      ...(Object.keys(priceFilter).length > 0
        ? [{ $match: { totalSales: priceFilter } }]
        : []),

      // 🔍 Search filter
      ...(search
        ? [
            {
              $match: {
                customerType: { $regex: search, $options: "i" },
              },
            },
          ]
        : []),

      { $sort: { totalSales: -1 } },
      {
        $project: {
          customerType: 1,
          totalQty: 1,
          totalSales: 1,
          orderCount: 1,
        },
      },
    ];

    const result = await ORDER.aggregate(pipeline);

    const pdfBuffer = await generatePDF("customerTypeSalesTemp", {
      data: result,
      currency,
      filters: {
        search,
        minPrice: !isNaN(min) ? min : null,
        maxPrice: !isNaN(max) ? max : null,
      },
    });

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="CustomerType-sales-report-${Date.now()}.pdf"`,
    });

    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};




export const DailySalesExcel = async (req, res, next) => {
  try {
    const userId = req.user;
    const user = await USER.findOne({ _id: userId });
    if (!user) return res.status(400).json({ message: "User not found!" });

    const {
      fromDate,
      toDate,
      customerTypeId,
      paymentMethod,
      search,
      minPrice,
      maxPrice
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
          customerType: { $first: "$customerType.type" },
          discount: { $first: "$order.discount" },
          amount: { $first: "$grandTotal" },
          date: { $first: "$createdAt" },
          paymentMethods: {
            $push: {
              type: "$account.accountName",
              amount: "$methods.amount"
            }
          }
        }
      }
    ];

    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    const priceMatch = {};
    if (!isNaN(min)) priceMatch.amount = { ...priceMatch.amount, $gte: min };
    if (!isNaN(max)) priceMatch.amount = { ...priceMatch.amount, $lte: max };
    if (Object.keys(priceMatch).length) {
      basePipeline.push({ $match: priceMatch });
    }

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
            { "paymentMethods.type": { $regex: search, $options: "i" } }
          ]
        }
      });
    }

    const data = await PAYMENT.aggregate([...basePipeline, { $sort: { date: -1 } }]);

// Create Excel workbook and worksheet
const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet("Daily Sales Report");

// Add title row
worksheet.mergeCells('A1:G1');
const titleRow = worksheet.getCell('A1');
titleRow.value = 'Daily Sales Report';
titleRow.font = { size: 16, bold: true };
titleRow.alignment = { vertical: 'middle', horizontal: 'center' };

// ==== Filter Info Row ====
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
if (paymentMethod) {
  filters.push(`Payment Method: ${paymentMethod}`);
}
if (search) {
  filters.push(`Search: ${search}`);
}

if (filters.length > 0) {
  const filterText = filters.join(" | ");
  worksheet.mergeCells('A2:G2');
  const filterRow = worksheet.getCell('A2');
  filterRow.value = filterText;
  filterRow.font = { bold: true, size: 12 };
  filterRow.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.addRow([]); // spacing row
} else {
  worksheet.addRow([]); // still add empty row to keep header at same line
}


// Add column headings manually
const headerRow = worksheet.addRow([
  "Date", "Order ID", "Order No", "Customer Type", "Discount", "Payment Methods", "Amount"
]);

// Make header row bold
headerRow.eachCell((cell) => {
  cell.font = { bold: true };
});

// Set column widths
worksheet.columns = [
  { key: "date", width: 20 },
  { key: "orderId", width: 20 },
  { key: "orderNo", width: 15 },
  { key: "customerType", width: 20 },
  { key: "discount", width: 10 },
  { key: "paymentMethods", width: 40 },
  { key: "amount", width: 15 }
];

// Add rows
data.forEach((item) => {
  const paymentMethodsStr = item.paymentMethods.map(pm => `${pm.type}: ${pm.amount}`).join(", ");
  worksheet.addRow({
    date: new Date(item.date),
    orderId: item.orderId,
    orderNo: item.orderNo,
    customerType: item.customerType || '-',
    discount: item.discount || 0,
    paymentMethods: paymentMethodsStr,
    amount: item.amount
  });
});

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="daily-sales-report.xlsx"`
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    next(err);
  }
};



//excle section
export const categorySalesExcel = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found" });

    const { minPrice, maxPrice, search = "" } = req.query;
      const restaurant = await RESTAURANT.findOne().lean();
    const currency = restaurant?.currency || 'AED';



    const priceFilter = {};
    if (!isNaN(parseFloat(minPrice))) priceFilter.$gte = parseFloat(minPrice);
    if (!isNaN(parseFloat(maxPrice))) priceFilter.$lte = parseFloat(maxPrice);

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
                  categoryId: "$categoryInfo._id",
                  orderId: "$_id"
                },
                categoryName: { $first: "$categoryInfo.name" },
                totalQty: { $sum: "$items.qty" },
                totalSales: { $sum: "$items.total" }
              }
            },
            {
              $group: {
                _id: "$_id.categoryId",
                categoryName: { $first: "$categoryName" },
                totalQty: { $sum: "$totalQty" },
                totalSales: { $sum: "$totalSales" },
                orderIds: { $addToSet: "$_id.orderId" }
              }
            },
            {
              $addFields: {
                totalOrders: { $size: "$orderIds" }
              }
            }
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
              }
            },
            {
              $lookup: {
                from: "foods",
                localField: "items.items.foodId",
                foreignField: "_id",
                as: "comboFoodInfo"
              }
            },
            { $unwind: "$comboFoodInfo" },
            {
              $lookup: {
                from: "categories",
                localField: "comboFoodInfo.categoryId",
                foreignField: "_id",
                as: "categoryInfo"
              }
            },
            { $unwind: "$categoryInfo" },
            {
              $group: {
                _id: {
                  categoryId: "$categoryInfo._id",
                  orderId: "$_id"
                },
                categoryName: { $first: "$categoryInfo.name" },
                totalQty: { $sum: "$items.items.computedQty" },
                totalSales: { $sum: "$items.items.computedTotal" }
              }
            },
            {
              $group: {
                _id: "$_id.categoryId",
                categoryName: { $first: "$categoryName" },
                totalQty: { $sum: "$totalQty" },
                totalSales: { $sum: "$totalSales" },
                orderIds: { $addToSet: "$_id.orderId" }
              }
            },
            {
              $addFields: {
                totalOrders: { $size: "$orderIds" }
              }
            }
          ]
        }
      },
      {
        $project: {
          all: { $concatArrays: ["$directFood", "$comboFood"] }
        }
      },
      { $unwind: "$all" },
      {
        $group: {
          _id: "$all._id",
          categoryName: { $first: "$all.categoryName" },
          totalQty: { $sum: "$all.totalQty" },
          totalSales: { $sum: "$all.totalSales" },
          totalOrders: { $sum: "$all.totalOrders" }
        }
      },
      {
        $match: {
          ...(search && {
            categoryName: { $regex: search, $options: "i" }
          }),
          ...(Object.keys(priceFilter).length && {
            totalSales: priceFilter
          })
        }
      },
      { $sort: { totalSales: -1 } }
    ];

    const result = await ORDER.aggregate(pipeline);

    // Generate Excel
  const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet("Category Sales");

// Add title row (merged and bold)
worksheet.mergeCells('A1:D1');
const titleRow = worksheet.getCell('A1');
titleRow.value = 'Category Sales Report';
titleRow.font = { size: 16, bold: true };
titleRow.alignment = { vertical: 'middle', horizontal: 'center' };

// Empty row after title
const filters = [];
if (!isNaN(parseFloat(minPrice)) || !isNaN(parseFloat(maxPrice))) {
  const min = isNaN(parseFloat(minPrice)) ? 0 : parseFloat(minPrice);
  const max = isNaN(parseFloat(maxPrice)) ? "∞" : parseFloat(maxPrice);
  filters.push(`Total Sales: ${min} to ${max} ${currency}`);
}
if (search) {
  filters.push(`Category Name Search: "${search}"`);
}

if (filters.length > 0) {
  const filterRow = worksheet.addRow(filters);
  filterRow.eachCell(cell => {
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  worksheet.addRow([]); // empty row between filters and headers
} else {
  worksheet.addRow([]); // preserve spacing if no filters
}

// Add column headings manually
const headerRow = worksheet.addRow([
  "Category",
  "Total Qty",
  "Total Orders",
  `Total Sales (${currency})`
]);

// Make column headings bold
headerRow.eachCell((cell) => {
  cell.font = { bold: true };
});

// Set column widths
worksheet.columns = [
  { key: "categoryName", width: 30 },
  { key: "totalQty", width: 15 },
  { key: "totalOrders", width: 15 },
  { key: "totalSales", width: 20 }
];

// Add data rows
result.forEach(item => {
  worksheet.addRow({
    categoryName: item.categoryName,
    totalQty: item.totalQty,
    totalOrders: item.totalOrders,
    totalSales: item.totalSales
  });
});

// Grand Total Row
const totalRow = worksheet.addRow({
  categoryName: "Grand Total",
  totalQty: { formula: `SUM(B4:B${result.length + 3})` },
  totalOrders: { formula: `SUM(C4:C${result.length + 3})` },
  totalSales: { formula: `SUM(D4:D${result.length + 3})` }
});

totalRow.eachCell(cell => {
  cell.font = { bold: true };
});

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=category-sales-${Date.now()}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};


export const itemWiseSalesExcel = async (req, res, next) => {
  try {
    const { search = "", minPrice, maxPrice } = req.query;

    const user = await USER.findById(req.user);
    if (!user) return res.status(400).json({ message: "User not found" });

    const restaurant = await RESTAURANT.findOne({});
    const currency = restaurant?.currency || "AED";

    const priceFilter = {};
    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    if (!isNaN(min)) priceFilter.$gte = min;
    if (!isNaN(max)) priceFilter.$lte = max;

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

      ...(Object.keys(priceFilter).length > 0
        ? [{ $match: { "all.totalSales": priceFilter } }]
        : []),

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

    // Generate Excel
   // Generate Excel
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet("Item Sales");

// Title Row (merged + bold)
ws.mergeCells("A1:E1");
const titleCell = ws.getCell("A1");
titleCell.value = "Item Sales Report";
titleCell.font = { size: 16, bold: true };
titleCell.alignment = { vertical: "middle", horizontal: "center" };

// Build filter summary row
const filters = [];
if (!isNaN(min) || !isNaN(max)) {
  const minVal = isNaN(min) ? 0 : min;
  const maxVal = isNaN(max) ? "∞" : max;
  filters.push(`Total Sales: ${minVal} to ${maxVal} ${currency}`);
}
if (search) {
  filters.push(`Search: "${search}"`);
}

if (filters.length > 0) {
  const filterRow = ws.addRow(filters);
  filterRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });
  ws.addRow([]); // Spacer row after filters
} else {
  ws.addRow([]); // Spacer row if no filters
}

// Column Headers
const headerRow = ws.addRow([
  "Item Name",
  "Category",
  "Total Qty",
  "Total Orders",
  `Total Sales (${currency})`,
]);

// Make headers bold
headerRow.eachCell((cell) => {
  cell.font = { bold: true };
});

// Set column widths
ws.columns = [
  { key: "itemName", width: 30 },
  { key: "category", width: 20 },
  { key: "totalQty", width: 15 },
  { key: "totalOrders", width: 15 },
  { key: "totalSales", width: 20 },
];

// Data Rows
result.forEach((r) => {
  ws.addRow({
    itemName: r.itemName,
    category: r.category,
    totalQty: r.totalQty,
    totalOrders: r.totalOrders,
    totalSales: r.totalSales,
  });
});

// Totals Row
const totalRow = ws.addRow({
  itemName: "Grand Total",
  totalQty: { formula: `SUM(C4:C${result.length + 3})` },
  totalOrders: { formula: `SUM(D4:D${result.length + 3})` },
  totalSales: { formula: `SUM(E4:E${result.length + 3})` },
});
totalRow.eachCell((cell) => {
  cell.font = { bold: true };
});


    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=ItemSales_${Date.now()}.xlsx`
    );

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
};


export const customerTypeWiseSalesExcel = async (req, res, next) => {
  try {
    const userId = req.user;
    const user = await USER.findById(userId);
    if (!user) return res.status(400).json({ message: "User not found" });

    const search = req.query.search || "";
    const min = parseFloat(req.query.minPrice);
    const max = parseFloat(req.query.maxPrice);
    const priceFilter = {};
    if (!isNaN(min)) priceFilter.$gte = min;
    if (!isNaN(max)) priceFilter.$lte = max;

    const pipeline = [
      { $match: { status: "Completed" } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "customertypes",
          localField: "customerTypeId",
          foreignField: "_id",
          as: "customerType",
        },
      },
      { $unwind: "$customerType" },
      {
        $group: {
          _id: {
            customerTypeId: "$customerType._id",
            orderId: "$_id",
          },
          customerType: { $first: "$customerType.type" },
          totalQty: { $sum: "$items.qty" },
          totalSales: { $sum: "$items.total" },
        },
      },
      {
        $group: {
          _id: "$_id.customerTypeId",
          customerType: { $first: "$customerType" },
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
      ...(Object.keys(priceFilter).length > 0
        ? [{ $match: { totalSales: priceFilter } }]
        : []),
      ...(search
        ? [{
            $match: {
              customerType: { $regex: search, $options: "i" },
            },
          }]
        : []),
      {
        $project: {
          _id: 0,
          customerType: 1,
          totalQty: 1,
          totalSales: 1,
          orderCount: 1,
        },
      },
      { $sort: { totalSales: -1 } },
    ];

    const result = await ORDER.aggregate(pipeline);

    // Generate Excel using exceljs
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Customer Type Sales");

    // Title row (merged + bold)
    ws.mergeCells("A1:D1");
    const titleCell = ws.getCell("A1");
    titleCell.value = "Customer Type Sales Report";
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };

    // Empty row
    ws.addRow([]);

    if (search) {
  const searchRow = ws.addRow([`Search: ${search}`]);
  searchRow.getCell(1).font = { bold: true };
  searchRow.getCell(1).alignment = { horizontal: "left" };
}

    // Header row
    const headerRow = ws.addRow([
      "Customer Type",
      "Total Quantity",
      "Total Sales",
      "Order Count",
    ]);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
    });

    // Set column widths
    ws.columns = [
      { key: "customerType", width: 30 },
      { key: "totalQty", width: 20 },
      { key: "totalSales", width: 20 },
      { key: "orderCount", width: 15 },
    ];

    // Add data rows
    result.forEach((item) => {
      ws.addRow({
        customerType: item.customerType,
        totalQty: item.totalQty,
        totalSales: item.totalSales,
        orderCount: item.orderCount,
      });
    });

    // Totals
    const totalQty = result.reduce((sum, r) => sum + r.totalQty, 0);
    const totalSales = result.reduce((sum, r) => sum + r.totalSales, 0);
    const orderCount = result.reduce((sum, r) => sum + r.orderCount, 0);

    // Grand total row (bold)
    const totalRow = ws.addRow({
      customerType: "Grand Total",
      totalQty,
      totalSales,
      orderCount,
    });
    totalRow.eachCell((cell) => {
      cell.font = { bold: true };
    });

    // Send Excel
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=CustomerTypeSales_${Date.now()}.xlsx`
    );

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
};






