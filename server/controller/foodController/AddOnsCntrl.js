import USER from '../../model/userModel.js';
import RESTAURANT from '../../model/restaurant.js'
import ADDONS from '../../model/add-on.js'



export const createAddOns = async (req,res,next)=>{
    try {

        const { restaurantIds, addOns } = req.body;
        const userId = req.user;

          const user = await USER.findOne({ _id: userId })

        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

        if (!restaurantIds || !Array.isArray(restaurantIds) || restaurantIds.length === 0) {
            return res.status(400).json({ message: "Restaurant IDs are required!" });
        }

        if (!addOns) {
            return res.status(400).json({ message: "Add-ons are required!" });
        }

        if (!addOns.name) {
            return res.status(400).json({ message: "Add-on name is required!" });
        }

        if (addOns.portion && Array.isArray(addOns.portion)) {

            for (const p of addOns.portion) {
                if (!p.name || !p.price) {
                    return res.status(400).json({ message: "Each portion must include a name and price!" });
                }
            }
        } else {
            if (!addOns.price) {
                return res.status(400).json({ message: "Price is required when portion is not provided!" });
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
        if (!restaurants || restaurants.length === 0) {
            return res.status(404).json({ message: "No matching restaurants found!" });
        }


        const addOnName = addOns.name.trim().toLowerCase();
        const existingAddOns = await ADDONS.find({
            restaurantId: { $in: restaurantIds },
            name: addOnName,
        }).collation({ locale: "en", strength: 2 });

        if (existingAddOns.length > 0) {
            const duplicateNames = existingAddOns.map(
                (addon) => `Restaurant ID: ${addon.restaurantId}, Add-on: ${addon.name}`
            );
            return res.status(400).json({
                message: `Add-on already exists in the specified restaurants!`,
             
            });
        }

        const addOnData = restaurants.map((restaurant) => ({
            name: addOns.name,
            price: addOns.price || null,
            portion: addOns.portion || [],
            restaurantId: restaurant._id,
            createdById: user._id,
            createdBy: user.name,
        }));

        for (const restaurant of restaurants) {
       
            // req.io?.to(`pos-${restaurant._id}`).emit("food-updated", { restaurantId: restaurant._id });
            
        }

        const createdAddOns = await ADDONS.insertMany(addOnData);

        return res.status(201).json({
            message: "Add-ons added successfully!",
            data: createdAddOns,
        });
        
    } catch (err) {
        next(err)
    }
}


export const getAllAddOns = async (req, res, next) => {
    try {
        const { restaurantId } = req.params;

        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant ID is required!" });
        }

        const addOns = await ADDONS.find({
            restaurantId,
            
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            data: addOns
        });

    } catch (err) {
        next(err);
    }
};


export const updateAddOns  = async (req, res, next) => {
    try {

        
        const { addOnId , name, price, portion } = req.body;
        const userId = req.user;

        if (!addOnId) {
            return res.status(400).json({ message: "Add-on ID is required!" });
        }

          const user = await USER.findOne({ _id: userId,  })
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

        const existingAddOn = await ADDONS.findOne({ _id: addOnId,  });
        if (!existingAddOn) {
            return res.status(404).json({ message: "Add-on not found!" });
        }

        if (portion && Array.isArray(portion)) {
            for (const p of portion) {
                if (!p.name || !p.price) {
                    return res.status(400).json({ message: "Each portion must include a name and price!" });
                }
            }
        } else {
            if (!price) {
                return res.status(400).json({ message: "Price is required when portion is not provided!" });
            }
        }

            // Check for duplicate name in the same restaurant
            const lowerCaseName = name.trim().toLowerCase();
            const duplicateAddOn = await ADDONS.findOne({
                _id: { $ne: addOnId },
                restaurantId: existingAddOn.restaurantId,
                name: lowerCaseName,
                
            }).collation({ locale: 'en', strength: 2 });


            if (duplicateAddOn) {
                return res.status(400).json({ message: "An add-on with the same name already exists in this restaurant!" });
            }  
              // Update the add-on
                const updatedAddOn = await ADDONS.findByIdAndUpdate(
                    addOnId,
                    {
                        name,
                        price: price || null,
                        portion: portion || [],
                        updatedBy: user.name,
                        updatedById: user._id,
                        updatedAt: new Date()
                    },
                    { new: true }
                );


        // req.io?.to(`pos-${existingAddOn.restaurantId}`).emit("food-updated", { restaurantId: existingAddOn.restaurantId });

        return res.status(200).json({
            message: "Add-on updated successfully!",
            data: updatedAddOn,
        });

    } catch (err) {
        next(err);
    }
};


export const deleteAddOn  = async (req, res, next) => {
    try {
      const { restaurantId, addOnId } = req.body;
      const userId = req.user;
      console.log('vanu')
  
      // Validate user
        const user = await USER.findOne({ _id: userId,  })
      if (!user) {
        return res.status(400).json({ message: "User not found!" });
      }
  
      if (!restaurantId) {
        return res.status(400).json({ message: "Restaurant ID is required!" });
      }
  
      if (!addOnId) {
        return res.status(400).json({ message: "Add-on ID is required!" });
      }
  
      // Role-based access check
      let filter = {};
      if (user.role === "CompanyAdmin") {
        filter = { _id: restaurantId, companyAdmin: user._id };
      } else if (user.role === "User") {
        filter = { _id: restaurantId };
      } else {
        return res.status(403).json({ message: "Unauthorized access!" });
      }
  
      const restaurant = await RESTAURANT.findOne(filter);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found!" });
      }
  
      const addOn = await ADDONS.findOne({ _id: addOnId, restaurantId });
      if (!addOn) {
        return res.status(404).json({ message: "Add-on not found!" });
      }
  
      // Soft delete
     await ADDONS.findByIdAndDelete(addOnId)
  
      return res.status(200).json({
        message: "Add-ons deleted successfully!",
      });
    } catch (err) {
      next(err);
    }
  };