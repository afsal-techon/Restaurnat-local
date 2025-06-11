import mongoose from "mongoose";
import MENUTYPE from '../../model/menuType.js'
import USER from '../../model/userModel.js';
import RESTAURANT from '../../model/restaurant.js'
import COURSE from '../../model/course.js'
import CATEGORY from '../../model/category.js'
import CHOICE from "../../model/choice.js";
import FOOD from '../../model/food.js'
import CUSTOMER_TYPE from '../../model/customerTypes.js';
import KITCHEN from '../../model/kitchen.js'
import ORDER from '../../model/oreder.js'


const generateOrderId = async () => {
    const latestOrder = await ORDER.findOne({ order_id: { $regex: /^#\d{5}$/ } })
      .sort({ order_id: -1 })
      .lean();
  
    let newIdNumber = 10000; // start point
  
    if (latestOrder) {
      const latestNumber = parseInt(latestOrder.order_id.replace('#', ''), 10);
      newIdNumber = latestNumber + 1;
    }
  
    return `#${newIdNumber}`;
  };
  
  
  const getNextTicketNo = async () => {
    const lastOrder = await ORDER.findOne({ ticketNo: { $regex: /^KOT-/ } })
      .sort({ createdAt: -1 })
      .select("ticketNo");
  
    if (lastOrder?.ticketNo) {
      const lastNumber = parseInt(lastOrder.ticketNo.replace("KOT-", ""), 10);
      const nextNumber = isNaN(lastNumber) ? 1 : lastNumber + 1;
      return `KOT-${nextNumber}`;
    } else {
      return "KOT-01";
    }
  };
  
  const getNextOrderNo = async () => {
    const lastOrder = await ORDER.findOne({ orderType: "Take Away" })
    .sort({ createdAt: -1 })
    .select("orderNo");
  
    const lastNumber = parseInt(lastOrder?.orderNo) || 0;
    return (lastNumber + 1).toString().padStart(2, '0');
  };





  export const createOrder = async(req,res,next)=>{
    const session = await mongoose.startSession();
    session.startTransaction();
    try { 
       console.log(req.body,'body')
      // 1. Extract and Validate Request Parameters
      const {
        tableId,
        customerTypeId,
        subMethod,
        items,
        vat,
        restaurantId,
        total,
        subTotal,
        orderId, // For additional orders
        counterId,
        action = 'create', // 'create', 'kot', 'save', 'kot_print'
        printConfig = {} // Printer settings for KOT print
      } = req.body;
  
    
  
      const userId = req.user;
      let isAdditionalOrder = Boolean(orderId);
      console.log(isAdditionalOrder,'additional roder')
  
      // 2. Validate User and Basic Parameters
      const user = await USER.findOne({ _id: userId, isDeleted: false }).lean();
      if (!user) {
        await session.abortTransaction();
        return res.status(400).json({ message: "User not found" });
      }
  
      if (!Array.isArray(items) || items.length === 0) {
        await session.abortTransaction();
        return res.status(400).json({ message: 'No items in order' });
      }
  
      // if(!counterId){
      //   return res.status(400).json({ message:'Counter not found!'})
      // }
  
      // 3. Process Order Items for validation (updated for combos)
           const foodIds = [];
          const comboIds = [];
           // 1. Collect all necessary IDs
           items.forEach(item => {
            if (item.isCombo) {
              // Add combo ID to comboIds array
              comboIds.push(new mongoose.Types.ObjectId(item.comboId));
              
              // Add all food IDs from combo items
              item.items.forEach(comboItem => {
                foodIds.push(new mongoose.Types.ObjectId(comboItem.foodId));
              });
            } else {
              foodIds.push(new mongoose.Types.ObjectId(item.foodId));
            }
          });
            const uniqueFoodIds = [...new Set(foodIds)];
  
      // 2. Fetch all required data
          const [foodDocs, comboDocs] = await Promise.all([
            FOOD.find({ 
              _id: { $in: uniqueFoodIds }, 
              isDeleted: false,  
              restaurantId: restaurantId 
            }).lean(),
            COMBO.find({
              _id: { $in: comboIds },
              isDeleted: false,
              restaurantId: restaurantId
            }).populate({
              path: 'groups',
              populate: {
                path: 'foodItems.foodId',
                model: 'Food'
              }
            }).populate('addOns.addOnId').lean()
          ]);
                        
            // 3. Create lookup maps
          const foodMap = {};
          foodDocs.forEach(food => foodMap[food._id.toString()] = food);
  
          const comboMap = {};
          comboDocs.forEach(combo => comboMap[combo._id.toString()] = combo);
        const processedItems = await Promise.all(items.map(async (item) => {
          if (item.isCombo) {
            // Handle combo item
            const combo = comboMap[item.comboId];
            if (!combo) throw new Error(`Invalid combo item: ${item.comboId}`);
            // Process combo items
            console.log(item.items,'combo items')
            const comboItems = await Promise.all(item.items.map(async (comboItem) => {
              const food = foodMap[comboItem.foodId];
              if (!food) throw new Error(`Invalid food item in combo: ${comboItem.foodId}`);
    
              const portion = comboItem.portion ? 
                food.portions?.find(p => p.name === comboItem.portion) : null;
              const conversion = portion?.conversion || 1;
    
              return {
                foodId: food._id,
                foodName: food.foodName,
                portion: comboItem.portion || null,
                price: comboItem.price || 0,
                qty: comboItem.qty,
                total: comboItem.total,
                discount: 0,
                choices: [],
                isAdditional: isAdditionalOrder,
                conversionFactor: conversion,
                isComboItem: true,
                comboId: combo._id,
                comboName: combo.comboName
              };
            }));
    
            return {
              isCombo: true,
              comboId: combo._id,
              comboName: combo.comboName,
              comboPrice: item.comboPrice || combo.comboPrice,
              items: comboItems,
              addOns: item.addOns || [],
              qty: item.qty ?? 1, 
              total: item.total,
              isAdditional: isAdditionalOrder
            };
          }else{
      
        const food = foodMap[item.foodId];
       if (!food) throw new Error(`Invalid food item: ${item.foodId}`);
  
        const selectedPortion = item.portion || null;
        const portionData = food.portions?.find(p => p.name === item.portion);
        const conversion = portionData?.conversion || 1;
  
        return {
          foodId: item.foodId,
          foodName: food.foodName,
          portion: selectedPortion,
          price: item.price,
          qty: item.qty ?? 1,
          total: item.total,
          discount: food.discount || 0,
          addOns: item.addOns || [],
          choices: item.choices || [],
          isAdditional: isAdditionalOrder,
          conversionFactor: conversion
        };
  
      }
      }));

      let order;
      let ticketNo = null;
      let orderNo = null;
      let ctypeName;
  
      if (isAdditionalOrder) {
        // Additional Items Flow
        order = await ORDER.findOne({
          _id: orderId,
          status: { $nin: ['Completed', 'Cancelled'] }
        }).session(session);
  
        if (!order) {
          await session.abortTransaction();
          return res.status(404).json({ message: "Order not found or cannot be modified" });
        }
  
        ctypeName = order.orderType;
      } else {
        // New Order Flow
        const custType = await CUSTOMER_TYPE.findById(customerTypeId).lean();
        if (!custType) {
          await session.abortTransaction();
          return res.status(400).json({ message: 'Invalid customer type' });
        }
  
        ctypeName = custType.type;
        const generatedOrderId = await generateOrderId();
  
        // Generate Ticket/Order No based on order type
        if (ctypeName.includes("Dine-In")) {
          ticketNo = await getNextTicketNo();
        } else if (ctypeName.includes("Take Away")) {
          ticketNo = await getNextTicketNo();
          orderNo = await getNextOrderNo();
        }
  
        [order] = await ORDER.create([{
          restaurantId,
          tableId,
          customerTypeId,
          subMethod,
          items: [], // Will be populated after validation
          discount: 0,
          vat,
          subTotal,
          totalAmount: total,
          orderType: ctypeName,
          order_id: generatedOrderId,
          ticketNo: ticketNo || null,
          orderNo: orderNo || null,
          counterId:counterId,
          status: "Placed",
          createdById: user._id,
          createdBy: user.name,
        }], { session });
      }
  
  
      // 6. Update Order with Items
      if (isAdditionalOrder) {
        order.items.push(...processedItems);
        order.totalAmount += processedItems.reduce((sum, item) => sum + item.total, 0);
      } else {
        order.items = processedItems;
      }
      await order.save({ session });

  
      // 7. Handle Table Status for Dine-In
      if (ctypeName.includes("Dine-In") && tableId) {
        const table = await TABLES.findById(tableId).session(session);
        if (!table) {
          await session.abortTransaction();
          return res.status(400).json({ message: 'Table not found' });
        }
  
        const updatedTable = await TABLES.findOneAndUpdate(
          { _id: tableId },
          {
            currentStatus: 'Running',
            currentOrderId: order._id,
            totalAmount: order.totalAmount,
            runningSince: new Date()
          },
          { new: true, session }
        ).lean();
  
        // const io = getIO();
        // io.to(`posTable-${order.restaurantId}`).emit('single_table_update', updatedTable);
      }
  
      const shouldPrint = ['kot_print', 'save_print'].includes(action);
  
      // 7. Handle Printing
      if (shouldPrint) {
        try {
          if (ctypeName.includes("Take Away")) {
            // Takeaway printing - KOT and Customer Receipt
            await printTakeawayKOT(order, printConfig); // Kitchen copy
            await printCustomerReceipt(order, printConfig); // Customer copy
          } else {
            // Dine-In printing
            await printKOTReceipt(order, printConfig); // Only KOT
          }
        } catch (printError) {
          console.error('Printing failed:', printError);
          // Continue even if printing fails
        }
      }
  
      // 8. Commit Transaction
      await session.commitTransaction();
  
      // 9. Prepare Response
      const populatedOrder = await ORDER.findById(order._id)
        .populate("tableId", "name")
        .populate("customerId", "name mobileNo")
        .lean();
  
      // Emit real-time updates
      const io = getIO();
      const responseData = {
        action,  // Include action for frontend handling if needed
        order: populatedOrder,  // Always nest under 'order' for consistency
      };
      
    //   io.to(`posOrder-${order.restaurantId}`).emit('new_order', responseData);
  
      return res.status(200).json(responseData);

  
    } catch (err) {
      await session.abortTransaction();
      return next(err);
    } finally {
      session.endSession(); 
    }
  }


  async function printTakeawayKOT(order, config) {
    // Implement thermal printer logic for kitchen KOT
    console.log(`Printing Takeaway KOT for Order #${order.orderNo}`);
  }
  
  async function printCustomerReceipt(order, config) {
    // Implement customer receipt printing
    console.log(`Printing Customer Receipt for Order #${order.orderNo}`);
  }
  

  async function printKOTReceipt(order, config) {
    // Implement Dine-In KOT printing
    console.log(`Printing KOT for ${order.tableId ? 'Table '+order.tableId : 'Order '+order.orderNo}`);
  }



  export const getTodayOrdersForPOS = async (req, res, next) => {
    try {
      const { restaurantId } = req.params;
      const userId = req.user; 
  
      // Validate restaurant access
      const user = await USER.findOne({ _id: userId });
      if (!user) return res.status(403).json({ message: "User not found!" });
  
      // Get today's date range (start and end of day)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
  
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
  
      // Fetch orders in parallel for better performance
      const [ongoing, completed, cancelled] = await Promise.all([
        // Ongoing orders (Placed, Preparing, Ready, Served)
        ORDER.find({
          restaurantId,
          createdAt: { $gte: todayStart, $lte: todayEnd },
          status: { $in: ["Placed", "Preparing", "Ready", "Served"] },
          isDeleted: false
        })
        .select("_id createdAt orderNo orderType order_id restaurantId totalAmount items subMethod")
          .populate("tableId", "name")
          .sort({ createdAt: -1 }), // Newest first
        
        // Completed orders
        ORDER.find({
          restaurantId,
          createdAt: { $gte: todayStart, $lte: todayEnd },
          status: "Completed",
          isDeleted: false
        })
        .select("_id createdAt orderNo orderType order_id restaurantId totalAmount items subMethod")
          .populate("tableId", "name")
          .sort({ createdAt: -1 }),
        
        // Cancelled orders
        ORDER.find({
          restaurantId,
          createdAt: { $gte: todayStart, $lte: todayEnd },
          status: "Cancelled",
          isDeleted: false
        })
        .select("_id createdAt orderNo orderType order_id restaurantId totalAmount items subMethod")
          .populate("tableId", "name")
          .sort({ createdAt: -1 })
      ]);
  
      return res.status(200).json({
        ongoing,
        completed,
        cancelled
      });
  
    } catch (err) {
      return next(err);
    }
  };