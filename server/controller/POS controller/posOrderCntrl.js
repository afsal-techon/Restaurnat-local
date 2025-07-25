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
import { ThermalPrinter, PrinterTypes } from "node-thermal-printer";
import fs from "fs/promises";
import moment from 'moment'
import sharp from "sharp";
import { fileURLToPath } from 'url';
import { dirname, join ,basename } from 'path';
import { existsSync ,mkdirSync } from "fs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import agenda from '../../config/agenda.js'
import POS_SETTINGS from '../../model/posSettings.js'
import { updateTable } from "../Restaurant/floors&tables.js";





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

    console.log(deliveryDetails,'deliver')

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
      .lean();

    const io = getIO();
    const responseData = {
      order: populatedOrder,
    };

    io.to(`posOrder-${order.restaurantId}`).emit('new_order', responseData);

    const posSettings = await POS_SETTINGS.findOne({ restaurantId }).lean();
const shouldSendKOT = (
  (action === 'save' && posSettings?.isKotSave) ||
  (action === 'print' && posSettings?.isKotPrint)
);


if (action === 'print') {
  try {
          const printerConfigs = await PRINTER_CONFIG.find({
          $or: [
            { printerType: 'KOT' },
            { isUniversal: true }
          ]
        }).lean();
    const kitchenItemMap = {};

    const itemsToCheck = isAdditionalOrder ? processedItems : order.items;

    // 1️ Group items by kitchenId
    for (const item of itemsToCheck) {
      if (item.isCombo) {
        const combo = comboDocs.find(c => c._id.toString() === item.comboId.toString());
        if (!combo || !item.items?.length) continue;

        const firstComboFood = foodDocs.find(f => f._id.toString() === item.items[0].foodId.toString());
        if (!firstComboFood || !firstComboFood.kitchenId) continue;

        const kitchenId = firstComboFood.kitchenId.toString();
        if (!kitchenItemMap[kitchenId]) kitchenItemMap[kitchenId] = [];

        const comboItemsArray = item.items.map(comboItem => {
          const food = foodDocs.find(f => f._id.toString() === comboItem.foodId.toString());
          return {
            foodId: comboItem.foodId,
            name: comboItem.foodName || food?.foodName || "Unknown",
            portion: comboItem.portion,
            quantity: comboItem.qty,
            status: "Pending",
            isComboItem: true,
          };
        });

        kitchenItemMap[kitchenId].push({
          isComboItem: true,
          comboId: combo._id,
          comboName: combo.comboName,
          qty: item.qty,
          comboItems: comboItemsArray,
        });
      } else {
        const food = foodDocs.find(f => f._id.toString() === item.foodId.toString());
        if (!food || !food.kitchenId) continue;

        const kitchenId = food.kitchenId.toString();
        if (!kitchenItemMap[kitchenId]) kitchenItemMap[kitchenId] = [];

        kitchenItemMap[kitchenId].push({
          foodId: item.foodId,
          name: item.foodName || food.foodName,
          portion: item.portion,
          quantity: item.qty,
          isComboItem: false,
        });
      }
    }

    // 2️ KOT Printing for each kitchenId
    for (const [kitchenId, items] of Object.entries(kitchenItemMap)) {
      let matchedPrinter = printerConfigs.find(p => p.kitchenId?.toString() === kitchenId);
      if (!matchedPrinter) {
       matchedPrinter = await PRINTER_CONFIG.findOne({ isUniversal: true });
      }

      if (matchedPrinter) {
        await printKOTReceipt(order, items, matchedPrinter.printerIp, isAdditionalOrder);
      } else {
        console.warn(`No printer found for kitchenId ${kitchenId} and no universal fallback.`);
      }
    }

    // 3️ Customer-Type based printing (Take Away, Delivery, Online)
        let customerPrinters = await PRINTER_CONFIG.find({
      $or: [
        { printerType: 'CustomerType', customerTypeId: order.customerTypeId },
        { isUniversal: true }
      ]
    });

    const shouldPrintCustomerBill =
      ctypeName.includes("Take Away") ||
      ctypeName.includes("Home Delivery") ||
      ctypeName.includes("Online");

    if (shouldPrintCustomerBill && customerPrinters.length > 0) {
      for (const printer of customerPrinters) {
        await printTakeawayCustomerReceipt(order, printer.printerIp);
      }
    } else if (shouldPrintCustomerBill) {
      console.warn('No customer printer configured and no universal fallback.');
    }

  } catch (printError) {
    console.error('Printing failed:', printError);
  }
}




