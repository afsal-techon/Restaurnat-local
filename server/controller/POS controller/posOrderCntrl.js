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
import ORDER from '../../model/oreder.js';
import COMBO from '../../model/combo.js'
import TABLES from '../../model/tables.js';
import CUSTOMER from '../../model/customer.js';
import PAYMENT from '../../model/paymentRecord.js'
import { getIO  } from "../../config/socket.js";
import TRANSACTION from '../../model/transaction.js'
import PRINTER_CONFIG from '../../model/printConfig.js'
// import printer from '@thiagoelg/node-printer';
import { TokenCounter }  from '../../model/tokenCounter.js';
import SETTINGS from '../../model/posSettings.js'
import KOT_NOTIFICATION from '../../model/kotNotification.js'
import moment from 'moment'

// "@thiagoelg/node-printer": "^0.6.2",





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
  const today = moment().format('YYYY-MM-DD');

  const counter = await TokenCounter.findOneAndUpdate(
    { date: today },
    { $inc: { tokenNo: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

 
  return counter.tokenNo.toString().padStart(2, '0'); // '01', '02', etc.
};


export const createOrder = async (req, res, next) => {
  try {
    console.log(req.body, 'body');

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
      discount,
      action = 'create',
      deliveryDetails,
      printConfig = {},
    } = req.body;

    const userId = req.user;
    const isAdditionalOrder = Boolean(orderId);
    console.log(isAdditionalOrder, 'additional order');

    const user = await USER.findOne({ _id: userId }).lean();
    if (!user) return res.status(400).json({ message: 'User not found' });

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'No items in order' });
    }

    const foodIds = [];
    const comboIds = [];

    items.forEach(item => {
      if (item.isCombo) {
        comboIds.push(new mongoose.Types.ObjectId(item.comboId));
        item.items.forEach(comboItem => {
          foodIds.push(new mongoose.Types.ObjectId(comboItem.foodId));
        });
      } else {
        foodIds.push(new mongoose.Types.ObjectId(item.foodId));
      }
    });

    const uniqueFoodIds = [...new Set(foodIds)];

    const [foodDocs, comboDocs] = await Promise.all([
      FOOD.find({ _id: { $in: uniqueFoodIds }, restaurantId }).lean(),
      COMBO.find({ _id: { $in: comboIds }, restaurantId })
        .populate({ path: 'groups', populate: { path: 'foodItems.foodId', model: 'Food' } })
        .populate('addOns.addOnId')
        .lean(),
    ]);

    const foodMap = {};
    foodDocs.forEach(food => (foodMap[food._id.toString()] = food));

    const comboMap = {};
    comboDocs.forEach(combo => (comboMap[combo._id.toString()] = combo));

    const processedItems = await Promise.all(
      items.map(async item => {
        if (item.isCombo) {
          const combo = comboMap[item.comboId];
          if (!combo) throw new Error(`Invalid combo item: ${item.comboId}`);

          const firstFoodItemId = item.items[0]?.foodId;
          const firstFoodItem = foodMap[firstFoodItemId];
          if (!firstFoodItem) throw new Error(`Invalid food item in combo: ${firstFoodItemId}`);

          const comboItems = await Promise.all(
            item.items.map(async comboItem => {
              const food = foodMap[comboItem.foodId];
              if (!food) throw new Error(`Invalid food item in combo: ${comboItem.foodId}`);
              const portion = comboItem.portion ? food.portions?.find(p => p.name === comboItem.portion) : null;
              const conversion = portion?.conversion || 1;
              return {
                foodId: food._id,
                foodName: food.foodName,
                portion: comboItem.portion || null,
                price: comboItem.price || 0,
                qty: comboItem.qty,
                total: comboItem.total,
                discount: comboItem.discountAmount || 0,
                choices: [],
                isAdditional: isAdditionalOrder,
                conversionFactor: conversion,
                isComboItem: true,
                comboId: combo._id,
                comboName: combo.comboName,
              };
            })
          );

          return {
            foodId: combo._id,
            foodName: firstFoodItem.foodName,
            price: item.comboPrice || combo.comboPrice,
            comboPrice: item.comboPrice || combo.comboPrice,
            qty: item.qty ?? 1,
            total: item.total,
            discount: item.discountAmount || 0,
            addOns: item.addOns || [],
            choices: [],
            isAdditional: isAdditionalOrder,
            conversionFactor: 1,
            isCombo: true,
            comboId: combo._id,
            comboName: combo.comboName,
            items: comboItems,
          };
        } else {
          const food = foodMap[item.foodId];
          if (!food) throw new Error(`Invalid food item: ${item.foodId}`);

          const portionData = food.portions?.find(p => p.name === item.portion);
          const conversion = portionData?.conversion || 1;

          return {
            foodId: item.foodId,
            foodName: food.foodName,
            portion: item.portion || null,
            price: item.price,
            qty: item.qty ?? 1,
            total: item.total,
            discount: item.discountAmount || 0,
            addOns: item.addOns || [],
            choices: item.choices || [],
            isAdditional: isAdditionalOrder,
            conversionFactor: conversion,
          };
        }
      })
    );

    let order;
    let ticketNo = null;
    let orderNo = null;
    let ctypeName;

    if (isAdditionalOrder) {
      order = await ORDER.findOne({ _id: orderId, status: { $nin: ['Completed', 'Cancelled'] } });
      if (!order) return res.status(404).json({ message: 'Order not found or cannot be modified' });
      ctypeName = order.orderType;
    } else {
      const custType = await CUSTOMER_TYPE.findById(customerTypeId).lean();
      if (!custType) return res.status(400).json({ message: 'Invalid customer type' });
      ctypeName = custType.type;
      const generatedOrderId = await generateOrderId();
      ticketNo = await getNextTicketNo();
      orderNo = await getNextOrderNo();
      console.log('Generated Token No:', orderNo);

      [order] = await ORDER.create([
        {
          restaurantId,
          tableId,
          customerTypeId,
          subMethod,
          items: [],
          discount: discount || 0,
          vat,
          subTotal,
          totalAmount: total,
          orderType: ctypeName,
          order_id: generatedOrderId,
          ticketNo: ticketNo || null,
          orderNo: orderNo || null,
          counterId,
          status: 'Placed',
          createdById: user._id,
          createdBy: user.name,
        },
      ]);
    }


    if(ctypeName.includes('Home Delivery')){
      if(!deliveryDetails.customerId){
         return res.status(400).json({ message: 'Customer are required for delivery' });
      }

        if(!deliveryDetails.deliveryDate || !deliveryDetails.deliveryTime) {
     return res.status(400).json({ message: 'Delivery date and time are required' });
  }

  if(!deliveryDetails.location){
    return res.status(400).json({ message: 'Delivery location is required' });
  }

      order.customerId = deliveryDetails.customerId;
      order.deliveryDate = deliveryDetails.deliveryDate;
      order.deliveryTime = deliveryDetails.deliveryTime;
      order.location = deliveryDetails.location;
    }

    if (isAdditionalOrder) {
      order.items.push(...processedItems);
      order.totalAmount += processedItems.reduce((sum, item) => sum + item.total, 0);
    } else {
      order.items = processedItems;
    }
    await order.save();

    if (ctypeName.includes('Dine-In') && tableId) {
      const table = await TABLES.findById(tableId);
      if (!table) return res.status(400).json({ message: 'Table not found' });

      const updatedTable = await TABLES.findOneAndUpdate(
        { _id: tableId },
        {
          currentStatus: 'Running',
          currentOrderId: order._id,
          totalAmount: order.totalAmount,
          runningSince: order.createdAt || new Date(),
        },
        { new: true }
      ).lean();

      const io = getIO();
      io.to(`posTable-${order.restaurantId}`).emit('single_table_update', updatedTable);
    }

      const populatedOrder = await ORDER.findById(order._id)
      .populate('tableId', 'name')
      .populate('customerId', 'name mobileNo address')
      //  .populate('restaurantId', 'name logo',)
      //  .populate('customerTypeId', 'type')
      .lean();

    const io = getIO();
    const responseData = {
      order: populatedOrder,
    };

    io.to(`posOrder-${order.restaurantId}`).emit('new_order', responseData);

    

