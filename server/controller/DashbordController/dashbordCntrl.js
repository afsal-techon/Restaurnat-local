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

        const userId = req.user 

        const user = await USER.findOne({ _id: userId }).lean();
        if (!user) return res.status(400).json({ message: "User not found" });

        // 1. Get all completed orders in the date range

    const completedOrders = await ORDER.find({
        status: "Completed",
        createdAt: { $gte: new Date(fromDate), $lte: new Date(toDate) }
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
          createdAt: { $gte: new Date(fromDate), $lte: new Date(toDate) }
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
       const data = {};

         payments.forEach(p => {
      const type = customerTypeMap.get(p._id.toString()) || "Unknown";
      data[type] = parseFloat(p.total.toFixed(2)); // e.g., "Dine-In": 5400.00
      totalSales += p.total;
      totalOrders += p.count;
    });

       data.totalSales = parseFloat(totalSales.toFixed(2));
        data.totalOrders = totalOrders;

   return res.status(200).json(data);
        
    } catch (err) {
        next(err)
    }
}