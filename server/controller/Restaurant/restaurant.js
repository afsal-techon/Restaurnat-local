import USER from '../../model/userModel.js';
import RESTAURANT from '../../model/restaurant.js'
import validatePhoneNumbers from '../../middleware/phoneValidator.js';
import CUSTOMER_TYPE from '../../model/customerTypes.js'



const generateUniqueRestaurantId = async () => {
    let uniqueId;
    let exists = true;

    while (exists) {
        uniqueId = Math.floor(100000 + Math.random() * 900000); // Generates a 6-digit number
        exists = await RESTAURANT.findOne({ restaurant_id: uniqueId }); // Check if ID already exists
    }

    return uniqueId;
};



export const  createRestuarantBranch = async (req,res,next)=>{
    try{

        const {
            name, address,country, state, city, email,phone,phone2,phone3,
            openingTime, closingTime, vatPercentage, currency, currencySymbol,
        } = req.body;

  
        // Validate required fields
        if (!name) return res.status(400).json({ message: 'Restaurant name is required!' });
        if (!address) return res.status(400).json({ message: 'Restaurant address is required!' });
        if (!country) return res.status(400).json({ message: 'Country is required!' });
        if (!state) return res.status(400).json({ message: 'State is required!' });
        if (!city) return res.status(400).json({ message: 'City is required!' });
        if (!phone) return res.status(400).json({ message: 'Phone is required!' });

       

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "Invalid email format!" });
        }

        // const existEmailEmp = await EMPLOYEEE.findOne({ email });
        // if( existEmailEmp){
        //     return res.status(400).json({ message:'Email already exists!'})
        // }
        
        const phoneNumbers = [phone, phone2, phone3].filter(Boolean); // Remove null/undefined values

        const isPhoneNumberExists = await validatePhoneNumbers(phoneNumbers,null,false);

        if (isPhoneNumberExists) {
            return res.status(400).json({ message: 'Phone number already exists!' });
        }
 


        const userId = req.user;
        const user = await USER.findOne({ _id: userId})
     
        if (!user) return res.status(400).json({ message: "User not found!" });
        // if (user.role !== "CompanyAdmin") {
        //     return res.status(403).json({ message: "Only Company Admin can create branch!" });
        // }

           let companyAdminId = user._id;
            const restaurant_id = await  generateUniqueRestaurantId();




        const restaurant = await RESTAURANT.create({
            restaurant_id,
            name,
            address,
            country,
            state,
            city,
            phone,
            phone2,
            phone3,
            email,
            openingTime,
            closingTime,
            vatPercentage,
            currency,
            currencySymbol,
            companyAdmin: companyAdminId
        });
        return res.status(201).json({ message: "Restaurant created successfully", restaurant });


    }catch(err){
        next(err)
    }
}

export const getAllRestaurant = async(req,res,next)=>{
    try{

        const userId = req.user;

        // Check if user exists
        const user = await USER.findOne({ _id: userId})
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }
 

        let restaurants = [];

        if (user.role === "CompanyAdmin") {
          // Use isDeleted in query — uses compound index { companyAdmin: 1, isDeleted: 1 }
          restaurants = await RESTAURANT.findOne({
            companyAdmin: user._id,
          });
        } else if (user.role === "User") {
          const restaurantId = user.restaurantId;
          const restaurant = await RESTAURANT.findOne({
            _id: restaurantId,
          }); // this uses index on _id + isDeleted (by default MongoDB indexes _id)
    
          if (restaurant) {
            restaurants = [restaurant];
          }
        }

        return res.status(200).json({ restaurants });

    }catch(err){
        next(err) 
    }
}