if (shouldSendKOT) {
  const kitchenItemMap = {};
  const itemsToCheck = isAdditionalOrder ? processedItems : order.items;

  for (const item of itemsToCheck) {
    if (item.isCombo) {
      const combo = comboMap[item.comboId];
      if (!combo || !item.items?.length) continue;

      const kitchen = await KITCHEN.findOne({ restaurantId });
      const kitchenId = kitchen?._id?.toString();
      if (!kitchenId) continue;

      if (!kitchenItemMap[kitchenId]) kitchenItemMap[kitchenId] = [];

      const comboItemsArray = item.items.map(comboItem => {
        const food = foodMap[comboItem.foodId.toString()];
        return {
          foodId: food._id,
          name: comboItem.foodName || food.foodName,
          portion: comboItem.portion,
          quantity: comboItem.qty,
          status: 'Pending',
          isComboItem: true,
          preparationTime: food.preparationTime || 0
        };
      });

      kitchenItemMap[kitchenId].push({
        foodId: combo._id,
        name: combo.comboName,
        quantity: item.qty,
        status: 'Pending',
        message: 'Combo Order',
        isComboItem: true,
        comboId: combo._id,
        comboName: combo.comboName,
        comboItems: comboItemsArray
      });
    } else {
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
        isComboItem: false,
        preparationTime: food.preparationTime || 0
      });
    }
  }

  const allKitchenIds = Object.keys(kitchenItemMap);
  const kitchens = await KITCHEN.find({ _id: { $in: allKitchenIds } }).lean();
  const kitchenMap = Object.fromEntries(kitchens.map(k => [k._id.toString(), k]));

  const table = tableId ? await TABLES.findById(tableId).lean() : null;

  for (const [kitchenId, items] of Object.entries(kitchenItemMap)) {
    const kitchen = kitchenMap[kitchenId];
    if (!kitchen) continue;

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

    req.io?.to(`kitchen:${kitchenId}`).emit('kot_status_update', createdKOT);

    // Get max preparation time
    const maxPrepTime = Math.max(
      ...items.map(i => {
        if (i.isComboItem) {
          return Math.max(...(i.comboItems?.map(ci => ci.preparationTime || 0) || [0]));
        }
        console.log(i.preparationTime,'perepera')
        return i.preparationTime || 0;
      })
    );

    const readyAt = new Date(Date.now() + maxPrepTime * 60 * 1000);
    const rejectAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await agenda.schedule(readyAt, 'mark kot as ready', { kotId: createdKOT._id });
    await agenda.schedule(rejectAt, 'reject kot after 24 hours', { kotId: createdKOT._id });
  }
}

  
    return res.status(200).json(responseData);
  } catch (err) {
    return next(err);
  }
};


export const printKOTReceipt = async (order, kitchenItems = [], printerIp = null, isAdditionalOrder = false) => {
  try {
     if (!printerIp) return res.status(400).json({ message:"No printer IP provided"})
    console.log(printerIp, 'printerip');

    const printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: `tcp://${printerIp}`,
      characterSet: "SLOVENIA",
      removeSpecialCharacters: false,
      lineCharacter: "-",
      options: { timeout: 5000 },
    });

    const popOrder = await ORDER.findById(order._id)
      .populate("restaurantId", "name logo")
      .populate("tableId", "name")
      .populate("customerTypeId", "type")
      .lean();

    const customerType = popOrder.customerTypeId?.type || "Order";
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB");
    const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    let kitchenName = "Main";
    if (kitchenItems.length) {
      const sampleItem = kitchenItems.find(it => !it.isComboItem) || kitchenItems[0];
      const foodId = sampleItem.isComboItem
        ? sampleItem.comboItems[0]?.foodId
        : sampleItem.foodId;

      const food = await FOOD.findById(foodId).lean();
      if (food?.kitchenId) {
        const kitchen = await KITCHEN.findById(food.kitchenId).lean();
        kitchenName = kitchen?.name || "Main";
      }
    }

    const LINE_WIDTH = 40;
    printer.alignCenter();

    // Header
    printer.setTextDoubleWidth();
    printer.println((popOrder.restaurantId?.name || "RESTAURANT").toUpperCase());
    printer.setTextNormal();



