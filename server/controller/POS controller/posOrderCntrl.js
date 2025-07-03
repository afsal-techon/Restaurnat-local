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
import { printer as ThermalPrinter, types as PrinterTypes } from "node-thermal-printer";




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
    const lastOrder = await ORDER.findOne({ orderNo: { $regex: /^\d{2}$/ } })
    .sort({ createdAt: -1 })
    .select("orderNo");
  
    const lastNumber = parseInt(lastOrder?.orderNo) || 0;
    return (lastNumber + 1).toString().padStart(2, '0');
  };


const printer = new ThermalPrinter({
  type: PrinterTypes.EPSON,
  interface: 'usb', // Or 'tcp://192.168.x.x' if network printer
  width: 48,
  characterSet: 'SLOVENIA',
  removeSpecialCharacters: false,
  lineCharacter: "-",
});






  export const createOrder = async(req,res,next)=>{
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
        discount,
        action = 'create', // 'create', 'kot', 'save', 'kot_print'
        printConfig = {} // Printer settings for KOT print
      } = req.body;
  
    
  
      const userId = req.user;
      let isAdditionalOrder = Boolean(orderId);
      console.log(isAdditionalOrder,'additional roder')
  
      // 2. Validate User and Basic Parameters
      const user = await USER.findOne({ _id: userId }).lean();
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }
  
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'No items in order' });
      }
  
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
              restaurantId: restaurantId 
            }).lean(),
            COMBO.find({
              _id: { $in: comboIds },
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


                      // Get the first food item's name to use as the foodName
            const firstFoodItemId = item.items[0]?.foodId;
            const firstFoodItem = foodMap[firstFoodItemId];
            if (!firstFoodItem) throw new Error(`Invalid food item in combo: ${firstFoodItemId}`);


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
                discount:comboItem.discountAmount || 0,
                choices: [],
                isAdditional: isAdditionalOrder,
                conversionFactor: conversion,
                isComboItem: true,
                comboId: combo._id,
                comboName: combo.comboName
              };
            }));
    
                   return {
                  foodId: combo._id, // Using combo ID as foodId for schema validation
                  foodName: firstFoodItem.foodName, // Using combo name as foodName
                  price: item.comboPrice || combo.comboPrice, // Ensure price is set
                  comboPrice: item.comboPrice || combo.comboPrice,
                  qty: item.qty ?? 1,
                  total: item.total,
                  discount: item.discountAmount || 0,
                  addOns: item.addOns || [],
                  choices: [],
                  isAdditional: isAdditionalOrder,
                  conversionFactor: 1, // Default for combo
                  isCombo: true,
                  comboId: combo._id,
                  comboName: combo.comboName,
                  items: comboItems // Nested combo items
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
          discount: item.discountAmount || 0,
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
        })
  
        if (!order) {
          return res.status(404).json({ message: "Order not found or cannot be modified" });
        }
  
        ctypeName = order.orderType;
      } else {
        // New Order Flow
        const custType = await CUSTOMER_TYPE.findById(customerTypeId).lean();
        if (!custType) {
          return res.status(400).json({ message: 'Invalid customer type' });
        }
  
        ctypeName = custType.type;
        const generatedOrderId = await generateOrderId();
         ticketNo = await getNextTicketNo();
         orderNo = await getNextOrderNo();
  
        // Generate Ticket/Order No based on order type
        // if (ctypeName.includes("Dine-In")) {
        //   ticketNo = await getNextTicketNo();
        // } else if (ctypeName.includes("Take Away")) {
        //   ticketNo = await getNextTicketNo();
        //   orderNo = await getNextOrderNo();
        // }
  
        [order] = await ORDER.create([{
          restaurantId,
          tableId,
          customerTypeId,
          subMethod,
          items: [], // Will be populated after validation
          discount: discount || 0,
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
          
        }]);
      }
  
  
      // 6. Update Order with Items
      if (isAdditionalOrder) {
        order.items.push(...processedItems);
        order.totalAmount += processedItems.reduce((sum, item) => sum + item.total, 0);
      } else {
        order.items = processedItems;
      }
      await order.save();

  
      // 7. Handle Table Status for Dine-In
      if (ctypeName.includes("Dine-In") && tableId) {
        const table = await TABLES.findById(tableId)
        if (!table) {
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
          { new: true }
        ).lean();
  
        const io = getIO();
        io.to(`posTable-${order.restaurantId}`).emit('single_table_update', updatedTable);
      }
  
      const shouldPrint = action === 'print';
  
      // 7. Handle Printing
      if (shouldPrint) {
        try {
          if (ctypeName.includes("Take Away")) {
            // Takeaway printing - KOT and Customer Receipt
            await printTakeawayKOT(order, printConfig); // Kitchen copy
            await printTakeawayCustomerReceipt(order, printConfig); // Customer copy
          } else {
            // Dine-In printing
            // await printKOTReceipt(order, printConfig); // Only KOT
          }
        } catch (printError) {
          console.error('Printing failed:', printError);
          // Continue even if printing fails
        }
      }

  
      // 9. Prepare Response
      const populatedOrder = await ORDER.findById(order._id)
        .populate("tableId", "name")
        .populate("customerId", "name mobileNo")
        .lean();
  
      // Emit real-time updates
      const io = getIO();
      const responseData = {
        order: populatedOrder,  // Always nest under 'order' for consistency
      };
      
      io.to(`posOrder-${order.restaurantId}`).emit('new_order', responseData);
  
      return res.status(200).json(responseData);

  
    } catch (err) {
      return next(err);
    }
  }


  async function printTakeawayCustomerReceipt(order, config) {
    // Implement thermal printer logic for kitchen KOT
    console.log(`Printing Takeaway KOT for Order #${order.orderNo}`);
  }
  
  async function printCustomerReceipt(order, config) {
    // Implement customer receipt printing
    console.log(`Printing Customer Receipt for Order #${order.orderNo}`);
  }
  

