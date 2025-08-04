import ORDER from '../../model/oreder.js';
import USER from '../../model/userModel.js';
import RESTAURANT from '../../model/restaurant.js';
import RIDER from '../../model/Riders.js';
import CUSTOMER_TYPE from '../../model/customerTypes.js';
import CUSTOMER from '../../model/customer.js'




export const createRider = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(403).json({ message: "User not found!" });

    const {
      name,
      mobileNo,
      address,
    } = req.body;

    if (!name || !mobileNo) {
      return res.status(400).json({ message: "Name, Mobile No and Restaurant ID are required!" });
    }

    const existing = await RIDER.findOne({ mobileNo });
    if (existing) {
      return res.status(400).json({ message: "Rider with this mobile number already exists!" });
    }

    const rider = await RIDER.create({
      name,
      mobileNo,
      address,
      createdById: user._id,
      createdBy: user.name
    });

    return res.status(200).json({ message: "Rider created successfully", data: rider });
  } catch (err) {
    next(err);
  }
};



export const getRiders = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(403).json({ message: "User not found!" });

    const { search = "", page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = {};

    if (search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [
        { name: regex },
        { mobileNo: regex }
      ];
    }

    const total = await RIDER.countDocuments(query);

    const riders = await RIDER.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    return res.status(200).json({
      data: riders,
      page: parseInt(page),
      limit: parseInt(limit),
      totalCount: total
    });
  } catch (err) {
    next(err);
  }
};


export const getOneRider = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(403).json({ message: "User not found!" });

    const { riderId } = req.params;

    const rider = await RIDER.findOne(riderId);
    if (!rider) return res.status(404).json({ message: "Rider not found!" });

    return res.status(200).json({ data:rider });
  } catch (err) {
    next(err);
  }
};


export const updateRider = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(403).json({ message: "User not found!" });


    const { riderId,name, mobileNo, address } = req.body;

    const rider = await RIDER.findById(riderId);
    if (!rider) return res.status(404).json({ message: "Rider not found!" });

    if (mobileNo) {
      const duplicate = await RIDER.findOne({ mobileNo, _id: { $ne: riderId } });
      if (duplicate) {
        return res.status(400).json({ message: "Mobile number already used by another rider!" });
      }
    }

    rider.name = name || rider.name;
    rider.mobileNo = mobileNo || rider.mobileNo;
    rider.address = address || rider.address;

    await rider.save();

    return res.status(200).json({ message: "Rider updated successfully", data: rider });
  } catch (err) {
    next(err);
  }
};

export const deleteRider = async (req, res, next) => {
  try {
    const user = await USER.findById(req.user).lean();
    if (!user) return res.status(403).json({ message: "User not found!" });

    const { riderId } = req.params;

     const hasOrder = await ORDER.exists({ riderId });
          if (hasOrder) {
            return res.status(400).json({ message: "Cannot delete rider linked to Orders." });
          }

    const rider = await RIDER.findByIdAndDelete(riderId);
    if (!rider) return res.status(404).json({ message: "Rider not found!" });

    return res.status(200).json({ message: "Rider deleted successfully" });
  } catch (err) {
    next(err);
  }
};



//delivery status actions

export const markOrderReadyForPickup = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "Order ID is required!" });
    }

    const order = await ORDER.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found!" });
    }

    if (order.status !== "Placed") {
      return res.status(400).json({ message: "Only orders with status 'Placed' can be marked as ReadyPickup!" });
    }

    order.status = "ReadyPickUp";
    
    await order.save();

    return res.status(200).json({ message: "Order marked as Ready for Pickup successfully!" });
  } catch (err) {
    next(err);
  }
};