if (action === 'print' || action === 'kotandPrint') {
  try {
    const printerConfigs = await PRINTER_CONFIG.find({ printerType: 'KOT' }).lean();
    
    for (const config of printerConfigs) {
      const { kitchenId, printerName } = config;
      // For additional orders, only filter the newly added items
      const itemsToCheck = isAdditionalOrder ? processedItems : order.items;
      
      const kitchenItems = itemsToCheck.filter(item => {
        const foodId = item.isCombo ? item.items[0]?.foodId : item.foodId;
        const food = foodDocs.find(f => f._id.toString() === foodId.toString());
        return food?.kitchenId?.toString() === kitchenId?.toString();
      });

      if (kitchenItems.length > 0) {
        await printKOTReceipt(order, kitchenItems, printerName, isAdditionalOrder);
      }
    }

       if (ctypeName.includes('Take Away')) {
      await printTakeawayCustomerReceipt(order,kitchenItems, printerName);
    }

      if (ctypeName.includes('Home Delivery')) {
      await printTakeawayCustomerReceipt(order,kitchenItems, printerName);
    }
    
  } catch (printError) {
    console.error('Printing failed:', printError);
  }
}


if (action === 'kot' || action === 'kotandPrint') {
      const kitchenItemMap = {};

    const itemsToCheck = isAdditionalOrder ? processedItems : order.items;

    for (const item of itemsToCheck) {
      if (item.isCombo) {
        // For combos, find the kitchen from the first food item
        const combo = comboMap[item.comboId];
        if (!combo || !item.items || item.items.length === 0) continue;


        const kitchen = await KITCHEN.findOne({ restaurantId })
        const kitchenId = kitchen._id;
              if (!kitchenId) continue;

      if (!kitchenItemMap[kitchenId]) kitchenItemMap[kitchenId] = [];

      // Prepare combo items array
      const comboItemsArray = item.items.map(comboItem => {
        const food = foodMap[comboItem.foodId.toString()];
        return {
          foodId: food._id,
          name: comboItem.foodName || food.foodName,
          portion: comboItem.portion,
          quantity: comboItem.qty,
          status: 'Pending',
          isComboItem: true
        };
      });

      kitchenItemMap[kitchenId].push({
        foodId: combo._id, // Combo ID as the main identifier
        name: combo.comboName,
        quantity: item.qty,
        status: 'Pending',
        message: `Combo Order`,
        isComboItem: true,
        comboId: combo._id,
        comboName: combo.comboName,
        comboItems: comboItemsArray
      });
    } else {
      // Regular food item
      const food = foodMap[item.foodId.toString()];
      if (!food?.kitchenId) continue;

      const kitchenId = food.kitchenId.toString();
      if (!kitchenItemMap[kitchenId]) kitchenItemMap[kitchenId] = [];

      kitchenItemMap[kitchenId].push({
        foodId: item.foodId,
        name: item.foodName || food.foodName,
        portion: item.portion,
        quantity: item.qty,
        status: 'Pending',
        message: '',
        isComboItem: false
      });
    }
  }

  // Create KOTs for each kitchen
  for (const [kitchenId, items] of Object.entries(kitchenItemMap)) {
    const kitchen = await KITCHEN.findById(kitchenId).lean();
    if (!kitchen) continue;

    const table = tableId ? await TABLES.findById(tableId).lean() : null;

    const kotData = {
      restaurantId,
      kitchenId,
      tableId,
      orderType: ctypeName,
      items,
      ticketNo,
      orderNo,
      orderId: order._id,
      order_id: order.order_id,
      status: 'Pending',
      orderTime: new Date(),
      isAdditionalKOT: isAdditionalOrder,
      message: `New ${ctypeName} Order received${table ? ` for Table ${table.name}` : ''}, Ticket #${ticketNo}`,
    };

         if (ctypeName.includes('Home Delivery')) {
          kotData.deliveryDate = order.deliveryDate;
          kotData.deliveryTime = order.deliveryTime;
        }

    const [createdKOT] = await KOT_NOTIFICATION.create([kotData]);
    // req.io?.to(`kitchen:${kitchenId}`).emit('kot_notification', createdKOT);

      req.io?.to(`kitchen:${kitchenId}`).emit('kot_status_update',createdKOT);

  }
}
  
    return res.status(200).json(responseData);
  } catch (err) {
    return next(err);
  }
};