async function printKOTReceipt(order, restaurant) {
  const customerTypeDoc = await CUSTOMER_TYPE.findById(order.customerTypeId).lean();
  const customerType = customerTypeDoc?.type || "Order";

  const kitchenWiseItems = {}; // { kitchenId: { name, items[] } }

  for (const item of order.items) {
    let food;

    if (item.isCombo) {
      for (const comboItem of item.items) {
        food = await FOOD.findById(comboItem.foodId).lean();
        if (!food) continue;

        const kitchenId = food.kitchenId?.toString() || "default";

        if (!kitchenWiseItems[kitchenId]) {
          const kitchen = await KITCHEN.findById(kitchenId).lean();
          kitchenWiseItems[kitchenId] = {
            name: kitchen?.name || "Main",
            items: [],
          };
        }

        kitchenWiseItems[kitchenId].items.push({
          foodName: food.foodName,
          portion: comboItem.portion || "_",
          qty: comboItem.qty || 1,
          isCombo: true,
          comboName: item.comboName,
        });
      }
    } else {
      food = await FOOD.findById(item.foodId).lean();
      if (!food) continue;

      const kitchenId = food.kitchenId?.toString() || "default";

      if (!kitchenWiseItems[kitchenId]) {
        const kitchen = await KITCHEN.findById(kitchenId).lean();
        kitchenWiseItems[kitchenId] = {
          name: kitchen?.name || "Main",
          items: [],
        };
      }

      kitchenWiseItems[kitchenId].items.push({
        foodName: food.foodName,
        portion: item.portion || "_",
        qty: item.qty || 1,
        isCombo: false,
      });
    }
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  for (const [kitchenId, { name: kitchenName, items }] of Object.entries(kitchenWiseItems)) {
    printer.clear();
    printer.alignCenter();
    printer.setTextDoubleHeight();
    printer.println(restaurant.name.toUpperCase());
    printer.setTextNormal();
    printer.println(`Kitchen Order Ticket (${customerType})`);
    printer.drawLine();

    printer.setTextBold();
    printer.println(kitchenName || "Main");
    printer.setTextNormal();

    printer.alignLeft();
    printer.println(`Ticket No. : KOT-${order.ticketNo || "N/A"}`);

    // Conditionally show table or order number
    if (customerType.toLowerCase() === "dine-in") {
        const table = await TABLES.findById(order.tableId).lean();
     const tableName = table?.name || "-";
  printer.println(`Table No. : ${tableName}`);
    } else if (customerType.toLowerCase() === "takeaway") {
      printer.println(`Order No. : ${order.orderNo || "-"}`);
    }

    printer.println(`Date&Time : ${dateStr}     ${timeStr}`);
    printer.println(`Operator Id. : ${order.createdBy || "Admin"}`);
    printer.newLine();

    printer.tableCustom([
      { text: "Item", align: "LEFT", width: 0.5 },
      { text: "Portion", align: "CENTER", width: 0.25 },
      { text: "Qty.", align: "RIGHT", width: 0.25 },
    ]);
    printer.drawLine();

    let totalQty = 0;

    items.forEach(({ foodName, portion, qty, isCombo, comboName }) => {
      const itemName = isCombo && comboName ? `${comboName} > ${foodName}` : foodName;

      printer.tableCustom([
        { text: itemName, align: "LEFT", width: 0.5 },
        { text: portion, align: "CENTER", width: 0.25 },
        { text: `x${qty}`, align: "RIGHT", width: 0.25 },
      ]);

      totalQty += qty;
    });

    printer.drawLine();
    printer.tableCustom([
      { text: `Item : ${items.length}`, align: "LEFT", width: 0.5 },
      { text: `Qty. : ${totalQty}`, align: "RIGHT", width: 0.5 },
    ]);

    printer.newLine();
    printer.alignCenter();
    printer.println(`Served By  ${order.counterId ? `POS ${order.counterId}` : "POS 1"}`);

    printer.cut();

    const isConnected = await printer.isPrinterConnected();
    if (isConnected) {
      await printer.execute();
      console.log(`✅ Printed KOT for Kitchen: ${kitchenName}`);
    } else {
      console.error("❌ Printer not connected.");
    }
  }
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
          status: "Placed"
        })
        .select("_id createdAt orderNo orderType order_id restaurantId totalAmount items subMethod")
           .populate({ path: "tableId", select: "name" })
           .populate({ path: "customerTypeId", select: "type" })
          .sort({ createdAt: -1 }), // Newest first
        
        // Completed orders
        ORDER.find({
          restaurantId,
          createdAt: { $gte: todayStart, $lte: todayEnd },
          status: "Completed",
          
        })
        .select("_id createdAt orderNo orderType order_id restaurantId totalAmount items subMethod")
          .populate("tableId", "name")
          .sort({ createdAt: -1 }),
        
        // Cancelled orders
        ORDER.find({
          restaurantId,
          createdAt: { $gte: todayStart, $lte: todayEnd },
          status: "Cancelled",
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

               const notValuePaidTypes = ['Due'];
  
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
        createdById: userId,
       
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
    console.error("❌ Printer not connected.");
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