export const assignRiderForOut = async (req, res, next) => {
  try {
    const { orderId, riderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "Order ID is required!" });
    }

    if (!riderId) {
      return res.status(400).json({ message: "Rider ID is required!" });
    }

    const order = await ORDER.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found!" });
    }

    const rider = await RIDER.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found!" });
    }

    if (order.status !== "ReadyPickUp") {
      return res.status(400).json({
        message: "Only orders with status 'ReadyPickup' can be marked as Out For Delivery!",
      });
    }

    order.status = "OutForDelivery";
    order.riderId = riderId;
    order.pickupTime = new Date();

    await order.save();

    return res.status(200).json({ message: "Rider assigned and order marked as Out For Delivery!" });
  } catch (err) {
    next(err);
  }
};

export const completeHomeDelivery = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "Order ID is required!" });
    }

    const order = await ORDER.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found!" });
    }


   if (order.status !== "OutForDelivery") {
      return res.status(400).json({
        message: "Only orders marked as 'Out For Delivery' can be completed!",
      });
    }

    order.status = "Completed";
    order.deliveredTime = new Date();
    await order.save();

    return res.status(200).json({ message: "Rider assigned and order marked as Out For Delivery!" });
  } catch (err) {
    next(err);
  }
};





//deivery status get apis

export const getPlacedHomeDelivery = async (req, res, next) => {
  try {

    const userId = req.user
    const {restaurantId, fromDate, toDate, search } = req.query;

 

    // Validate user
    const user = await USER.findById(userId).lean();
    if (!user) return res.status(403).json({ message: "User not found!" });

    const customerType = await CUSTOMER_TYPE.findOne({ type: "Home Delivery" }).lean();
    if (!customerType) return res.status(400).json({ message: "Home Delivery customer type not found!" });

    const query = {
      restaurantId,
      customerTypeId: customerType._id,
      status: "Placed",
    };

    // Filter by delivery date range
    if (fromDate || toDate) {
      query.deliveryDate = {};
      if (fromDate) query.deliveryDate.$gte = new Date(fromDate);
      if (toDate) query.deliveryDate.$lte = new Date(toDate);
    }

    // Optional search (by order number, customer name, or mobileNo)
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");

      const customers = await CUSTOMER.find({
        $or: [{ name: searchRegex }, { mobileNo: searchRegex },],
      }).select("_id");

      const customerIds = customers.map((c) => c._id);

      query.$or = [
        { orderNo: searchRegex },
        { order_id: searchRegex },
        { customerId: { $in: customerIds } },
      ];
    }

    // Fetch orders with sorting by upcoming deliveryDate and deliveryTime
    const orders = await ORDER.find(query)
      .sort({ createdAt:-1 }) // Sort by date then time
      .select(
        "_id createdAt orderNo orderType order_id restaurantId totalAmount items subMethod deliveryDate deliveryTime location"
      )
      .populate({ path: "tableId", select: "name" })
      .populate({ path: "customerTypeId", select: "type" })
      .populate({ path: "customerId", select: "name mobileNo address" });

    return res.status(200).json({ data: orders });
  } catch (err) {
    next(err);
  }
};


export const getWaitingForHomeDelivery = async (req, res, next) => {
  try {
   
    const userId = req.user;
    const { restaurantId,fromDate, toDate, search } = req.query;

    // Validate user
    const user = await USER.findById(userId).lean();
    if (!user) return res.status(403).json({ message: "User not found!" });

    const customerType = await CUSTOMER_TYPE.findOne({ type: "Home Delivery" }).lean();
    if (!customerType) return res.status(400).json({ message: "Home Delivery customer type not found!" });

    const query = {
      restaurantId,
      customerTypeId: customerType._id,
      status: "ReadyPickUp",
    };

    // Filter by delivery date range
    if (fromDate || toDate) {
      query.deliveryDate = {};
      if (fromDate) query.deliveryDate.$gte = new Date(fromDate);
      if (toDate) query.deliveryDate.$lte = new Date(toDate);
    }

    // Optional search (by order number, customer name, or mobileNo)
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");

      const customers = await CUSTOMER.find({
        $or: [{ name: searchRegex }, { mobileNo: searchRegex },],
      }).select("_id");

      const customerIds = customers.map((c) => c._id);

      query.$or = [
        { orderNo: searchRegex },
        { order_id: searchRegex },
        { customerId: { $in: customerIds } },
      ];
    }

    // Fetch orders with sorting by upcoming deliveryDate and deliveryTime
    const orders = await ORDER.find(query)
      .sort({ createdAt:-1 }) // Sort by date then time
      .select(
        "_id createdAt orderNo orderType order_id restaurantId totalAmount items subMethod deliveryDate deliveryTime location"
      )
      .populate({ path: "tableId", select: "name" })
      .populate({ path: "customerTypeId", select: "type" })
      .populate({ path: "customerId", select: "name mobileNo address" });

    return res.status(200).json({ data: orders });
  } catch (err) {
    next(err);
  }
};