// export const createOrder = async (req, res, next) => {
//   try {
//     console.log(req.body, 'body');

//     const {
//       tableId,
//       customerTypeId,
//       subMethod,
//       items,
//       vat,
//       restaurantId,
//       total,
//       subTotal,
//       orderId, // For additional orders
//       counterId,
//       discount,
//       action = 'create',
//       printConfig = {},
//     } = req.body;

//     const userId = req.user;
//     const isAdditionalOrder = Boolean(orderId);
//     console.log(isAdditionalOrder, 'additional order');

//     const user = await USER.findOne({ _id: userId }).lean();
//     if (!user) return res.status(400).json({ message: 'User not found' });

//     if (!Array.isArray(items) || items.length === 0) {
//       return res.status(400).json({ message: 'No items in order' });
//     }

//     const foodIds = [];
//     const comboIds = [];

//     items.forEach(item => {
//       if (item.isCombo) {
//         comboIds.push(new mongoose.Types.ObjectId(item.comboId));
//         item.items.forEach(comboItem => {
//           foodIds.push(new mongoose.Types.ObjectId(comboItem.foodId));
//         });
//       } else {
//         foodIds.push(new mongoose.Types.ObjectId(item.foodId));
//       }
//     });

//     const uniqueFoodIds = [...new Set(foodIds)];

//     const [foodDocs, comboDocs] = await Promise.all([
//       FOOD.find({ _id: { $in: uniqueFoodIds }, restaurantId }).lean(),
//       COMBO.find({ _id: { $in: comboIds }, restaurantId })
//         .populate({ path: 'groups', populate: { path: 'foodItems.foodId', model: 'Food' } })
//         .populate('addOns.addOnId')
//         .lean(),
//     ]);

//     const foodMap = {};
//     foodDocs.forEach(food => (foodMap[food._id.toString()] = food));

//     const comboMap = {};
//     comboDocs.forEach(combo => (comboMap[combo._id.toString()] = combo));

//     const processedItems = await Promise.all(
//       items.map(async item => {
//         if (item.isCombo) {
//           const combo = comboMap[item.comboId];
//           if (!combo) throw new Error(`Invalid combo item: ${item.comboId}`);

//           const firstFoodItemId = item.items[0]?.foodId;
//           const firstFoodItem = foodMap[firstFoodItemId];
//           if (!firstFoodItem) throw new Error(`Invalid food item in combo: ${firstFoodItemId}`);

//           const comboItems = await Promise.all(
//             item.items.map(async comboItem => {
//               const food = foodMap[comboItem.foodId];
//               if (!food) throw new Error(`Invalid food item in combo: ${comboItem.foodId}`);
//               const portion = comboItem.portion ? food.portions?.find(p => p.name === comboItem.portion) : null;
//               const conversion = portion?.conversion || 1;
//               return {
//                 foodId: food._id,
//                 foodName: food.foodName,
//                 portion: comboItem.portion || null,
//                 price: comboItem.price || 0,
//                 qty: comboItem.qty,
//                 total: comboItem.total,
//                 discount: comboItem.discountAmount || 0,
//                 choices: [],
//                 isAdditional: isAdditionalOrder,
//                 conversionFactor: conversion,
//                 isComboItem: true,
//                 comboId: combo._id,
//                 comboName: combo.comboName,
//               };
//             })
//           );

//           return {
//             foodId: combo._id,
//             foodName: firstFoodItem.foodName,
//             price: item.comboPrice || combo.comboPrice,
//             comboPrice: item.comboPrice || combo.comboPrice,
//             qty: item.qty ?? 1,
//             total: item.total,
//             discount: item.discountAmount || 0,
//             addOns: item.addOns || [],
//             choices: [],
//             isAdditional: isAdditionalOrder,
//             conversionFactor: 1,
//             isCombo: true,
//             comboId: combo._id,
//             comboName: combo.comboName,
//             items: comboItems,
//           };
//         } else {
//           const food = foodMap[item.foodId];
//           if (!food) throw new Error(`Invalid food item: ${item.foodId}`);

//           const portionData = food.portions?.find(p => p.name === item.portion);
//           const conversion = portionData?.conversion || 1;

//           return {
//             foodId: item.foodId,
//             foodName: food.foodName,
//             portion: item.portion || null,
//             price: item.price,
//             qty: item.qty ?? 1,
//             total: item.total,
//             discount: item.discountAmount || 0,
//             addOns: item.addOns || [],
//             choices: item.choices || [],
//             isAdditional: isAdditionalOrder,
//             conversionFactor: conversion,
//           };
//         }
//       })
//     );

//     let order;
//     let ticketNo = null;
//     let orderNo = null;
//     let ctypeName;

//     if (isAdditionalOrder) {
//       order = await ORDER.findOne({ _id: orderId, status: { $nin: ['Completed', 'Cancelled'] } });
//       if (!order) return res.status(404).json({ message: 'Order not found or cannot be modified' });
//       ctypeName = order.orderType;
//     } else {
//       const custType = await CUSTOMER_TYPE.findById(customerTypeId).lean();
//       if (!custType) return res.status(400).json({ message: 'Invalid customer type' });
//       ctypeName = custType.type;
//       const generatedOrderId = await generateOrderId();
//       ticketNo = await getNextTicketNo();
//       orderNo = await getNextOrderNo();
//       console.log('Generated Token No:', orderNo);

//       [order] = await ORDER.create([
//         {
//           restaurantId,
//           tableId,
//           customerTypeId,
//           subMethod,
//           items: [],
//           discount: discount || 0,
//           vat,
//           subTotal,
//           totalAmount: total,
//           orderType: ctypeName,
//           order_id: generatedOrderId,
//           ticketNo: ticketNo || null,
//           orderNo: orderNo || null,
//           counterId,
//           status: 'Placed',
//           createdById: user._id,
//           createdBy: user.name,
//         },
//       ]);
//     }

