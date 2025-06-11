
import USER from '../../model/userModel.js';
import RESTAURANT from '../../model/restaurant.js'
import FLOORS from '../../model/floor.js'
import TABLE from '../../model/tables.js'
import KITCHEN from '../../model/kitchen.js'
import mongoose from 'mongoose';






export const createFloors = async (req,res,next)=>{
    try {

        const { restaurantId , floors  } = req.body;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId })
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant IDs are required!" });
        }

        if (!floors || !Array.isArray(floors) || floors.length === 0) {
            return res.status(400).json({ message: "Floors are required!" });
        }

        for (const floor of floors) {
            if (!floor.name || typeof floor.name !== "string" || floor.name.trim().length === 0) {
                return res.status(400).json({ message: "Floor name is required for each Floor!" });
            }
        }

        let filter = {};
        if (user.role === "CompanyAdmin") {
            filter = { _id: restaurantId, companyAdmin: user._id };
        } else if (user.role === "User") {
            filter = { _id: restaurantId };
        } else {
            return res.status(403).json({ message: "Unauthorized access!" });
        }

        // Validate restaurant ownership
        const restaurant = await RESTAURANT.findOne(filter);
        if (!restaurant) {
            return res.status(404).json({ message: "No matching restaurants found!" });
        }

        for (const floor of floors) {
            const existingFloor = await FLOORS.findOne({
                restaurantId,
                name: floor.name.trim(),
            });

            if (existingFloor) {
                return res.status(400).json({
                    message: `Floor '${floor.name}' already exists in this branch!`,
                });
            }
        }

          // Prepare position data for bulk insertion 
          const floorData = floors.map((floor) => ({
            name: floor.name.trim(),
            restaurantId,
            createdById: user._id,
            createdBy: user.name,
        }));


        const createFloors  = await FLOORS.insertMany(floorData);
        return res.status(201).json({
            message: "Floors added successfully!",
            data: createFloors,
        });

        
    } catch (err) {
        next(err)
        
    }
}


export const getAllFloorsbyRest = async (req, res, next) => {
    try {
        const { restaurantId } = req.params;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId })
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
            { $match: { restaurantId: new mongoose.Types.ObjectId(restaurantId), } },
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

export const updateFloorName = async (req,res,next)=>{
    try {

        const { restaurantId ,floorId ,name  } = req.body;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId })
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant ID are required!" });
        }

        if (!floorId) {
            return res.status(400).json({ message: "Floor ID is required!" });
        }
        if (!name || typeof name !== "string" || name.trim().length === 0) {
            return res.status(400).json({ message: "Floor name is required!" });
        }

        let filter = {};
        if (user.role === "CompanyAdmin") {
            filter = { _id: restaurantId, companyAdmin: user._id };
        } else if (user.role === "User") {
            filter = { _id: restaurantId };
        } else {
            return res.status(403).json({ message: "Unauthorized access!" });
        }

        // Validate restaurant ownership
        const restaurant = await RESTAURANT.findOne(filter);
        if (!restaurant) {
            return res.status(404).json({ message: "No matching restaurants found!" });
        }

        // Check if the floor exists
        const floor = await FLOORS.findOne({ _id: floorId, restaurantId });
        if (!floor) {
            return res.status(404).json({ message: "Floor not found!" });
        }

        const existingFloor = await FLOORS.findOne({
            _id: { $ne: floorId },
            restaurantId,
            name: name.trim(),
        });

        if (existingFloor) {
            return res.status(400).json({
                message: `Floor '${floor.name}' already exists in this branch!`,
            });
        }



        const updatedFloor = await FLOORS.findByIdAndUpdate(
            floorId,
            { name: name.trim() },
            { new: true } // Return the updated document
        );


        return res.status(200).json({message:"Floor updated succssfully", data: updatedFloor })
        
    } catch (err) {
        next(err)
        
    }
}


export const deleteFloor = async (req,res,next)=>{
    try {

        const { floorId  } = req.params;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId })
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

       const floor = await FLOORS.findById(floorId)
       if(!floor){
        return res.status(400).json({ message: "Floor not found!" });
       }

       await FLOORS.findByIdAndDelete(floorId)

        return res.status(200).json({ message:'Floor deleted succssfully' })
        
    } catch (err) {
        next(err)
        
    }
}