export const getOutForHomeDelivery = async (req, res, next) => {
  try {

    const userId = req.user;
    const {restaurantId, fromDate, toDate, search } = req.query;

    // Validate user
    const user = await USER.findById(userId).lean();
    if (!user) return res.status(403).json({ message: "User not found!" });

    const customerType = await CUSTOMER_TYPE.findOne({ type: "Home Delivery" }).lean();
    if (!customerType) return res.status(400).json({ message: "Home Delivery customer type not found!" });

    const query = {
      restaurantId,
      customerTypeId: customerType._id,
      status: "OutForDelivery",
    };

    // Filter by delivery date range
    if (fromDate || toDate) {
      query.deliveryDate = {};
      if (fromDate) query.deliveryDate.$gte = new Date(fromDate);
      if (toDate) query.deliveryDate.$lte = new Date(toDate);
    }

    // Optional search (by order number, customer name, or mobileNo)
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");

      const customers = await CUSTOMER.find({
        $or: [{ name: searchRegex }, { mobileNo: searchRegex },],
      }).select("_id");

      const customerIds = customers.map((c) => c._id);

      query.$or = [
        { orderNo: searchRegex },
        { order_id: searchRegex },
        { customerId: { $in: customerIds } },
      ];
    }

    // Fetch orders with sorting by upcoming deliveryDate and deliveryTime
    const orders = await ORDER.find(query)
      .sort({ createdAt:-1 }) // Sort by date then time
      .select(
        "_id createdAt orderNo orderType order_id restaurantId totalAmount items subMethod deliveryDate deliveryTime location"
      )
      .populate({ path: "tableId", select: "name" })
      .populate({ path: "customerTypeId", select: "type" })
      .populate({ path: "customerId", select: "name mobileNo address" })
      .populate({ path: "riderId", select: "name mobileNo address" });

    return res.status(200).json({ data: orders });
  } catch (err) {
    next(err);
  }
};


export const getDeliveredHomeDelivery = async (req, res, next) => {
  try {

    const userId = req.user;
    const {restaurantId, fromDate, toDate, search, limit: lim, page: pg } = req.query;

    const limit = parseInt(lim) || 20;
    const page = parseInt(pg) || 1;
    const skip = (page - 1) * limit;

    const user = await USER.findById(userId).lean();
    if (!user) return res.status(403).json({ message: "User not found!" });

    const customerType = await CUSTOMER_TYPE.findOne({ type: "Home Delivery" }).lean();
    if (!customerType) {
      return res.status(400).json({ message: "Home Delivery customer type not found!" });
    }

    const query = {
      restaurantId,
      customerTypeId: customerType._id,
      status: "Completed",
    };

    // Filter by delivery date range
    if (fromDate || toDate) {
      query.deliveryDate = {};
      if (fromDate) query.deliveryDate.$gte = new Date(fromDate);
      if (toDate) query.deliveryDate.$lte = new Date(toDate);
    }

    // Advanced search by order_id, orderNo, customer name or mobile
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");

      const customers = await CUSTOMER.find({
        $or: [{ name: searchRegex }, { mobileNo: searchRegex }],
      }).select("_id");

      const customerIds = customers.map((c) => c._id);

      query.$or = [
        { orderNo: searchRegex },
        { order_id: searchRegex },
        { customerId: { $in: customerIds } },
      ];
    }

    const totalCount = await ORDER.countDocuments(query);

    const orders = await ORDER.find(query)
      .sort({ createdAt:-1 })
      .skip(skip)
      .limit(limit)
      .select(
        "_id createdAt orderNo orderType order_id restaurantId totalAmount items subMethod deliveryDate deliveryTime location pickupTime deliveredTime"
      )
      .populate({ path: "tableId", select: "name" })
      .populate({ path: "customerTypeId", select: "type" })
      .populate({ path: "customerId", select: "name mobileNo address" })
      .populate({ path: "riderId", select: "name mobileNo address" })

    return res.status(200).json({
      data: orders,
      page,
      limit,
      totalCount,
    });
  } catch (err) {
    next(err);
  }
};