//     if (isAdditionalOrder) {
//       order.items.push(...processedItems);
//       order.totalAmount += processedItems.reduce((sum, item) => sum + item.total, 0);
//     } else {
//       order.items = processedItems;
//     }
//     await order.save();

//     if (ctypeName.includes('Dine-In') && tableId) {
//       const table = await TABLES.findById(tableId);
//       if (!table) return res.status(400).json({ message: 'Table not found' });

//       const updatedTable = await TABLES.findOneAndUpdate(
//         { _id: tableId },
//         {
//           currentStatus: 'Running',
//           currentOrderId: order._id,
//           totalAmount: order.totalAmount,
//           runningSince: order.createdAt || new Date(),
//         },
//         { new: true }
//       ).lean();

//       const io = getIO();
//       io.to(`posTable-${order.restaurantId}`).emit('single_table_update', updatedTable);
//     }

//       const populatedOrder = await ORDER.findById(order._id)
//       .populate('tableId', 'name')
//       .populate('customerId', 'name mobileNo')
//       //  .populate('restaurantId', 'name logo',)
//       //  .populate('customerTypeId', 'type')
//       .lean();

//     const io = getIO();
//     const responseData = {
//       order: populatedOrder,
//     };

//     io.to(`posOrder-${order.restaurantId}`).emit('new_order', responseData);

    

// if (action === 'print' || action === 'kotandPrint') {
//   try {
//     const printerConfigs = await PRINTER_CONFIG.find({ printerType: 'KOT' }).lean();
    
//     for (const config of printerConfigs) {
//       const { kitchenId, printerName } = config;
//       // For additional orders, only filter the newly added items
//       const itemsToCheck = isAdditionalOrder ? processedItems : order.items;
      
//       const kitchenItems = itemsToCheck.filter(item => {
//         const foodId = item.isCombo ? item.items[0]?.foodId : item.foodId;
//         const food = foodDocs.find(f => f._id.toString() === foodId.toString());
//         return food?.kitchenId?.toString() === kitchenId?.toString();
//       });

//       if (kitchenItems.length > 0) {
//         await printKOTReceipt(order, kitchenItems, printerName, isAdditionalOrder);
//       }
//     }

//     if (ctypeName.includes('Take Away')) {
//       await printTakeawayCustomerReceipt(order, printConfig);
//     }
//   } catch (printError) {
//     console.error('Printing failed:', printError);
//   }
// }

// if (action === 'kot' || action === 'kotandPrint') {
//       const kitchenItemMap = {};

//     const itemsToCheck = isAdditionalOrder ? processedItems : order.items;

//     for (const item of itemsToCheck) {
//       if (item.isCombo) {
//         // For combos, find the kitchen from the first food item
//         const combo = comboMap[item.comboId];
//         if (!combo || !item.items || item.items.length === 0) continue;


//         const kitchen = await KITCHEN.findOne({ restaurantId })
//         const kitchenId = kitchen._id;
//               if (!kitchenId) continue;

//       if (!kitchenItemMap[kitchenId]) kitchenItemMap[kitchenId] = [];

//       // Prepare combo items array
//       const comboItemsArray = item.items.map(comboItem => {
//         const food = foodMap[comboItem.foodId.toString()];
//         return {
//           foodId: food._id,
//           name: comboItem.foodName || food.foodName,
//           portion: comboItem.portion,
//           quantity: comboItem.qty,
//           status: 'Pending',
//           isComboItem: true
//         };
//       });

//       kitchenItemMap[kitchenId].push({
//         foodId: combo._id, // Combo ID as the main identifier
//         name: combo.comboName,
//         quantity: item.qty,
//         status: 'Pending',
//         message: `Combo Order`,
//         isComboItem: true,
//         comboId: combo._id,
//         comboName: combo.comboName,
//         comboItems: comboItemsArray
//       });
//     } else {
//       // Regular food item
//       const food = foodMap[item.foodId.toString()];
//       if (!food?.kitchenId) continue;

//       const kitchenId = food.kitchenId.toString();
//       if (!kitchenItemMap[kitchenId]) kitchenItemMap[kitchenId] = [];

//       kitchenItemMap[kitchenId].push({
//         foodId: item.foodId,
//         name: item.foodName || food.foodName,
//         portion: item.portion,
//         quantity: item.qty,
//         status: 'Pending',
//         message: '',
//         isComboItem: false
//       });
//     }
//   }

//   // Create KOTs for each kitchen
//   for (const [kitchenId, items] of Object.entries(kitchenItemMap)) {
//     const kitchen = await KITCHEN.findById(kitchenId).lean();
//     if (!kitchen) continue;

//     const table = tableId ? await TABLES.findById(tableId).lean() : null;

//     const kotData = {
//       restaurantId,
//       kitchenId,
//       tableId,
//       orderType: ctypeName,
//       items,
//       ticketNo,
//       orderNo,
//       orderId: order._id,
//       order_id: order.order_id,
//       status: 'Pending',
//       orderTime: new Date(),
//       isAdditionalKOT: isAdditionalOrder,
//       message: `New ${ctypeName} Order received${table ? ` for Table ${table.name}` : ''}, Ticket #${ticketNo}`,
//     };

//     const [createdKOT] = await KOT_NOTIFICATION.create([kotData]);
//     // req.io?.to(`kitchen:${kitchenId}`).emit('kot_notification', createdKOT);

//       req.io?.to(`kitchen:${kitchenId}`).emit('kot_status_update',createdKOT);


//      let maxPrepTime = 0; // in minutes

// for (const item of items) {
//   if (item.isComboItem) {
//     // For combo items, take max of inner items
//     for (const comboItem of item.comboItems || []) {
//       const food = foodMap[comboItem.foodId?.toString()];
//       if (food?.preparationTime > maxPrepTime) {
//         maxPrepTime = food.preparationTime;
//       }
//     }
//   } else {
//     const food = foodMap[item.foodId?.toString()];
//     if (food?.preparationTime > maxPrepTime) {
//       maxPrepTime = food.preparationTime;
//     }
//   }
// }

// // ⏲️ Convert minutes to milliseconds
// const msDelay = maxPrepTime * 60 * 1000;