export const createTables = async (req,res,next)=>{
    try {

        console.log(req.body,'body')

        const { restaurantId , floorId , name, capacity  } = req.body;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId })
        if (!user) {
            return res.status(404).json({ message: "User not found!" });
        }

        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant ID are required!" });
        }


        if (!name || typeof name !== "string" || name.trim().length === 0) {
            return res.status(400).json({ message: "Table name is required!" });
        }

        if (!capacity || typeof capacity !== "number" || capacity <= 0) {
            return res.status(400).json({ message: "Capacity must be a positive number!" });
        }

        const floor = await FLOORS.findById(floorId);
        if(!floor){
            return res.status(400).json({ message:'Floor not found!'})
        }

        let filter = {};
        if (user.role === "CompanyAdmin") {
            filter = { _id: restaurantId, companyAdmin: user._id };
        } else if (user.role === "User") {
            filter = { _id: restaurantId };
        } else {
            return res.status(403).json({ message: "Unauthorized access!" });
        }

        // Validate restaurant ownership
        const restaurant = await RESTAURANT.findOne(filter);
        if (!restaurant) {
            return res.status(404).json({ message: "No matching restaurants found!" });
        }


        const existingTable = await TABLE.findOne({
            restaurantId, 
            floorId,    
            name: name.trim(),
        });
        
        if (existingTable) {
            return res.status(400).json({
                message: `Table '${name}' already exists in this floor for this branch!`,
            });
        }

        const table = await TABLE.create({ 
            name: name.trim(),
            capacity,
            restaurantId,
            floorId,
            createdById:user._id,
            createdBy: user.name,
        });

        return res.status(200).json({ message:'Table added succsfully',table})
        
    } catch (err) {
        next(err)
    }
}

export const getAllTablesbyRest = async (req,res,next)=>{
    try {

        const { restaurantId } = req.params;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId })
        if (!user) {
            return res.status(404).json({ message: "User not found!" });
        }

        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant IDs are required!" });
        }

                // Aggregation to join tables with floors and include floor names
                const tables = await TABLE.aggregate([
                    { $match: { restaurantId: new mongoose.Types.ObjectId(restaurantId) } }, // Match tables by restaurantId
                    {
                        $lookup: {
                            from: "floors", // Collection name for floors
                            localField: "floorId", // Field in the table collection
                            foreignField: "_id", // Field in the floor collection
                            as: "floor", // Alias for the joined data
                        },
                    },
                    {
                        $addFields: {
                            floorName: { $arrayElemAt: ["$floor.name", 0] }, // Extract floor name (handle null gracefully)
                        },
                    },
                    {
                        $project: {
                            floor: 0, // Exclude the full floor object if only the name is needed
                        },
                    },
                   // Sort by creation date
                ]);


        return res.status(200).json({ tables})
        
    } catch (err) {
        next(err)
    }
}



export const updateTable = async (req,res,next)=>{
    try {

        const { tableId , name, capacity ,floorId } = req.body;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId })
        if (!user) {
            return res.status(404).json({ message: "User not found!" });
        }

        if (!tableId) {
            return res.status(400).json({ message: "Table ID is required!" });
        }

        if (name && (typeof name !== "string" || name.trim().length === 0)) {
            return res.status(400).json({ message: "Table name is required!" });
        }

        if (capacity && (typeof capacity !== "number" || capacity <= 0)) {
            return res.status(400).json({ message: "Capacity must be a positive number!" });
        }

        const floor = await FLOORS.findById(floorId);
        if (!floor) {
            return res.status(404).json({ message: "Floor not found!" });
        }

        const table = await TABLE.findById(tableId);
        if (!table) {
            return res.status(404).json({ message: "Table not found!" });
        }

        if ((name && name.trim() !== table.name) || (floorId && floorId !== table.floorId)) {
            const existingTable = await TABLE.findOne({
                _id: { $ne: tableId },
                restaurantId: table.restaurantId,
                floorId: floorId || table.floorId, // Use the new floorId or current floorId
                name: name ? name.trim() : table.name
            });

            if (existingTable) {
                return res.status(400).json({
                    message: `Table '${name}' already exists on this floor!`,
                });
            }
        }else{
            console.log()
        }

        const updatedTable = await TABLE.findByIdAndUpdate(
            tableId,
            {
                $set: {
                    name: name ? name.trim() : table.name,
                    capacity: capacity ? capacity : table.capacity,
                    floorId: floorId ? floorId : table.floorId,
                    updatedById: user._id,
                    updatedBy: user.name,
                },
            },
            { new: true } // Return the updated document
        );

        return res.status(200).json({
            message: "Table updated successfully!",
            table: updatedTable,
        });
        
    } catch (err) {
        next(err)
    }
}