printer.println("Kitchen Order Ticket");
printer.bold(false);

    printer.drawLine();
    printer.println(kitchenName);
    printer.drawLine();

    // Token No
    printer.setTextDoubleWidth();
    printer.println(`Token No. : ${order.orderNo || "-"}`);
    printer.setTextNormal();
    printer.newLine();

      if (isAdditionalOrder) {
      printer.bold(true);
      printer.println("Additional Order");
      printer.setTextNormal();
      printer.newLine();
    }

    // Order Type & KOT No
    const kotNo = `KOT No. : ${order.ticketNo || "-"}`;
    const typeText =
      customerType === "Dine-In"
        ? `${customerType}(${popOrder.tableId?.name || "-"})`
        : customerType;
    printer.alignLeft();
    printer.println(`${kotNo}${" ".repeat(LINE_WIDTH - kotNo.length - typeText.length)}${typeText}`);

    // Date & Time
    const dateLabel = `Date : ${dateStr}`;
    const timeLabel = `Time: ${timeStr}`;
    printer.println(`${dateLabel}${" ".repeat(LINE_WIDTH - dateLabel.length - timeLabel.length)}${timeLabel}`);

    // Bill & Waiter
    const billNo = `Bill No. : ${order.order_id || "-"}`;
    const waiter = `Waiter: ${order.createdBy || "-"}`;
    printer.println(`${billNo}${" ".repeat(LINE_WIDTH - billNo.length - waiter.length)}${waiter}`);

    // Items Header
    printer.drawLine();
    printer.setTextNormal();
    printer.println(`Item${" ".repeat(20 - 4)}Portion     Qty`);
    printer.drawLine();

    // Print Items
    let totalQty = 0;
    let totalItems = 0;

    for (const item of kitchenItems) {
      if (item.isComboItem) {
        // Print Combo Name
          const comboLabel = `Combo: ${item.comboName}`;
      const comboName = comboLabel.length > 30
        ? comboLabel.slice(0, 20)
        : comboLabel.padEnd(20, " ");

      const comboQty = `x${item.qty}`.padStart(3, " ");

      printer.bold(true);
      printer.println(`${comboName}${"-".padEnd(10)}${comboQty}`);
      printer.bold(false);
        printer.setTextNormal();

        for (const it of item.comboItems) {
          const itemName = it.name.length > 18
            ? it.name.slice(0, 18)
            : `  ${it.name.padEnd(18, " ")}`; // Indent
          const portion = (it.portion || "-").padEnd(10, " ");
          const totalComboItemQty = it.quantity * item.qty;
          const qty = `x${totalComboItemQty}`.padStart(3, " ");

          printer.println(`${itemName}${portion}${qty}`);
          totalQty += totalComboItemQty|| 1;
          totalItems++;
        }
      } else {
        const name = item.name;
        const itemName = name.length > 20 ? name.slice(0, 20) : name.padEnd(20, " ");
        const portion = (item.portion || "-").padEnd(10, " ");
        const qty = `x${item.quantity}`.padStart(3, " ");

        printer.println(`${itemName}${portion}${qty}`);
        totalQty += item.quantity || 1;
        totalItems++;
      }
    }

    // Totals
    printer.println("");
    printer.drawLine();
    printer.println(`Item : ${totalItems}`.padEnd(28, " ") + `Qty. : ${totalQty}`);
    printer.drawLine();

    // Footer & cut
    printer.cut();

    const isConnected = await printer.isPrinterConnected();
    if (!isConnected) throw new Error("Printer is not connected");

    await printer.execute();
    console.log("KOT Printed successfully");
  } catch (err) {
    console.error("KOT Print Error:", err.message);
    throw err;
  }
};


