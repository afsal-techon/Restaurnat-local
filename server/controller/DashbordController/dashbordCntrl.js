import mongoose from "mongoose";
import USER from '../../model/userModel.js';
import RESTAURANT from '../../model/restaurant.js'
import CATEGORY from '../../model/category.js'
import FOOD from '../../model/food.js'
import CUSTOMER_TYPE from '../../model/customerTypes.js';
import KITCHEN from '../../model/kitchen.js'
import ORDER from '../../model/oreder.js';
import COMBO from '../../model/combo.js'
import TABLES from '../../model/tables.js';
import CUSTOMER from '../../model/customer.js';
import PAYMENT from '../../model/paymentRecord.js'
import { getIO  } from "../../config/socket.js";




export const getQuickViewDashboard = async(req,res,next)=>{
    try {

          const { fromDate, toDate } = req.params;

          console.log(fromDate,toDate,'form date and to date');

        const userId = req.user 

        const user = await USER.findOne({ _id: userId }).lean();
        if (!user) return res.status(400).json({ message: "User not found" });

        // 1. Get all completed orders in the date range

             const start = new Date(fromDate);
            const end = new Date(toDate);
    

    const completedOrders = await ORDER.find({
        status: "Completed",
        createdAt: { $gte: start, $lte: end }
        }).select("_id customerTypeId");

       
      const orderIds = completedOrders.map(order => order._id);

    // 2. Create a mapping of customerTypeId => readable name
    const customerTypes = await CUSTOMER_TYPE.find();
    const customerTypeMap = new Map();
    customerTypes.forEach(ct => {
      customerTypeMap.set(ct._id.toString(), ct.type); // e.g., "Dine-In"
    });


  // 3. Aggregate total sales by customerType using Payment
                    
    const payments = await PAYMENT.aggregate([
      {
        $match: {
          orderId: { $in: orderIds },
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "orderInfo"
        }
      },
      { $unwind: "$orderInfo" },
      {
        $group: {
          _id: "$orderInfo.customerTypeId",
          total: { $sum: "$grandTotal" },
          count: { $sum: 1 }
        }
      }
    ]);


    let totalSales = 0;
    let totalOrders = 0;

    const typeWiseData = new Map();

    // Store actual results in map first
    payments.forEach((p) => {
      const type = customerTypeMap.get(p._id.toString()) || "Unknown";
      typeWiseData.set(type, {
        sales: parseFloat(p.total.toFixed(2)),
        orders: p.count,
      });

      totalSales += p.total;
      totalOrders += p.count;
    });

    const breakdown = [];

    // Now make sure all customer types are included (even if 0)
    customerTypeMap.forEach((type, id) => {
      if (typeWiseData.has(type)) {
        breakdown.push({
          name: type,
          sales: typeWiseData.get(type).sales,
          orders: typeWiseData.get(type).orders,
        });
      } else {
        breakdown.push({
          name: type,
          sales: 0,
          orders: 0,
        });
      }
    });

    // Add totals first
    const data = [
      {
        name: "Total Sales",
        sales: parseFloat(totalSales.toFixed(2)),
        orders: null,
      },
      {
        name: "Total Orders",
        sales: null,
        orders: totalOrders,
      },
      ...breakdown,
    ]; 

   return res.status(200).json(data);
        
    } catch (err) {
        next(err)
    }
}