// setTimeout(async () => {
//   try {
//     const kotStatusCheck = await KOT_NOTIFICATION.findById(createdKOT._id);
//     if (!kotStatusCheck || kotStatusCheck.status !== 'Pending') return;

//     kotStatusCheck.status = 'Ready';
//     kotStatusCheck.readyAt = new Date();
//     await kotStatusCheck.save();

//     req.io?.to(`kitchen:${kitchenId}`).emit('kot_status_update', {
//       kotId: kotStatusCheck._id,
//       status: 'Ready',
//       readyAt: kotStatusCheck.readyAt,
//     });
//   } catch (err) {
//     console.error('Auto KOT ready error:', err);
//   }
// }, msDelay);


      


//   }
// }
  
//     return res.status(200).json(responseData);
//   } catch (err) {
//     return next(err);
//   }
// };



 export const printTakeawayCustomerReceipt = async (order, printConfig = {}) => {
  try {
    const popOrder = await ORDER.findById(order._id)
      .populate('restaurantId', 'name address phone mobile trn logo')
      .populate('tableId', 'name')
      .populate('customerTypeId', 'type')
      .lean();

    const customerType = popOrder.customerTypeId?.type || "Order";
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB");
    const timeStr = now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const LINE_WIDTH = 48;
    let txt = '';
    const line = '-'.repeat(LINE_WIDTH);

    // === Header ===
    txt += '\x1B\x61\x01'; // Align center
    txt += '\x1B\x21\x30'; // Bold + Double height + width
    txt += (popOrder.restaurantId?.name || 'RESTAURANT').toUpperCase() + '\n';
    txt += '\x1B\x21\x00';

    if (popOrder.restaurantId?.address) txt += popOrder.restaurantId.address + '\n';
    if (popOrder.restaurantId?.phone)
      txt += `TEL: ${popOrder.restaurantId.phone}, `;
    if (popOrder.restaurantId?.mobile)
      txt += `MOB: ${popOrder.restaurantId.phone2}\n`;
    if (popOrder.restaurantId?.trn)
      txt += `TRN:${popOrder.restaurantId.trn}\n`;

    txt += '\nTAX INVOICE\n';
    txt += `${line}\n`;

    // === Token No. & Type ===
    const typeText = customerType;
    const tokenLine = `Token No. : ${popOrder.orderNo || '-'}`;
    const typeSpacing = LINE_WIDTH - tokenLine.length - typeText.length;
    txt += tokenLine + ' '.repeat(typeSpacing > 0 ? typeSpacing : 1) + typeText + '\n';

    // === Date, Time, Bill ===
    const billDate = `Date : ${dateStr}`;
    const billTime = `Time:${timeStr}`;
    const spacing = LINE_WIDTH - billDate.length - billTime.length;
    txt += billDate + ' '.repeat(spacing > 0 ? spacing : 1) + billTime + '\n';

    const billNo = `Bill No. : ${popOrder.order_id || '-'}`;
    const waiter = `Waiter : ${popOrder.createdBy || '-'}`;
    const spacing2 = LINE_WIDTH - billNo.length - waiter.length;
    txt += billNo + ' '.repeat(spacing2 > 0 ? spacing2 : 1) + waiter + '\n';

    txt += `${line}\n`;
    txt += `Items              Qty.   Price    Amount\n`;
    txt += `${line}\n`;

    let totalQty = 0;
    let total = 0;

    for (const item of popOrder.items) {
      const list = item.isCombo ? item.items : [item];
      for (const it of list) {
        const name = item.isCombo && item.comboName
          ? `${item.comboName}`
          : it.foodName;

        const qty = it.qty?.toString().padStart(2, ' ');
        const price = it.price?.toFixed(2).padStart(6, ' ');
        const amount = it.total?.toFixed(2).padStart(7, ' ');

        txt += name.padEnd(18, ' ') + qty + '   ' + price + '   ' + amount + '\n';
        totalQty += it.qty || 0;
        total += it.total || 0;
      }
    }

    txt += `${line}\n`;
    txt += `Total Before VAT:`.padEnd(34, ' ') + `${(popOrder.subTotal || 0).toFixed(2)}\n`;
    txt += `VAT Incl:`.padEnd(34, ' ') + `${(popOrder.vat || 0).toFixed(2)}\n`;
    txt += `${'-'.repeat(LINE_WIDTH)}\n`;
    txt += `Total :`.padEnd(34, ' ') + `${(popOrder.totalAmount || total).toFixed(2)}\n`;
    txt += `${line}\n`;

    txt += `\nUser: ${popOrder.createdBy || '-'}\n`;
    txt += `Items: ${totalQty.toString().padStart(2, '0')}\n`;
    txt += `\nThank You Visit Again\n\n`;

    txt += '\x1D\x6B\x04'; // Barcode type CODE39
    txt += `${popOrder.order_id || ''}\x00\n`;

    txt += '\n\n\n\x1B\x69'; // Cut paper

    const targetPrinter = printConfig.printerName || printer.getDefaultPrinterName();
    printer.printDirect({
      data: txt,
      printer: targetPrinter,
      type: 'RAW',
      success: jobID => console.log(`Printed Customer Receipt (job ${jobID})`),
      error: err => console.error('Receipt Print failed:', err),
    });
  } catch (err) {
    console.error('Takeaway Receipt Print Error:', err);
  }
};  

  
  async function printCustomerReceipt(order, config) {
    // Implement customer receipt printing
    console.log(`Printing Customer Receipt for Order #${order.orderNo}`);
  }
  