export const printTakeawayCustomerReceipt = async (order, printerIp = null) => {
  try {
    if (!printerIp) return res.status(400).json({ message:"No printer IP provided"})

    const popOrder = await ORDER.findById(order._id)
      .populate("restaurantId", "name address phone mobile trn logo")
      .populate("tableId", "name")
      .populate("customerTypeId", "type")
      .lean();

    const customerType = popOrder.customerTypeId?.type || "Order";
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB");
    const timeStr = now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: `tcp://${printerIp}`,
      characterSet: "SLOVENIA",
      removeSpecialCharacters: false,
      lineCharacter: "-",
      options: { timeout: 5000 },
    });

  if (popOrder.restaurantId?.logo) {

      const tmpDir = join(__dirname, "../../tmp");
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  }

  const originalLogoPath = join(__dirname, "../../", popOrder.restaurantId.logo);
  const processedLogoPath = join(tmpDir, `processed_${basename(originalLogoPath)}`);

  if (!existsSync(processedLogoPath)) {
    await sharp(originalLogoPath)
      .resize({ width: 180 })       // try smaller width
      .threshold(180)               // higher contrast
      .png()
      .toFile(processedLogoPath);
  }

  printer.alignCenter();
  await printer.printImage(processedLogoPath);  // this expects file path
  printer.newLine();
    }

    // Restaurant name – bold and a little bigger
     printer.setTextDoubleWidth();
    printer.println((popOrder.restaurantId?.name || "RESTAURANT").toUpperCase());
    printer.setTextNormal();

    // Contact details
    if (popOrder.restaurantId?.address) printer.println(popOrder.restaurantId.address);
    let contact = "";
    if (popOrder.restaurantId?.phone) contact += `TEL:${popOrder.restaurantId.phone}`;
    if (popOrder.restaurantId?.mobile) contact += `, MOB:${popOrder.restaurantId.mobile}`;
    if (contact) printer.println(contact);
    if (popOrder.restaurantId?.trn) printer.println(`TRN:${popOrder.restaurantId.trn}`);

    printer.newLine();

    // TAX INVOICE heading – clear but not oversized
    printer.setTextDoubleWidth();
    printer.println("TAX INVOICE");
    printer.setTextNormal();
    printer.drawLine();


    if (customerType === "Take Away") {
      // Design 1: Separate lines
      printer.setTextDoubleWidth();
      printer.println(`Token No. : ${popOrder.orderNo || "-"}`);
      printer.setTextNormal();
      printer.println(customerType.padStart(48));
    } else {
      // Design 2: Same line
      printer.setTextDoubleHeight();
      const token = `Token No. : ${popOrder.orderNo || "-"}`;
      printer.setTextNormal();
      printer.println(token.padEnd(24, " ") + customerType.padStart(24, " "));
    }      

    // Date & Time
    const date = `Date  : ${dateStr}`;
    const time = `Time: ${timeStr}`;
    printer.println(date.padEnd(24, " ") + time.padStart(24, " "));

    // Bill No & Waiter
    const bill = `Bill No. : ${popOrder.order_id || "-"}`;
    const waiter = `Waiter : ${popOrder.createdBy || "-"}`;
    printer.println(bill.padEnd(24, " ") + waiter.padStart(24, " "));

    printer.drawLine();

    // Table headers
     printer.setTextNormal();
    printer.println("Items              Qty.   Price    Amount");
    printer.drawLine();

    let total = 0;

    const orderItems = popOrder.items.filter(item => !item.isComboItem);
    let totalQty = orderItems.length;

 for (const item of orderItems) {
  if (item.isCombo) {
    const name = item.comboName?.substring(0, 18).padEnd(18, " ");
    const qty = item.qty?.toString().padStart(2, " ");
    const price = (item.comboPrice || item.price)?.toFixed(2).padStart(6, " ");
    const amount = item.total?.toFixed(2).padStart(7, " ");

    printer.println(`${name}${qty}   ${price}   ${amount}`);

  
    total += item.total || 0;
  } else {
    const name = item.foodName?.substring(0, 18).padEnd(18, " ");
    const qty = item.qty?.toString().padStart(2, " ");
    const price = item.price?.toFixed(2).padStart(6, " ");
    const amount = item.total?.toFixed(2).padStart(7, " ");

    printer.println(`${name}${qty}   ${price}   ${amount}`);

  
    total += item.total || 0;
  }
}


    printer.drawLine();

    // Totals aligned to right
    const subTotal = (popOrder.subTotal || 0).toFixed(2).padStart(14, " ");
    const vat = (popOrder.vat || 0).toFixed(2).padStart(14, " ");
    const grandTotal = (popOrder.totalAmount || total).toFixed(2).padStart(14, " ");

    printer.println("Total Before VAT:".padStart(34) + subTotal);
    printer.println("VAT Incl:".padStart(34) + vat);

    printer.drawLine();

    // Grand Total – bold and aligned right
    printer.setTextDoubleHeight();
    printer.println("Total :".padStart(34) + grandTotal);
    printer.setTextNormal();

    // Items Count (after Total)
    const itemsLine = `Items: ${totalQty.toString().padStart(2, "0")}`;
    printer.println(itemsLine.padStart(48));

    printer.drawLine();

    // User and thank you message
    // printer.println(`User: ${popOrder.createdBy || "-"}`);
    printer.println("Thank You Visit Again");
     printer.newLine();
    printer.code128(popOrder.order_id, { height: 70 });

    printer.cut({ feed: 2 });
    await printer.execute();
  } catch (err) {
    console.error("Takeaway Receipt Print Error:", err);
  }
};