//rider delivery

export const getRiderOngoingOrders = async (req, res, next) => {
  try {
    const userId = req.user;
    const { riderId, fromDate, toDate, search, limit: lim, page: pg } = req.query;

    const limit = parseInt(lim) || 20;
    const page = parseInt(pg) || 1;
    const skip = (page - 1) * limit;

    const user = await USER.findById(userId).lean();
    if (!user) return res.status(403).json({ message: "User not found!" });

    // Base query
    const query = {
      riderId,
      status: "OutForDelivery"
    };

    // Filter by delivery date range
    if (fromDate || toDate) {
      query.deliveryDate = {};
      if (fromDate) query.deliveryDate.$gte = new Date(fromDate);
      if (toDate) query.deliveryDate.$lte = new Date(toDate);
    }

    // Advanced search by order_id, orderNo, customer name or mobile
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");

      const customers = await CUSTOMER.find({
        $or: [{ name: searchRegex }, { mobileNo: searchRegex }],
      }).select("_id");

      const customerIds = customers.map((c) => c._id);

      query.$or = [
        { orderNo: searchRegex },
        { order_id: searchRegex },
        { customerId: { $in: customerIds } },
      ];
    }

    const totalCount = await ORDER.countDocuments(query);

    const orders = await ORDER.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        "_id createdAt orderNo orderType order_id restaurantId totalAmount items subMethod deliveryDate deliveryTime location pickupTime"
      )
      .populate({ path: "customerId", select: "name mobileNo address" })
      .populate({ path: "riderId", select: "name mobileNo" });

    return res.status(200).json({
      data: orders,
      page,
      limit,
      totalCount,
    });
  } catch (err) {
    next(err);
  }
};

export const getRiderCompleted = async (req, res, next) => {
  try {
    const userId = req.user;
    const { riderId, fromDate, toDate, search, limit: lim, page: pg } = req.query;

    const limit = parseInt(lim) || 20;
    const page = parseInt(pg) || 1;
    const skip = (page - 1) * limit;

    const user = await USER.findById(userId).lean();
    if (!user) return res.status(403).json({ message: "User not found!" });

    // Base query
    const query = {
      riderId,
      status: "Completed"
    };

    // Filter by delivery date range
    if (fromDate || toDate) {
      query.deliveryDate = {};
      if (fromDate) query.deliveryDate.$gte = new Date(fromDate);
      if (toDate) query.deliveryDate.$lte = new Date(toDate);
    }

    // Advanced search by order_id, orderNo, customer name or mobile
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");

      const customers = await CUSTOMER.find({
        $or: [{ name: searchRegex }, { mobileNo: searchRegex }],
      }).select("_id");

      const customerIds = customers.map((c) => c._id);

      query.$or = [
        { orderNo: searchRegex },
        { order_id: searchRegex },
        { customerId: { $in: customerIds } },
      ];
    }

    const totalCount = await ORDER.countDocuments(query);

    const orders = await ORDER.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        "_id createdAt orderNo orderType order_id restaurantId totalAmount items subMethod deliveryDate deliveryTime location pickupTime"
      )
      .populate({ path: "customerId", select: "name mobileNo address" })
      .populate({ path: "riderId", select: "name mobileNo" });

    return res.status(200).json({
      data: orders,
      page,
      limit,
      totalCount,
    });
  } catch (err) {
    next(err);
  }
};