export const printKOTReceipt = async (order, kitchenItems = [], printerName = null,isAdditionalOrder = false) => {
  try {

    const popOrder = await ORDER.findById(order._id)
      .populate('restaurantId', 'name logo')
      .populate('tableId', 'name')
      .populate('customerTypeId', 'type')
      .lean();

    const customerType = popOrder.customerTypeId?.type || "Order";
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB");
    const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    let kitchenName = "Main";
    if (kitchenItems.length) {
      const firstFoodId = kitchenItems[0].isCombo
        ? kitchenItems[0].items[0]?.foodId
        : kitchenItems[0].foodId;
      const food = await FOOD.findById(firstFoodId).lean();
      if (food?.kitchenId) {
        const kitchen = await KITCHEN.findById(food.kitchenId).lean();
        kitchenName = kitchen?.name || "Main";
      }
    }

    const LINE_WIDTH = 40;
    let txt = '';
    const line = '-'.repeat(LINE_WIDTH);

    // === Header ===
txt += '\x1B\x61\x01';    // Align center
txt += '\x1B\x21\x38';   // Bold + double height
txt += (popOrder.restaurantId?.name || 'RESTAURANT').toUpperCase() + '\n';
txt += '\x1B\x21\x00';    // Reset to normal

    if (isAdditionalOrder) {
      txt += '\x1B\x21\x30'; // Bold + Double Height
      txt += 'Additional Order\n';
      txt += '\x1B\x21\x00'; // Reset font
    }

txt += 'Kitchen Order Ticket\n';
txt += `${line}\n`;
txt += `${kitchenName}\n\n`;

// === Token No. (center + bold)
txt += '\x1B\x21\x30'; // Bold + Double Height
txt += `Token No. : ${order.orderNo || '-'}\n`;
txt += '\x1B\x21\x00'; // Reset font
txt += '\n';



    // === KOT + Type (with table if dine-in)
    const kotNo = `KOT No. : ${order.ticketNo || '-'}`;
    const typeText = customerType === "Dine-In"
      ? `${customerType}(${popOrder.tableId?.name || '-'})`
      : customerType;
    const kotSpacing = LINE_WIDTH - kotNo.length - typeText.length;
    txt += kotNo + ' '.repeat(kotSpacing > 0 ? kotSpacing : 1) + typeText + '\n\n';

    // === Date + Time
    const dateLabel = `Date : ${dateStr}`;
    const timeLabel = `Time: ${timeStr}`;
    const dateSpacing = LINE_WIDTH - dateLabel.length - timeLabel.length;
    txt += dateLabel + ' '.repeat(dateSpacing > 0 ? dateSpacing : 1) + timeLabel + '\n\n';

    // === Bill No + Waiter
    const billNo = `Bill No. : ${order.order_id || '-'}`;
    const waiter = `Waiter: ${order.createdBy || '-'}`;
    const billSpacing = LINE_WIDTH - billNo.length - waiter.length;
    txt += billNo + ' '.repeat(billSpacing > 0 ? billSpacing : 1) + waiter + '\n\n';

    txt += `${line}\n`;

    // === Table Headers ===
    txt += `Item${' '.repeat(20 - 4)}Portion     Qty\n`;
    txt += `${line}\n\n`;

    // === Items ===
    let totalQty = 0;
    let totalItems = 0;

    for (const item of kitchenItems) {
      const list = item.isCombo ? item.items : [item];
      for (const it of list) {
        const name = item.isCombo && item.comboName
          ? `${item.comboName}`
          : it.foodName;

        const itemName = name.length > 20 ? name.slice(0, 20) : name.padEnd(20, ' ');
        const portion = (it.portion || '-').padEnd(10, ' ');
        const qty = `x${it.qty}`.padStart(3, ' ');

        txt += `${itemName}${portion}${qty}\n`;
        totalQty += it.qty || 1;
        totalItems++;
      }
    }

    txt += `\n${line}\n`;
    txt += `Item : ${totalItems}`.padEnd(28, ' ') + `Qty. : ${totalQty}\n`;
    txt += `${line}\n`;

    // === Paper feed & cut ===
    txt += '\n'.repeat(5);
    txt += '\x1B\x69';

    const targetPrinter = printerName || printer.getDefaultPrinterName();
    printer.printDirect({
      data: txt,
      printer: targetPrinter,
      type: 'RAW',
      success: jobID => console.log(`Printed KOT (job ${jobID})`),
      error: err => {
        console.error('Print failed:', err);
        throw err;
      }
    });
  } catch (err) {
    console.error('KOT Print Error:', err);
    throw err;
  }
};