export const printDinInCustomerReceipt = async (req,res,next) => {
  try {
  
    const { orderId } = req.params;

    const popOrder = await ORDER.findById(orderId)
      .populate("restaurantId", "name address phone mobile trn logo")
      .populate("tableId", "name")
      .populate("customerTypeId", "type")
    
      //  const customerTypeId = popOrder.customerTypeId?._id;

    // Step 2: Define fallback search conditions in priority order
    const printerSearchConditions = [
      // { printerType: 'CustomerType', customerTypeId:customerTypeId  },
      { printerType: 'CustomerType' },
      { printerType: 'CustomerType', isUniversal: true },
      { printerType: 'KOT', isUniversal: true },
    ];

    let customerPrinterConfig = null;

    // Step 3: Try each condition until a match is found
    for (const condition of printerSearchConditions) {
    
      customerPrinterConfig = await PRINTER_CONFIG.findOne(condition).lean();
      if (customerPrinterConfig) break;
    }


    // Step 4: Throw if no printer found
    const printerIp = customerPrinterConfig?.printerIp;
     if (!printerIp) return res.status(400).json({ message:"No printer IP provided"})



    const customerType = popOrder.customerTypeId?.type || "Order";
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB");
    const timeStr = now.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: `tcp://${printerIp}`,
      characterSet: "SLOVENIA",
      removeSpecialCharacters: false,
      lineCharacter: "-",
      options: { timeout: 5000 },
    });

  if (popOrder.restaurantId?.logo) {

      const tmpDir = join(__dirname, "../../tmp");
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  }

  const originalLogoPath = join(__dirname, "../../", popOrder.restaurantId.logo);
  const processedLogoPath = join(tmpDir, `processed_${basename(originalLogoPath)}`);

  if (!existsSync(processedLogoPath)) {
    await sharp(originalLogoPath)
      .resize({ width: 180 })       // try smaller width
      .threshold(180)               // higher contrast
      .png()
      .toFile(processedLogoPath);
  }

  printer.alignCenter();
  await printer.printImage(processedLogoPath);  // this expects file path
  printer.newLine();
    }

    // Restaurant name – bold and a little bigger
     printer.setTextDoubleWidth();
    printer.println((popOrder.restaurantId?.name || "RESTAURANT").toUpperCase());
    printer.setTextNormal();

    // Contact details
    if (popOrder.restaurantId?.address) printer.println(popOrder.restaurantId.address);
    let contact = "";
    if (popOrder.restaurantId?.phone) contact += `TEL:${popOrder.restaurantId.phone}`;
    if (popOrder.restaurantId?.mobile) contact += `, MOB:${popOrder.restaurantId.mobile}`;
    if (contact) printer.println(contact);
    if (popOrder.restaurantId?.trn) printer.println(`TRN:${popOrder.restaurantId.trn}`);

         printer.newLine();

    // TAX INVOICE heading – clear but not oversized
    printer.setTextDoubleWidth();
    printer.println("TAX INVOICE");
    printer.setTextNormal();
    printer.drawLine();

    
    // Token No. (bold) and customer type (e.g., Takeaway)
    printer.setTextDoubleHeight();
    const token = `Token No. : ${popOrder.orderNo || "-"}`;
    printer.setTextNormal();
    printer.println(token.padEnd(24, " ") + customerType.padStart(24, " "));
      

    // Date & Time
    const date = `Date  : ${dateStr}`;
    const time = `Time: ${timeStr}`;
    printer.println(date.padEnd(24, " ") + time.padStart(24, " "));

    // Bill No & Waiter
    const bill = `Bill No. : ${popOrder.order_id || "-"}`;
    const waiter = `Waiter : ${popOrder.createdBy || "-"}`;
    printer.println(bill.padEnd(24, " ") + waiter.padStart(24, " "));

    printer.drawLine();

    // Table headers
     printer.setTextNormal();
    printer.println("Items              Qty.   Price    Amount");
    printer.drawLine();

    
    let total = 0;

    const orderItems = popOrder.items.filter(item => !item.isComboItem);
    let totalQty = orderItems.length;

    for (const item of orderItems) {
  if (item.isCombo) {
    const name = item.comboName?.substring(0, 18).padEnd(18, " ");
    const qty = item.qty?.toString().padStart(2, " ");
    const price = (item.comboPrice || item.price)?.toFixed(2).padStart(6, " ");
    const amount = item.total?.toFixed(2).padStart(7, " ");

    printer.println(`${name}${qty}   ${price}   ${amount}`);

  
    total += item.total || 0;
  } else {
    const name = item.foodName?.substring(0, 18).padEnd(18, " ");
    const qty = item.qty?.toString().padStart(2, " ");
    const price = item.price?.toFixed(2).padStart(6, " ");
    const amount = item.total?.toFixed(2).padStart(7, " ");

    printer.println(`${name}${qty}   ${price}   ${amount}`);

  
    total += item.total || 0;
  }
}

    printer.drawLine();

    // Totals aligned to right
    const subTotal = (popOrder.subTotal || 0).toFixed(2).padStart(14, " ");
    const vat = (popOrder.vat || 0).toFixed(2).padStart(14, " ");
    const grandTotal = (popOrder.totalAmount || total).toFixed(2).padStart(14, " ");

    printer.println("Total Before VAT:".padStart(34) + subTotal);
    printer.println("VAT Incl:".padStart(34) + vat);

    printer.drawLine();

    // Grand Total – bold and aligned right
    printer.setTextDoubleHeight();
    printer.println("Total :".padStart(34) + grandTotal);
    printer.setTextNormal();

    // Items Count (after Total)
    const itemsLine = `Items: ${totalQty.toString().padStart(2, "0")}`;
    printer.println(itemsLine.padStart(48));

    printer.drawLine();

    // User and thank you message
    // printer.println(`User: ${popOrder.createdBy || "-"}`);
    printer.println("Thank You Visit Again");
     printer.newLine();
    printer.code128(popOrder.order_id, { height: 70 });

      const updatedTable = await TABLES.findOneAndUpdate(
      { _id: popOrder.tableId },
      { currentStatus: 'VacatingSoon' },
      { new: true }
    ).lean();

    //  Emit before printing — avoids blocking due to network/printer issue
    const io = getIO();
    io.to(`posTable-${popOrder.restaurantId._id}`).emit('single_table_update', updatedTable);

   
      popOrder.status = 'Printed';
      await popOrder.save();


    //  Now do the print
    printer.cut({ feed: 2 });
    await printer.execute();


  } catch (err) {
    console.error("Takeaway Receipt Print Error:", err);
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