export const updateRestaurantBranch = async (req, res, next) => {
    try {
       
        const {
            restaurantId,
            name, address,country, state, city, email,phone,phone2,phone3,
            openingTime, closingTime, vatPercentage, currency, currencySymbol,
        } = req.body;



        const userId = req.user;

        //  Check if user exists
        const user = await USER.findOne({ _id: userId });
        if (!user) {
            return res.status(400).json({ message: 'User not found!' });
        }

        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant ID is required!" });
        }

        //  Find the restaurant
        const restaurant = await RESTAURANT.findById(restaurantId);
        if (!restaurant) {
            return res.status(404).json({ message: "Restaurant not found!" });
        }

        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ message: "Invalid email format!" });
            }

        }

        const phoneNumbers = [phone, phone2, phone3].filter(Boolean); // Collect all phone numbers
        const phoneConflict = await validatePhoneNumbers(phoneNumbers, restaurantId,false);
        
        if (phoneConflict) {
            return res.status(400).json({ message: 'Phone number already exists!' });
        }
        

     

            if (user.role !== "CompanyAdmin") {
                return res.status(403).json({ message: "Only CompanyAdmin can update branch!" });
            }


        //  Update restaurant fields
        const updatedRestaurant = await RESTAURANT.findByIdAndUpdate(
            restaurantId,
            {
                name: name || restaurant.name,
                address: address || restaurant.address,
                country : country || restaurant.country,
                state: state || restaurant.state,
                city: city || restaurant.city,
                email: email || restaurant.email,
                phone: phone || restaurant.phone,
                phone2 : phone2 || restaurant.phone2,
                phone3 : phone3 || restaurant.phone3,
                openingTime : openingTime || restaurant.openingTime,
                closingTime: closingTime || restaurant.closingTime,
                vatPercentage: vatPercentage || restaurant.vatPercentage,
                currency: currency || restaurant.currency,
                currencySymbol: currencySymbol || restaurant.currencySymbol,
            },
            { new: true } //  Return updated document
        );

        
        return res.status(200).json({ message: "Restaurant updated successfully", updatedRestaurant });

    } catch (err) {
        next(err);
    }
};


export const deleteRestaurant = async (req,res,next)=>{
    try{

        const { restaurantId } = req.params;

        const userId = req.user;

        const user = await USER.findOne({ _id: userId })
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

        if (user.role !== "CompanyAdmin") {
            return res.status(403).json({ message: "Only CompanyAdmin can delete a restaurant!" });
        }

        await RESTAURANT.findByIdAndDelete(restaurantId);
        
        return res.status(200).json({ message: "Restaurant deleted successfully!" });
        

    }catch(err){
        next(err)
    }

}






