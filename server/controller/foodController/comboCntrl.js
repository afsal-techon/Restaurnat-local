
import ADDONS from '../../model/add-on.js'
import mongoose from "mongoose";
import FOOD from '../../model/food.js';
import USER from '../../model/userModel.js';
import RESTAURANT from '../../model/restaurant.js'
import COMPOGROUP from '../../model/comboGroup.js'
import COMBO from '../../model/combo.js'


export const createCompo = async (req,res,next)=>{
    try {

      let {
        restaurantId,
        comboName,
        description,
        offer,
        groups, 
        addOns,
        comboPrice,
      } = req.body;


      const comboImg = req.file ? `/uploads/${req.file.filename}` : null;


      if (typeof offer === "string")  offer = JSON.parse(offer); // Parse string into array if necessary
      if (typeof groups === "string")  groups = JSON.parse(groups); 
      if (typeof addOns === "string") addOns = JSON.parse(addOns);

      console.log('working combo api ')

      groups = groups.map(group => {
        if (typeof group.foodItems === "string") {
          group.foodItems = JSON.parse(group.foodItems);
        }
        return group;
      });

      const userId = req.user;
    
        const user = await USER.findOne({ _id: userId })
      if (!user) {
        return res.status(400).json({ message: "User not found!" });
      }

      if (!restaurantId)  return res.status(400).json({ message: "Restaurant ID are required!" });
      if (!comboName)  return res.status(400).json({ message: "Combo name is required!" });
      if (!groups || groups.length ===0)  return res.status(400).json({ message: "Combo groups are required!" });
      if (!comboPrice)  return res.status(400).json({ message: "Combo price is required!" });
      
      const duplicateCombo = await COMBO.findOne({
        comboName: { $regex: `^${comboName}$`, $options: "i" },
        restaurantId,
      });
  
      if (duplicateCombo) {
        return res
          .status(400)
          .json({ message: "Combo with this name already exists!" });
      }

          // Role-based filter
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
            return res.status(404).json({ message: "No matching restaurant found!" });
          }

          const comboGroupIds = [];

          for (const group of groups){
               const { groupName, maxValue, foodItems} = group;

               const processedItems = [];

               for (const item of foodItems) {
                 if (!item.foodId) {
                   return res.status(400).json({ message: "Food Id is required in combo items" });
                 }
             
                 const food = await FOOD.findById(item.foodId);
                 if (!food) {
                   return res.status(400).json({ message: `Food not found!`});
                 }
             
                 if (item.portionId) {
                   const validPortion = food.portions?.find(p => p._id.toString() === item.portionId);
                   if (!validPortion) {
                     return res.status(400).json({
                       message: `Invalid portion selected for food: ${food.name}`,
                     });
                   }
             
                   processedItems.push({
                     foodId: item.foodId,
                     mainItem: item.mainItem,
                     additionalPrice: item.additionalPrice || 0,
                     portionId: item.portionId,
                     pieceCount: null,
                     singlePieceRate: null,
                   });
                 } else {
                   processedItems.push({
                     foodId: item.foodId,
                     mainItem: item.mainItem,
                     additionalPrice: item.additionalPrice || 0,
                     portionId: null,
                     pieceCount: item.pieceCount,
                     singlePieceRate: item.singlePieceRate,
                   });
                 }
               }


               const createdGroup = await COMPOGROUP.create({
                      groupName , 
                      maxValue,
                      foodItems : processedItems,
                      restaurantId,
                      createdById: user._id,
                      createdBy: user.name,
               })

               comboGroupIds.push(createdGroup._id)
          }

            //addOns applying
          const processedAddOns = [];
          for(const item of addOns){
            let addOn;
            if (item.addOnId) {
              addOn = await ADDONS.findById(item.addOnId);
            } else {
              addOn = await ADDONS.findOne({ "portions._id": item.portion_id });
            }
      
                  
           processedAddOns.push({
           addOnId: item.addOnId || null,
           portion_id: item.portion_id || null,
           });

          }
        
          const newCombo = await COMBO.create({
            restaurantId,
            comboName,
            image: comboImg || null,
            description,
            offer: offer ? offer : null,
            groups: comboGroupIds,
            addOns,
            comboPrice,
            createdById:user._id,
            createdBy:user.name,
          })
          


          return res.status(201).json({ message: "Combo created successfully", data: newCombo });

      
    } catch (err) {
      next(err)
    }
  }

  export const updateCombo = async (req, res, next) => {
    try {
      let {
        comboId,
        restaurantId,
        comboName,
        description,
        offer,
        groups,
        addOns,
        comboPrice,
      } = req.body;

      const comboImg = req.file ? `/uploads/${req.file.filename}` : null;
  
      if (!comboId) return res.status(400).json({ message: "Combo ID is required!" });
  
      if (typeof offer === "string") offer = JSON.parse(offer);
      if (typeof groups === "string") groups = JSON.parse(groups);
      if (typeof addOns === "string") addOns = JSON.parse(addOns);
  
      groups = groups.map(group => {
        if (typeof group.foodItems === "string") {
          group.foodItems = JSON.parse(group.foodItems);
        }
        return group;
      });
  
      const userId = req.user;
        const user = await USER.findOne({ _id: userId})
      if (!user) return res.status(400).json({ message: "User not found!" });
  
      const existingCombo = await COMBO.findById(comboId);
      if (!existingCombo)
        return res.status(404).json({ message: "Combo not found!" });
  
      if (!restaurantId) return res.status(400).json({ message: "Restaurant ID is required!" });
      if (!comboName) return res.status(400).json({ message: "Combo name is required!" });
      if (!groups || groups.length === 0) return res.status(400).json({ message: "Combo groups are required!" });
      if (!comboPrice) return res.status(400).json({ message: "Combo price is required!" });
  
      // Check for duplicate name
      const duplicateCombo = await COMBO.findOne({
        _id: { $ne: comboId },
        comboName: { $regex: `^${comboName}$`, $options: "i" },
        restaurantId
      });
  
      if (duplicateCombo) {
        return res.status(400).json({ message: "Another combo with this name already exists!" });
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
      if (!restaurant) return res.status(404).json({ message: "No matching restaurant found!" });
  
      // Delete old combo groups (or optionally archive them)
      await COMPOGROUP.deleteMany({ _id: { $in: existingCombo.groups } });
  
      const comboGroupIds = [];
  
      for (const group of groups) {
        const { groupName, maxValue, foodItems } = group;
        const processedItems = [];
  
        for (const item of foodItems) {
          if (!item.foodId) {
            return res.status(400).json({ message: "Food Id is required in combo items" });
          }
  
          const food = await FOOD.findById(item.foodId);
          if (!food) {
            return res.status(400).json({ message: `Food not found!` });
          }
  
          if (item.portionId) {
            const validPortion = food.portions?.find(p => p._id.toString() === item.portionId);
            if (!validPortion) {
              return res.status(400).json({
                message: `Invalid portion selected for food: ${food.name}`,
              });
            }
  
            processedItems.push({
              foodId: item.foodId,
              mainItem: item.mainItem,
              additionalPrice: item.additionalPrice || 0,
              portionId: item.portionId,
              pieceCount: null,
              singlePieceRate: null,
            });
          } else {
            processedItems.push({
              foodId: item.foodId,
              mainItem: item.mainItem,
              additionalPrice: item.additionalPrice || 0,
              portionId: null,
              pieceCount: item.pieceCount,
              singlePieceRate: item.singlePieceRate,
            });
          }
        }
  
        const createdGroup = await COMPOGROUP.create({
          groupName,
          maxValue,
          foodItems: processedItems,
          restaurantId,
          createdById: user._id,
          createdBy: user.name,
        });
  
        comboGroupIds.push(createdGroup._id);
      }
  
      // Update the COMBO
      existingCombo.comboName = comboName;
      existingCombo.description = description;
      existingCombo.image = comboImg;
      existingCombo.offer = offer ? offer: null;
      existingCombo.groups = comboGroupIds;
      existingCombo.addOns = addOns;
      existingCombo.comboPrice = comboPrice;
      existingCombo.createdById = user._id;
      existingCombo.createdBy = user.name;
      await existingCombo.save();
  
      return res.status(200).json({ message: "Combo updated successfully!", data: existingCombo });
  
    } catch (err) {
      next(err)
    }
  };




  export const   getAllCombo = async(req,res,next)=>{
    try {

          const { restaurantId } = req.params;

          const userId = req.user;
            const user = await USER.findOne({ _id: userId  })
          if (!user) {
            return res.status(400).json({ message: "User not found!" });
          }
      
          if (!restaurantId) {
            return res.status(400).json({ message: "restaurantId is required!" });
          }

        // Role-based restaurant access check
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

        const combos  = await COMBO.find({ restaurantId: restaurant._id , isDeleted:false }).sort({ createdAt:-1})

        return res.status(200).json({ data: combos });
       
        

    } catch (err) {
      next(err)
    }
  }



  export const getOneCombo = async (req, res, next) => {
    try {
      const { restaurantId, comboId } = req.params;
      const userId = req.user;
  
      const user = await USER.findOne({ _id: userId });
      if (!user) return res.status(400).json({ message: "User not found!" });
      if (!restaurantId) return res.status(400).json({ message: "restaurantId is required!" });
      if (!comboId) return res.status(400).json({ message: "comboId is required!" });
  
      let filter = {};
      if (user.role === "CompanyAdmin") {
        filter = { _id: restaurantId, companyAdmin: user._id };
      } else if (user.role === "User") {
        filter = { _id: restaurantId };
      } else {
        return res.status(403).json({ message: "Unauthorized!" });
      }
  
      const restaurant = await RESTAURANT.findOne(filter);
      if (!restaurant) return res.status(404).json({ message: "Restaurant not found!" });
  
      const combo = await COMBO.aggregate([
        {
          $match: {
            _id: new mongoose.Types.ObjectId(comboId),
            restaurantId: new mongoose.Types.ObjectId(restaurantId),
          },
        },
        {
          $lookup: {
            from: "addons",
            let: { addOnIds: "$addOns.addOnId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $in: ["$_id", "$$addOnIds"] },
                    ],
                  },
                },
              },
              {
                $project: {
                  _id: 1,
                  name: 1,
                  price: 1,
                  portion: 1,
                },
              },
            ],
            as: "addOnDetails",
          },
        },
        {
          $addFields: {
            addOns: {
              $map: {
                input: "$addOns",
                as: "addOnEntry",
                in: {
                  $let: {
                    vars: {
                      matchedAddOn: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: "$addOnDetails",
                              as: "detail",
                              cond: {
                                $eq: ["$$detail._id", "$$addOnEntry.addOnId"],
                              },
                            },
                          },
                          0,
                        ],
                      },
                    },
                    in: {
                      addOnId: "$$addOnEntry.addOnId",
                      portion_id: "$$addOnEntry.portion_id",
                      name: "$$matchedAddOn.name",
                      portion: {
                        $cond: {
                          if: { $ifNull: ["$$addOnEntry.portion_id", false] },
                          then: {
                            $let: {
                              vars: {
                                matchedPortion: {
                                  $arrayElemAt: [
                                    {
                                      $filter: {
                                        input: {
                                          $ifNull: ["$$matchedAddOn.portion", []],
                                        },
                                        as: "portion",
                                        cond: {
                                          $eq: [
                                            "$$portion._id",
                                            "$$addOnEntry.portion_id",
                                          ],
                                        },
                                      },
                                    },
                                    0,
                                  ],
                                },
                              },
                              in: {
                                name: "$$matchedPortion.name",
                                price: "$$matchedPortion.price",
                              },
                            },
                          },
                          else: null,
                        },
                      },
                      price: {
                        $cond: {
                          if: { $not: ["$$addOnEntry.portion_id"] },
                          then: "$$matchedAddOn.price",
                          else: "$$REMOVE",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        {
          $lookup: {
            from: "combogroups",
            let: { groupIds: "$groups" },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ["$_id", "$$groupIds"] }
                }
              },
              { $sort: { createdAt: 1 } },
              {
                $project: {
                  _id: 1,
                  groupName: 1,
                  required: 1,
                  min: 1,
                  max: 1,
                  maxValue: 1,
                  foodItems: 1,
                  createdAt: 1
                }
              }
            ],
            as: "groups",
          },
        },
        { $unwind: { path: "$groups", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$groups.foodItems", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "foods",
            let: { foodId: "$groups.foodItems.foodId" },
            pipeline: [
              { 
                $match: { 
                  $expr: { 
                    $eq: [
                      "$_id", 
                      { $cond: { 
                        if: { $ne: [ { $type: "$$foodId" }, "objectId" ] }, 
                        then: { $toObjectId: "$$foodId" }, 
                        else: "$$foodId" 
                      } }
                    ] 
                  } 
                } 
              },
              {
                $lookup: {
                  from: "choices",
                  localField: "choices",
                  foreignField: "_id",
                  as: "choices",
                },
              },
              {
                $project: {
                  foodName: 1,
                  image: 1,
                  foodType: 1,
                  price: 1,
                  portions: 1,
                  choices: {
                    $map: {
                      input: "$choices",
                      as: "choice",
                      in: {
                        name: "$$choice.name",
                        optionType: "$$choice.optionType",
                        isRequired: "$$choice.isRequired",
                      },
                    },
                  },
                },
              },
            ],
            as: "groups.foodItems.food",
          },
        },
        { $unwind: { path: "$groups.foodItems.food", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            "groups.foodItems.portion": {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$groups.foodItems.food.portions",
                    as: "portion",
                    cond: { $eq: ["$$portion._id", "$groups.foodItems.portionId"] },
                  },
                },
                0,
              ],
            },
          },
        },
        {
          $group: {
            _id: {
              comboId: "$_id",
              groupId: "$groups._id",
              groupName: "$groups.groupName",
              required: "$groups.required",
              min: "$groups.min",
              max: "$groups.max",
              maxValue: "$groups.maxValue",
              createdAt: "$groups.createdAt"
            },
            foodItems: { $push: "$groups.foodItems" },
            root: { $first: "$$ROOT" },
          },
        },
        {
          $sort: {
            "_id.createdAt": 1
          }
        },
        {
          $group: {
            _id: "$_id.comboId",
            comboName: { $first: "$root.comboName" },
            image: { $first: "$root.image" },
            description: { $first: "$root.description" },
            comboPrice: { $first: "$root.comboPrice" },
            restaurantId: { $first: "$root.restaurantId" },
            addOns: { $first: "$root.addOns" },
            offer: { $first: "$root.offer" }, // Added offer field
            createdAt: { $first: "$root.createdAt" }, // Added createdAt
            updatedAt: { $first: "$root.updatedAt" }, // Added updatedAt
            groups: {
              $push: {
                groupId: "$_id.groupId",
                groupName: "$_id.groupName",
                required: "$_id.required",
                min: "$_id.min",
                max: "$_id.max",
                maxValue: "$_id.maxValue",
                foodItems: "$foodItems",
              },
            },
          },
        },
        // Optional: Add current date check for active offers
        {
          $addFields: {
            "offer.isActive": {
              $and: [
                { $ifNull: ["$offer.startDate", false] },
                { $ifNull: ["$offer.endDate", false] },
                { $lte: ["$offer.startDate", new Date()] },
                { $gte: ["$offer.endDate", new Date()] }
              ]
            }
          }
        }
      ]);
  
      return res.status(200).json({ data: combo[0] || null });
    } catch (error) {
      next(error);
    }
  };


  export const deleteCombo = async (req, res, next) => {
    try {
      const { comboId } = req.params;
      const userId = req.user;
  
      if (!comboId) {
        return res.status(400).json({ message: "Combo Id is required!" });
      }
  
        const user = await USER.findOne({ _id: userId,  })
      if (!user) {
        return res.status(400).json({ message: "User not found!" });
      }
  
      const combo = await COMBO.findById(comboId);
      if (!combo) {
        return res.status(404).json({ message: "Combo not found!" });
      }
  
      await COMBO.findByIdAndDelete(comboId)
  
      return res.status(200).json({ message: "Combo deleted successfully!" });
  
    } catch (err) {
      next(err);
    }
  };