export const getTodayOrdersForPOS = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user;

    const user = await USER.findById(userId);
    if (!user) return res.status(403).json({ message: "User not found!" });

    const now = new Date();

    // Fetch orders in parallel with per-order 24h logic
    const [ongoing, completed, cancelled] = await Promise.all([
      // Ongoing: createdAt + 24h > now
      ORDER.find({
        restaurantId,
        status: "Placed",
        $expr: {
          $gt: [
            { $add: ["$createdAt", 1000 * 60 * 60 * 24] }, // createdAt + 24h
            now
          ]
        }
      })
        .select("_id createdAt orderNo orderType order_id restaurantId totalAmount items subMethod")
        .populate({ path: "tableId", select: "name" })
        .populate({ path: "customerTypeId", select: "type" })
        .sort({ createdAt: -1 }),

      // Completed
      ORDER.find({
        restaurantId,
        status: "Completed",
        $expr: {
          $gt: [
            { $add: ["$createdAt", 1000 * 60 * 60 * 24] },
            now
          ]
        }
      })
        .select("_id createdAt orderNo orderType order_id restaurantId totalAmount items subMethod")
        .populate("tableId", "name")
        .sort({ createdAt: -1 }),

      // Cancelled
      ORDER.find({
        restaurantId,
        status: "Cancelled",
        $expr: {
          $gt: [
            { $add: ["$createdAt", 1000 * 60 * 60 * 24] },
            now
          ]
        }
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
    next(err);
  }
};


  export const getOneOrderDetails = async (req, res, next) => {
    try {
      const { orderId } = req.params;
      const userId = req.user; 
  
      // Validate restaurant access
      const user = await USER.findOne({ _id: userId });
      if (!user) return res.status(403).json({ message: "User not found!" });
  
      if(!orderId){
        return res.status(403).json({ message: "Order Id not found!" });
      }
  
  
      const order = await ORDER.findById(orderId)
      .populate({ path: "tableId", select: "name" })
      .populate({ path: "customerTypeId", select: "type" })
        .populate({
        path: "items.foodId",
        select: "image",
        options: { strictPopulate: false } // prevents error if foodId is null
      })
      .populate({
        path: "items.comboId",
        select: "image",
        options: { strictPopulate: false } // prevents error if comboId is null
      })
      .lean();
      if(!order){
        return res.status(400).json({ message:'Order not found!'})
      }
  
      return res.status(200).json({ data:order })
  
    } catch (err) {
      return next(err);
    }
  };


export const generateUniqueRefId = async () => {
  let refId;
  let isUnique = false;

  while (!isUnique) {
    const randomNum = Math.floor(100000 + Math.random() * 900000); // 6 digit number
    refId = `REF${randomNum}`;
    
    const exists = await TRANSACTION.exists({ referenceId: refId });
    if (!exists) isUnique = true;
  }

  return refId;
};


  export const posOrderBilling = async (req,res,next)=>{
    try {
  
      const {
        restaurantId,
        orderId,
        customerId, // optional
        accounts, 
        grandTotal,
        dueAmount = 0 // default to 0 if not provided
      } = req.body;
  
  
  
      const userId = req.user;
  
       // Validate user
      const user = await USER.findOne({ _id: userId }).lean();
      if (!user) return res.status(400).json({ message: "User not found" });
  
      if(!restaurantId){
        return res.status(400).json({ message: "Restaurnat Id not found!" })
      }
  
          // Get and validate order
          const order = await ORDER.findOne({
            _id: orderId,
            status: { $nin: ['Completed', 'Cancelled'] }
          })
      
          if (!order) {
            return res.status(404).json({ message: "Order not found or already completed/cancelled" });
          }
          console.log(accounts,'accounts')

               const notValuePaidTypes = ['Credit'];
  
              // Validate payment amounts
               const paidAmount = accounts.reduce((sum, acc) => {
                  if (notValuePaidTypes.includes(acc.accountType)) return sum;
                  return sum + acc.amount;
                }, 0);
            
  
      
  
      if (dueAmount > 0) {
        if (!customerId) {
          return res.status(400).json({ message: "Customer Id  required for due payments" });
        }
  
        const customer = await CUSTOMER.findById(customerId)
        if (!customer) {
          return res.status(400).json({ message: "Customer not found" });
        }
  
        // Update customer credit
       const previousBalance = customer.credit || 0;
        customer.credit = previousBalance + dueAmount;
        customer.totalSpend += paidAmount;
        await customer.save();

      }
  
          // Create payment records
const paymentRecord = {
  restaurantId,
  orderId,
  methods: accounts.map(acc => ({
    accountId: acc.accountId,
    amount: acc.amount,
  })),
  grandTotal,
  paidAmount,
  dueAmount ,
  createdById: userId,
  createdBy:user.name,

};
      
     await PAYMENT.create([paymentRecord]);


   // Add a Transaction for each account used
    for (const acc of accounts) {

      const refId = await generateUniqueRefId();
      
      await TRANSACTION.create({
        restaurantId,
        accountId: acc.accountId,
        amount: acc.amount,
        type: "Credit",
        description: `POS Sale for Order ${order.order_id}`,
        referenceId: refId,
        referenceType: 'Sale',
        customerId: customerId || null,
        createdById: userId,
        createdBy:user.name,

       
      });
    }
  
             // Update order status
      order.status = "Completed";
      order.customerId = customerId || null;
      order.paymentStatus = dueAmount > 0 ? "Partial" : "Paid";
      await order.save();
  
  
        // Handle table status if dine-in
      if (order.orderType.includes("Dine-In") && order.tableId) {
        const updatedTable = await TABLES.findOneAndUpdate(
          { _id: order.tableId },
          {
            currentStatus: 'Available',
            currentOrderId: null,
            totalAmount: 0,
            runningSince: null
          },
          { new: true }
        ).lean();
  
        // Emit table update
        const io = getIO();
        io.to(`posTable-${order.restaurantId}`).emit('single_table_update', updatedTable);
      }
  
      const updatedOrder= await ORDER.findOneAndUpdate(
        { _id: order._id },
        {
          status: 'Completed'
        },
        { new: true}
      )
      .populate("tableId", "name")
          .populate("customerId", "name mobileNo")
          .lean();

      // Emit order completion
      const io = getIO();
      io.to(`posOrder-${order.restaurantId}`).emit('order_completed', {order: updatedOrder });

      return res.status(200).json({ 
        message: 'Order settled successfully',
      });
      
    } catch (err) {
     return next(err)
    }
  }




  async function generateCustomerBillForDineIn(orderId) {
  const order = await ORDER.findById(orderId).lean();
  if (!order) throw new Error("Order not found");

  const restaurant = await RESTAURANT.findById(order.restaurantId).lean();
  const table = await TABLES.findById(order.tableId).lean();
  const customerType = await CUSTOMER_TYPE.findById(order.customerTypeId).lean();

  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Start Printing
  printer.clear();
  printer.alignCenter();
  printer.setTextDoubleHeight();
  printer.println(restaurant?.name?.toUpperCase() || "RESTAURANT");
  printer.setTextNormal();
  if (restaurant?.phone) printer.println(`Tel: ${restaurant.phone}`);
  if (restaurant?.trn) printer.println(`Trn:${restaurant.trn}`);
  printer.drawLine();

  printer.println(customerType?.type || "Dine-in");
  printer.drawLine();

  // Bill info
  printer.alignLeft();
  printer.println(`Bill No. : ${order.order_id || "-"}`);
  printer.println(`Table No. : ${table?.name || "-"}`);
  printer.println(`Bill Date : ${dateStr}  ${timeStr}`);
  printer.println(`Operator Id. : ${order.createdBy || "Admin"}`);
  printer.println(`Payment Mode : cash`);
  printer.println(`Table No. : ${table?.name || "-"}`);

  printer.drawLine();

  // Item headers
  printer.tableCustom([
    { text: "Item", align: "LEFT", width: 0.30 },
    { text: "Portion", align: "CENTER", width: 0.20 },
    { text: "Rate", align: "RIGHT", width: 0.15 },
    { text: "Qty.", align: "RIGHT", width: 0.15 },
    { text: "Amount", align: "RIGHT", width: 0.20 },
  ]);

  printer.drawLine();

  let totalQty = 0;
  let itemCount = 0;

  for (const item of order.items) {
    if (item.isCombo) {
      printer.tableCustom([
        { text: item.comboName, align: "LEFT", width: 0.5 },
        { text: "-", align: "CENTER", width: 0.2 },
        { text: item.comboPrice.toFixed(2), align: "RIGHT", width: 0.15 },
        { text: `x${item.qty}`, align: "RIGHT", width: 0.15 },
        { text: item.total.toFixed(2), align: "RIGHT", width: 0.2 },
      ]);
    } else {
      printer.tableCustom([
        { text: item.foodName, align: "LEFT", width: 0.3 },
        { text: item.portion || "-", align: "CENTER", width: 0.2 },
        { text: item.price.toFixed(2), align: "RIGHT", width: 0.15 },
        { text: `x${item.qty}`, align: "RIGHT", width: 0.15 },
        { text: item.total.toFixed(2), align: "RIGHT", width: 0.2 },
      ]);
    }

    totalQty += item.qty;
    itemCount++;
  }

  printer.drawLine();
  printer.tableCustom([
    { text: `Item : ${itemCount}`, align: "LEFT", width: 0.5 },
    { text: `Qty. : ${totalQty}`, align: "RIGHT", width: 0.5 },
  ]);
  printer.newLine();

  // Totals
  printer.alignRight();
  printer.println(`Sub Total : ${order.subTotal?.toFixed(2) || "0.00"}`);
  printer.println(`VAT ${order.vat || 0}% : ${(order.subTotal * (order.vat / 100)).toFixed(2)}`);
  printer.println(`Grand Total : AED${order.totalAmount.toFixed(2)}`);

  printer.newLine();
  printer.alignCenter();
  printer.println("Thank you! Visit Again");

  printer.cut();

  const isConnected = await printer.isPrinterConnected();
  if (isConnected) {
    await printer.execute();
    console.log(`✅ Customer bill printed for table: ${table?.name}`);

    if (order.tableId) {
  const updatedTable = await TABLES.findOneAndUpdate(
    { _id: order.tableId },
    {
      currentStatus: 'VacatingSoon',
      totalAmount: order.totalAmount,
    },
    { new: true }
  ).lean();

  // Notify POS via socket
  const io = getIO();
  io.to(`posTable-${order.restaurantId}`).emit('single_table_update', updatedTable);

    }

    


  } else {
    console.error(" Printer not connected.");
  }
}


export const cancelOrder = async(req,res,next)=>{
  try {

    const { orderId } = req.body

      

      const userId = req.user;
  
       // Validate user
      const user = await USER.findOne({ _id: userId }).lean();
      if (!user) return res.status(400).json({ message: "User not found" });

      // Validate order
      const order = await ORDER.findOne({ _id: orderId }).lean();
      if (!order) return res.status(400).json({ message: "Order not found" });

      if (order.status === "Cancelled") return res.status(400).json({ message: "Order already cancelled" });

      if (order.status === "Completed") return res.status(400).json({ message: "Completed order cannot be cancelled" });

         const updatedOrder = await ORDER.findByIdAndUpdate(
            orderId,
            { status: "Cancelled" },
            { new: true }
          )
          .populate("tableId", "name")
          .populate("customerId", "name mobileNo")
          .lean();

          // Emit to POS
          const io = getIO();
          io.to(`posOrder-${order.restaurantId}`).emit('order_cancelled', { order: updatedOrder });

        // If table is linked, reset its status
    if (order.tableId) {
      const updatedTable = await TABLES.findOneAndUpdate(
        { _id: order.tableId, currentOrderId: order._id },
        {
          currentStatus: "Available",
          currentOrderId: null,
          totalAmount: 0,
          runningSince: null
        },
        { new: true }
      ).lean();

      // Send socket update to POS
      const io = getIO();
      io.to(`posTable-${order.restaurantId}`).emit("single_table_update", updatedTable);
    }

    return res.status(200).json({
      message: "Order cancelled successfully",
    });

  } catch (err) {
    next(err)
  }
}


export const changeTable = async(req,res,next)=>{
  try {

      const { orderId, tableId } = req.body;
       const userId = req.user;

          const user = await USER.findOne({ _id: userId }).lean();
      if (!user) return res.status(400).json({ message: "User not found" });

       if(!orderId){
        return res.status(400).json({ message:'Order not found!'})
       }

       if(!tableId){
        return res.status(400).json({ message:"Table Id not found!"})
       }

     // 1. Fetch order and validate
    const order = await ORDER.findOne({_id:orderId});
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const oldTableId  = order.tableId;

     if (!oldTableId ) {
      return res.status(400).json({ message: 'This order is not associated with any table' });
    }

       if (oldTableId.toString() === tableId) {
      return res.status(400).json({ message: 'New table must be different from current table' });
    }

       // 2. Check if new table is available
    const newTable = await TABLES.findOne({
      _id: tableId,
      currentStatus: 'Available',
    });

    if (!newTable) {
      return res.status(400).json({ message: 'New table is not available' });
    }

        // 4. Update new table: set to Running
    const updatedNewTable = await TABLES.findByIdAndUpdate(
      tableId,
      {
        $set: {
          currentStatus: 'Running',
          currentOrderId: order._id,
          totalAmount: order.totalAmount,
          runningSince: order.createdAt,
        }
      },
      { new: true }
    );

    console.log(updatedNewTable,'updated')

    order.tableId = tableId;
    await order.save();
  
        // 5. Set old table to Available
    const updatedOldTable = await TABLES.findByIdAndUpdate(
      oldTableId,
      {
        $set: {
          currentStatus: 'Available',
          currentOrderId: null,
          totalAmount: 0,
          runningSince: null
        }
      },
      { new: true }
    );

    console.log(updatedOldTable,'old')

      // 6. Emit real-time updates for both tables
    const io = getIO();
    io.to(`posTable-${order.restaurantId}`).emit('single_table_update', updatedNewTable);
    io.to(`posTable-${order.restaurantId}`).emit('single_table_update', updatedOldTable);

const populatedOrder = await ORDER.findById(order._id)
  .populate("tableId", "name")
  .populate("customerId", "name mobileNo")
  .lean();

io.to(`posOrder-${order.restaurantId}`).emit('table_change', { order: populatedOrder });

    return res.status(200).json({ message: 'Table changed successfully' });
    
  } catch (err) {
    next(err)
  }
}



