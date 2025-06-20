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

          console.log(fromDate,toDate,'both dates')

        const userId = req.user 

        const user = await USER.findOne({ _id: userId }).lean();
        if (!user) return res.status(400).json({ message: "User not found" });

        // 1. Get all completed orders in the date range

             const start = new Date(fromDate);
            start.setHours(0, 0, 0, 0);

            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);

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

        const user = await USER.findOne({ _id: userId }).lean();
        if (!user) return res.status(400).json({ message: "User not found" });

    if (!fromDate || !toDate) {
      return res.status(400).json({ message: "Missing fromDate or toDate" });
    }

       const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    const customerTypes = await CUSTOMER_TYPE.find();
    const customerTypeMap = new Map();
    customerTypes.forEach(ct => {
      customerTypeMap.set(ct._id.toString(), ct.type);
    });

        const payments = await PAYMENT.aggregate([
      {
        $match: {
          createdAt: {
            $gte: start,
            $lte: end
          }
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
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            customerTypeId: "$orderInfo.customerTypeId"
          },
          total: { $sum: "$grandTotal" }
        }
      }
    ]);

    // Format the data for graph
    const salesMap = new Map();
    payments.forEach(p => {
      const { date, customerTypeId } = p._id;
      const type = customerTypeMap.get(customerTypeId.toString()) || "Unknown";

           if (!salesMap.has(date)) {
        salesMap.set(date, { breakdown: {}, total: 0 });
      }

      const entry = salesMap.get(date);
      entry.breakdown[type] = (entry.breakdown[type] || 0) + p.total;
      entry.total += p.total;
    })
     // Build the final response
     const labels = Array.from(salesMap.keys()).sort(); // sorted by date
    const data = [];
    const breakdown = [];

        labels.forEach(date => {
      const entry = salesMap.get(date);
      data.push(parseFloat(entry.total.toFixed(2)));
      breakdown.push({
        date,
        breakdown: Object.fromEntries(
          Object.entries(entry.breakdown).map(([k, v]) => [k, parseFloat(v.toFixed(2))])
        )
      });
    });

     return res.status(200).json({
      labels,
      datasets: [
        {
          label: "Sales",
          data,
          breakdown
        }
      ]
    });

    } catch (err) {
        next(err)
    }
}