export const getSalesOverview = async(req,res,next)=>{
    try {

         const { fromDate, toDate } = req.params;
       const userId = req.user

       console.log(fromDate,'from date');
       console.log(toDate,'todate')

        const user = await USER.findOne({ _id: userId }).lean();
        if (!user) return res.status(400).json({ message: "User not found" });

    // if (!fromDate || !toDate) {
    //   return res.status(400).json({ message: "Missing fromDate or toDate" });
    // }

            const start = new Date(fromDate);
            const end = new Date(toDate);

    const customerTypes = await CUSTOMER_TYPE.find();
    const customerTypeMap = new Map();
    customerTypes.forEach(ct => {
      customerTypeMap.set(ct._id.toString(), ct.type);
    });

    //     const payments = await PAYMENT.aggregate([
    //   {
    //     $match: {
    //       createdAt: {
    //         $gte: start,
    //         $lte: end
    //       }
    //     }
    //   },
    //   {
    //     $lookup: {
    //       from: "orders",
    //       localField: "orderId",
    //       foreignField: "_id",
    //       as: "orderInfo"
    //     }
    //   },
    //   { $unwind: "$orderInfo" },
    //   {
    //     $group: {
    //       _id: {
    //         date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
    //         customerTypeId: "$orderInfo.customerTypeId"
    //       },
    //       total: { $sum: "$grandTotal" }
    //     }
    //   }
    // ]);

        // Step 1: Prepare sales map from DB
       const payments = await PAYMENT.aggregate([
      {
        $match: {
          createdAt: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "orderInfo",
        },
      },
      { $unwind: "$orderInfo" },
      {
        $project: {
          grandTotal: 1,
          createdAt: 1,
          customerTypeId: "$orderInfo.customerTypeId",
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          hour: { $hour: "$createdAt" },
        },
      },
      {
        $addFields: {
          slot: {
            $switch: {
              branches: [
                { case: { $lt: ["$hour", 9] }, then: "00:00 - 09:00" },
                { case: { $lt: ["$hour", 13] }, then: "09:00 - 13:00" },
                { case: { $lt: ["$hour", 17] }, then: "13:00 - 17:00" },
                { case: { $lt: ["$hour", 21] }, then: "17:00 - 21:00" },
              ],
              default: "21:00 - 24:00",
            },
          },
        },
      },
      {
        $group: {
          _id: {
            date: "$date",
            slot: "$slot",
            customerTypeId: "$customerTypeId",
          },
          total: { $sum: "$grandTotal" },
        },
      },
    ]);
        // Format result
    const groupedMap = new Map();

  for (const p of payments) {
  const { date, slot, customerTypeId } = p._id;
  const customerType = customerTypeMap.get(customerTypeId.toString()) || "Unknown";

  // Get slot start hour (e.g., "09" from "09:00 - 13:00")
  const slotStartHour = slot.split(":")[0];

  // Create timestamp with both date + slot hour
  const timestamp = new Date(`${date}T${slotStartHour.padStart(2, '0')}:00:00.000Z`);

  const key = `${date}-${slot}`;

  if (!groupedMap.has(key)) {
    groupedMap.set(key, {
      timestamp,
      amount: 0,
      breakdown: {},
    });
  }

  const entry = groupedMap.get(key);
  entry.amount += p.total;
  entry.breakdown[customerType] = (entry.breakdown[customerType] || 0) + p.total;
}

    const result = Array.from(groupedMap.values()).map((entry) => ({
      ...entry,
      amount: parseFloat(entry.amount.toFixed(2)),
      breakdown: Object.fromEntries(
        Object.entries(entry.breakdown).map(([k, v]) => [k, parseFloat(v.toFixed(2))])
      ),
    }));

    return res.status(200).json(result);

    
    } catch (err) {
        next(err)
    }
}





export const getPaymentOverview = async(req,res,next)=>{
    try {

         const { fromDate, toDate } = req.params;
       const userId = req.user

        const user = await USER.findById({ _id: userId }).lean();
        if (!user) return res.status(400).json({ message: "User not found" });

           const start = new Date(fromDate);
            const end = new Date(toDate);

                const payments = await PAYMENT.aggregate([
      {
        $match: {
         createdAt: { $gte: start, $lte: end }
        }
      },
      { $unwind: "$methods" },
      {
        $lookup: {
          from: "accounts",
          localField: "methods.accountId",
          foreignField: "_id",
          as: "accountInfo"
        }
      },
      { $unwind: "$accountInfo" },
      {
        $group: {
          _id: "$accountInfo.accountName",
          total: { $sum: "$methods.amount" }
        }
      },
      {
        $project: {
          _id: 0,
          name: "$_id",
          amount: { $round: ["$total", 2] }
        }
      }
    ]);

          const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);

      const enrichedPayments = payments.map(p => ({
        ...p,
        percentage: totalReceived ? parseFloat(((p.amount / totalReceived) * 100).toFixed(2)) : 0
      }));

    return res.status(200).json({
      methods: enrichedPayments,
      totalReceived
    });

    } catch (err) {
        next(err)
    }
}