export const addCustomerType = async (req, res, next) => {
    try {
      const { restaurantIds, customerTypes } = req.body;
      const userId = req.user;

      console.log(customerTypes,'customer tyuupe')
  
      const user = await USER.findById(userId);
      if (!user) return res.status(400).json({ message: "User not found!" });
  
      if (!restaurantIds || !Array.isArray(restaurantIds) || restaurantIds.length === 0) {
        return res.status(400).json({ message: "Restaurant IDs are required!" });
      }
  
      if (!customerTypes || customerTypes.length === 0) {
        return res.status(400).json({ message: "Customer types are required!" });
      }
  
      for (const type of customerTypes) {
        if (!type.type) {
          return res.status(400).json({ message: "Customer type is required!" });
        }
  
        if (type.type === "Online" && (!type.subMethods || type.subMethods.length === 0)) {
          return res.status(400).json({ message: "Online platform are required for 'Online' type!" });
        }
      }
  
      let filter = {};
      if (user.role === "CompanyAdmin") {
        filter = { _id: { $in: restaurantIds }, companyAdmin: user._id };
      } else if (user.role === "User") {
        filter = { _id: { $in: restaurantIds } };
      } else {
        return res.status(403).json({ message: "Unauthorized!" });
      }
  
      const restaurants = await RESTAURANT.find(filter);
      if (!restaurants.length) return res.status(404).json({ message: "No matching restaurants found!" });
  
      for (const restaurant of restaurants) {
        for (const custType of customerTypes) {
            if (custType.type === "Online") {
                // Handle Online type
                const existingOnlineType = await CUSTOMER_TYPE.findOne({
                    restaurantId: restaurant._id,
                    type: "Online"
                });

                if (existingOnlineType) {
                    // Check for duplicates against this restaurant's existing subMethods
                    const duplicateSubMethods = custType.subMethods.filter(subMethod => 
                        existingOnlineType.subMethods.includes(subMethod)
                    );

                    if (duplicateSubMethods.length > 0) {
                        return res.status(400).json({
                            message: `These online platform already exists!`
                        });
                    }

                    // Add new unique subMethods for this restaurant
                    existingOnlineType.subMethods.push(...custType.subMethods);
                    await existingOnlineType.save();
                } else {
                    // Create new Online entry for this restaurant
                    await CUSTOMER_TYPE.create({
                        restaurantId: restaurant._id,
                        type: custType.type,
                        subMethods: custType.subMethods
                    });
                }
            } else {
                // Handle other types (Dine-in, Takeaway, etc.)
                const exists = await CUSTOMER_TYPE.findOne({
                    restaurantId: restaurant._id,
                    type: custType.type
                });

                if (exists) {
                    return res.status(400).json({
                        message: `Customer type '${custType.type}' already exists for restaurant.`
                    });
                }

                await CUSTOMER_TYPE.create({
                    restaurantId: restaurant._id,
                    type: custType.type,
                    subMethods: custType.subMethods || []
                });
            }
        }
    }

  
      return res.status(200).json({ message: "Customer types added successfully" });
    } catch (err) {
      next(err);
    }
  };




  export const updateCustomerTypes = async (req, res, next) => {
    try {
      const { restaurantId, customerTypeId, type, subMethods } = req.body;
      const userId = req.user;

      // Validate input
      if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
          return res.status(400).json({ message: "Valid restaurantId is required!" });
      }

      if (!customerTypeId || !mongoose.Types.ObjectId.isValid(customerTypeId)) {
          return res.status(400).json({ message: "Valid customerTypeId is required!" });
      }

      if (!type) {
          return res.status(400).json({ message: "Customer type is required!" });
      }

      // Check user authorization
      const user = await USER.findById(userId);
      if (!user) return res.status(400).json({ message: "User not found!" });



      const restaurant = await RESTAURANT.findOne({ _id: restaurantId });
      if (!restaurant) {
          return res.status(404).json({ message: "Restaurant not found or unauthorized!" });
      }

      // Find existing customer type
      const existingCustomerType = await CUSTOMER_TYPE.findOne({
          _id: customerTypeId,
          restaurantId: restaurant._id
      });

      if (!existingCustomerType) {
          return res.status(404).json({ message: "Customer type not found for this restaurant!" });
      }

      // Handle Online type specially
      if (type === "Online") {
          if (!subMethods || subMethods.length === 0) {
              return res.status(400).json({ message: "SubMethods are required for 'Online' type!" });
          }

          // Check for duplicates in the new subMethods
          const hasDuplicates = subMethods.some((method, index) => 
              subMethods.indexOf(method) !== index
          );

          if (hasDuplicates) {
              return res.status(400).json({ 
                  message: "These online platform already exists!" 
              });
          }

          // Update the document
          existingCustomerType.type = type;
          existingCustomerType.subMethods = subMethods;
          await existingCustomerType.save();

          return res.status(200).json({ 
              message: "Online customer type updated successfully",
              data: existingCustomerType
          });
      } else {
          // For non-Online types, check if the type already exists (excluding current document)
          const typeExists = await CUSTOMER_TYPE.findOne({
              restaurantId: restaurant._id,
              type: type,
              _id: { $ne: customerTypeId } // Exclude current document
          });

          if (typeExists) {
              return res.status(400).json({
                  message: `Customer type '${type}' already exists for this restaurant!`
              });
          }

          // Update the document
          existingCustomerType.type = type;
          existingCustomerType.subMethods = subMethods || [];
          await existingCustomerType.save();

          return res.status(200).json({ 
              message: "Customer type updated successfully",
              data: existingCustomerType
          });
      }

  
    } catch (err) {
      next(err);
    }
  };


  export const deleteCustomerTypes = async (req, res, next) => {
    try {
      const { customerTypeId, subMethod } = req.body;

      // Validate input
      if (!customerTypeId || !mongoose.Types.ObjectId.isValid(customerTypeId)) {
          return res.status(400).json({ success: false, message: "Valid customerTypeId is required" });
      }

      // Find the customer type
      const customerType = await CUSTOMER_TYPE.findById(customerTypeId);
      if (!customerType) {
          return res.status(404).json({ success: false, message: "Customer type not found" });
      }

      // Handle Online type with subMethod deletion
      if (customerType.type === "Online" && subMethod) {
          // Check if subMethod exists
          const subMethodIndex = customerType.subMethods.indexOf(subMethod);
          if (subMethodIndex === -1) {
              return res.status(400).json({ 
                  success: false, 
                  message: "SubMethod not found in this Online type" 
              });
          }

          // Remove the subMethod
          customerType.subMethods.splice(subMethodIndex, 1);

          // If no subMethods left, delete the entire entry
          if (customerType.subMethods.length === 0) {
              await CUSTOMER_TYPE.findByIdAndDelete(customerTypeId);
              return res.status(200).json({ 
                  success: true, 
                  message: "Online type deleted as no subMethods remain" 
              });
          }

          // Save if subMethods still exist
          await customerType.save();
          return res.status(200).json({ 
              success: true, 
              message: "SubMethod deleted successfully",
              data: customerType
          });
      }

      // For non-Online types or when not specifying subMethod
      await CUSTOMER_TYPE.findByIdAndDelete(customerTypeId);
      return res.status(200).json({ 
          success: true, 
          message: "Customer type deleted successfully" 
      });
    } catch (err) {
      console.error("Error deleting customer type:", err);
      return res.status(500).json({ message: "Server error", error: err.message });
    }
  };

    export const getAllCustomerTypes = async (req, res, next) => {
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