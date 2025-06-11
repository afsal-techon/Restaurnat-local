import TABLES from '../../model/tables.js';
import FLOORS from '../../model/floor.js';
import USER from '../../model/userModel.js';
import mongoose from 'mongoose';
import RESTAURANT from '../../model/restaurant.js';
import CUSTOMER_TYPE from '../../model/customerTypes.js'
import CUSTOMER from '../../model/customer.js'




export const getFloorsForPOS = async (req, res, next) => {
    try {
        const { restaurantId } = req.params;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId})
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant ID is required!" });
        }

        let filter = {};
        if (user.role === "CompanyAdmin") {
            filter = { _id: restaurantId, companyAdmin: user._id };
        } else if (user.role === "User") {
            filter = { _id: restaurantId }; // assuming 'user' field exists in restaurant
        } else {
            return res.status(403).json({ message: "Unauthorized access!" });
        }

        // Aggregation to include the number of tables (optional)
        const floors = await FLOORS.aggregate([
            { $match: { restaurantId: new mongoose.Types.ObjectId(restaurantId)} },
            {
                $lookup: {
                    from: 'tables', // Collection name for tables
                    localField: '_id', // Field in the floors collection
                    foreignField: 'floorId', // Field in the tables collection
                    as: 'tables', // Alias for the joined data
                },
            },
            {
                $addFields: {
                    tableCount: { $size: { $ifNull: ['$tables', []] } }, // Handle missing tables gracefully
                },
            },
            {
                $project: {
                    tables: 0, // Exclude the tables array if only the count is needed
                },
            },
         // Sort by creation date
        ]);

        return res.status(200).json({ floors });
    } catch (err) {
        next(err);
    }
};



export const getTablesForPOS = async (req,res,next)=>{
    try {

        const { restaurantId } = req.params;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId })
        if (!user) {
            return res.status(404).json({ message: "User not found!" });
        }

        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant Id is required!" });
        }

        const tables = await TABLES.find({ restaurantId})
        .lean();

        return res.status(200).json({ tables })
        
    } catch (err) {
        next(err)
    }
}



export const createCustomerForPOS = async (req,res,next)=>{
    try {

        const { restaurantId, name, mobileNo, address, credit } = req.body;

        const userId = req.user;
        const user = await USER.findOne({ _id: userId })
      if (!user) {
        return res.status(400).json({ message: "User not found!" });
      }
        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant Id is required!" });
        }
        if(!name){
            return res.status(400).json({ message:'Customer name is required!'})
        }
        if(!mobileNo){
            return res.status(400).json({ message:'Mobile number is required!'})
        }

        let filter = {};
        if (user.role === "CompanyAdmin") {
          filter = { _id: restaurantId, companyAdmin: user._id };
        } else if (user.role === "User") {
          filter = { _id: restaurantId };
        } else {
          return res.status(403).json({ message: "Unauthorized!" });
        }

        const restaurant = await RESTAURANT.findOne(filter);
        if (!restaurant) {
          return res.status(404).json({ message: "Restaurant not found!" });
        }

        const existingCustomer = await CUSTOMER.findOne({
            restaurantId,
            mobileNo
        });

    if (existingCustomer) {
        return res.status(409).json({ success: false, message: 'Customer with this mobile number already exists' });
      }

    const customer =   await CUSTOMER.create({
        restaurantId,
        name,
        mobileNo,
        address,
        credit: credit ?? 0,
        createdById:user._id,
        createdBy:user.name
      })

        return res.status(200).json({ data: customer })
        
    } catch (err) {
        next(err)
    }
}

export const getCustomersForPOS = async (req, res, next) => {
    try {
      const { restaurantId } = req.params;
      const userId = req.user;
  
      // Validate user
      const user = await USER.findOne({ _id: userId,  });
      if (!user) {
        return res.status(400).json({ message: "User not found!" });
      }
  
      if (!restaurantId) {
        return res.status(400).json({ message: "Restaurant Id is required!" });
      }
  
    
  
      // Get all customers for the restaurant
      const customers = await CUSTOMER.find({
        restaurantId
      }).sort({ createdAt: -1 });
  
      return res.status(200).json({ data: customers });
  
    } catch (err) {
      next(err);
    }
  };
  

  

  export const getCustomerCreditHistory = async (req, res, next) => {
    try {
      const { customerId } = req.params;
  
      if (!customerId) {
        return res.status(400).json({ message: "Customer ID is required!" });
      }
  
  
      const creditHistory = await CUSTOMER_CREDIT_HISTORY.find({ customerId })
        .sort({ createdAt: -1 }) 
        .populate("orderId order_id") 
        .lean();

      return res.status(200).json({
        data: creditHistory,
      });
  
    } catch (err) {
      next(err);
    }
  };
  

  export const updateCustomerforPOS = async (req, res, next) => {
    try {
      const { customerId, restaurantId, name, mobileNo, address } = req.body;
      const userId = req.user;
  
      if (!customerId) {
        return res.status(400).json({ message: "Customer Id is required!" });
      }
  
      if (!restaurantId) {
        return res.status(400).json({ message: "Restaurant Id is required!" });
      }
  
      if (!name) {
        return res.status(400).json({ message: "Customer name is required!" });
      }
  
      if (!mobileNo) {
        return res.status(400).json({ message: "Mobile number is required!" });
      }
  
      const user = await USER.findOne({ _id: userId,  });
      if (!user) {
        return res.status(400).json({ message: "User not found!" });
      }
  
      // Role-based restaurant access
      let filter = {};
      if (user.role === "CompanyAdmin") {
        filter = { _id: restaurantId, companyAdmin: user._id };
      } else if (user.role === "User") {
        filter = { _id: restaurantId };
      } else {
        return res.status(403).json({ message: "Unauthorized!" });
      }
  
      const restaurant = await RESTAURANT.findOne(filter);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found!" });
      }
  
      const customer = await CUSTOMER.findOne({
        _id: customerId,
        restaurantId
      });
  
      if (!customer) {
        return res.status(404).json({ message: "Customer not found!" });
      }
  
      // Check for duplicate mobileNo excluding current customer
      const duplicate = await CUSTOMER.findOne({
        _id: { $ne: customerId },
        restaurantId,
        mobileNo,
      });
  
      if (duplicate) {
        return res.status(409).json({ message: "Mobile number already exists!" });
      }
  
      // Update fields
      customer.name = name.trim();
      customer.mobileNo = mobileNo.trim();
      customer.address = address?.trim() || "";
  
      await customer.save();
  
      return res.status(200).json({
        success: true,
        message: "Customer updated successfully",
        data: customer,
      });
    } catch (err) {
      next(err);
    }
  };
  

  

  export const getCustomerTypesForPOS = async (req, res, next) => {
    try {
        const { restaurantId } = req.params;
        const userId = req.user;

        // Validate restaurantId
        if (!restaurantId) {
            return res.status(400).json({ message: "Valid restaurantId is required!" });
        }

        // Check user exists
        const user = await USER.findById(userId);
        if (!user) return res.status(400).json({ message: "User not found!" });

        // Verify restaurant exists and user has access
        const restaurant = await RESTAURANT.findOne({_id:restaurantId});
        if (!restaurant) {
            return res.status(404).json({ message: "Restaurant not found!" });
        }

        // Get all customer types for this restaurant
        const customerTypes = await CUSTOMER_TYPE.find({ restaurantId: restaurant._id })

        return res.status(200).json({data:customerTypes});
    } catch (err) {
        next(err);
    }
};