export const deleteTable = async (req,res,next)=>{
    try {

        const { tableId  } = req.params;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId })
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

        const table = await TABLE.findById(tableId);
        if (!table) {
            return res.status(404).json({ message: "Table not found!" });
        }

        await TABLE.findByIdAndDelete(tableId)

        return res.status(200).json({ message:'Floor deleted succssfully' })
        
    } catch (err) {
        next(err)
        
    }
}



export const addKitchen = async(req,res,next)=>{
    try {

        const { restaurantId , kitchens  } = req.body;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId,  })
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant IDs are required!" });
        }

        if (!kitchens || !Array.isArray(kitchens) || kitchens.length === 0) {
            return res.status(400).json({ message: "kitchen are required!" });
        }

        for (const kitchen of kitchens) {
            if (!kitchen.name || typeof kitchen.name !== "string" || kitchen.name.trim().length === 0) {
                return res.status(400).json({ message: "kitchen name is required!" });
            }
        }

        let filter = {};
        if (user.role === "CompanyAdmin") {
            filter = { _id: restaurantId, companyAdmin: user._id };
        } else if (user.role === "User") {
            filter = { _id: restaurantId };
        } else {
            return res.status(403).json({ message: "Unauthorized access!" });
        }

        // Validate restaurant ownership
        const restaurant = await RESTAURANT.findOne(filter);
        if (!restaurant) {
            return res.status(404).json({ message: "No matching restaurants found!" });
        }


        for (const kitchen of kitchens) {
            const existKtichen = await KITCHEN.findOne({
                restaurantId,
                name: kitchen.name.trim(),
            });

            if (existKtichen) {
                return res.status(400).json({
                    message: `Kitchen '${kitchen.name}' already exists in this branch!`,
                });
            }
        }

        const kitchenData = kitchens.map((kitchen) => ({
            name: kitchen.name.trim(),
            restaurantId,
            createdById: user._id,
            createdBy: user.name,
        }));


        const createKitchen  = await KITCHEN.insertMany(kitchenData);
        return res.status(201).json({
            message: "Kitchens added successfully!",
            data: createKitchen,
        });
    } catch (err) {
        next(err)  
    }
}



export const getAllKitchen = async (req, res, next) => {
    try {
        const { restaurantId } = req.params;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId,  })
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant ID is required!" });
        }


        const kitchen = await KITCHEN.find({ restaurantId}).sort({ createdAt: -1});


        return res.status(200).json({ kitchen });
    } catch (err) {
        next(err);
    }
};



export const updateKitchen = async (req, res, next) => {
    try {
        const { restaurantId ,kitchenId ,name  } = req.body;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId,  })
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant ID is required!" });
        }

        if (!kitchenId) {
            return res.status(400).json({ message: "kitchen ID is required!" });
        }

        if (!name || typeof name !== "string" || name.trim().length === 0) {
            return res.status(400).json({ message: "Kitchen name is required!" });
        }
        let filter = {};
        if (user.role === "CompanyAdmin") {
            filter = { _id: restaurantId, companyAdmin: user._id };
        } else if (user.role === "User") {
            filter = { _id: restaurantId };
        } else {
            return res.status(403).json({ message: "Unauthorized access!" });
        }

        // Validate restaurant ownership
        const restaurant = await RESTAURANT.findOne(filter);
        if (!restaurant) {
            return res.status(404).json({ message: "No matching restaurants found!" });
        }

        const kitchen = await KITCHEN.findOne({ _id: kitchenId, restaurantId });
        if (!kitchen) {
            return res.status(404).json({ message: "Kitchen not found!" });
        }

        const duplicateKitchen = await KITCHEN.findOne({
            _id: { $ne: kitchenId },
            restaurantId,
            name: name.trim(),
          });
          
          if (duplicateKitchen) {
            return res.status(400).json({
              message: `Kitchen '${name}' already exists in this branch!`,
            });
          }



        const updatedKitchen = await KITCHEN.findByIdAndUpdate(
            kitchenId,
            { name: name.trim() },
            { new: true } // Return the updated document
        );


        return res.status(200).json({message:"Kitchen updated succssfully", data: updatedKitchen })
    } catch (err) {
        next(err);
    }
};



export const deleteKitchen = async (req,res,next)=>{
    try {

        const { kitchenId  } = req.params;

        const userId = req.user;
   

          const user = await USER.findOne({ _id: userId,  })
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

        const kitchen = await KITCHEN.findById(kitchenId);
        if (!kitchen) {
            return res.status(404).json({ message: "Kithen not found!" });
        }

        await KITCHEN.findByIdAndDelete(kitchenId)

        return res.status(200).json({ message:'Kitchen deleted succssfully' })
        
    } catch (err) {
        next(err)
        
    }
}