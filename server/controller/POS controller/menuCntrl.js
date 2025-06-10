
import mongoose from "mongoose";
import MENUTYPE from '../../model/menuType.js'
import USER from '../../model/userModel.js';
import RESTAURANT from '../../model/restaurant.js'
import COURSE from '../../model/course.js'
import CATEGORY from '../../model/category.js'
import FOOD from '../../model/food.js'




export const getAllByCategoryForPOS = async(req,res,next)=>{
    try {

            const { restaurantId } = req.params;
              const userId = req.user;
              const user = await USER.findOne({ _id: userId })
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
      
        
            const categories = await CATEGORY.find({ restaurantId }).sort({ createdAt: -1 });

            return res.status(200).json({
              data: categories,
            });
    } catch (err) {
        next(err)
    }
}






export const getAllFoodForPOS = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user;
      const user = await USER.findOne({ _id: userId, })
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

    const food = await FOOD.find({ restaurantId, })
    .sort({ createdAt: -1 })
    .populate({ path: "categoryId", select: "name" })
    .populate({ path: "kitchenId", select: "name" })
    .populate({ path: "menuTypeIds", select: "name" })     
    .populate({ path: "courseIds", select: "name" })       
    .populate({
      path: "addOnsIds",
      select: "name price portion"
    })      
    .populate({ path: "choices", select: "name" });  



    return res.status(200).json({ data: food });
  } catch (err) {
    next(err);
  }
};




  export const   getAllComboForPOS = async(req,res,next)=>{
    try {

          const { restaurantId } = req.params;

          const userId = req.user;
            const user = await USER.findOne({ _id: userId, })
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


        const combos  = await COMBO.find({ restaurantId: restaurant._id }).sort({ createdAt:-1})

        return res.status(200).json({ data: combos });
       
    } catch (err) {
      next(err)
    }
  }


  

    export const getOneComboForPOS = async (req, res, next) => {
      try {
        const { restaurantId, comboId } = req.params;
        const userId = req.user;
    
        const user = await USER.findOne({ _id: userId, });
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
              restaurantId: new mongoose.Types.ObjectId(restaurantId)
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
                        { $eq: ["$isDeleted", false] },
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
                    $expr: { $eq: ["$_id", "$$foodId"] } 
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



    export const getMenusItemsForPOS = async (req,res,next)=>{
        try{
    
            const { restaurantId  } = req.params;
            const userId = req.user;
    
              const user = await USER.findOne({ _id: userId, })
            if (!user) {
                return res.status(400).json({ message: "User not found!" });
            }
    
            if (!restaurantId) {
                return res.status(400).json({ message: "Restaurant ID is required!" });
            }
    
    
            let filter = {};
    
            if(user.role === "CompanyAdmin"){
              filter = { _id: restaurantId , companyAdmin: user._id };
            }else if( user.role === 'User'){
              filter = { _id: restaurantId };
            }else{
              return res.status(403).json({ message: "Unauthorized!" });
            }
    
    
      
            const restaurant = await RESTAURANT.findOne(filter);
              if (!restaurant) {
                  return res.status(404).json({ message: "No matching restaurants found!" });
              }
              

    
              const menuTypes = await MENUTYPE.find({  restaurantId }).sort({ createdAt: -1 });
            //redis 
    
              return res.status(200).json({ data: menuTypes })
    
        }catch(err){
            next(err)
        }
    }

    

    export const getCourseForPOS = async (req,res,next)=>{
        try{
    
            const { restaurantId  } = req.params;
    
            const userId = req.user;
    
              const user = await USER.findOne({ _id: userId, })
            if (!user) {
                return res.status(400).json({ message: "User not found!" });
            }
    
            if (!restaurantId) {
                return res.status(400).json({ message: "Restaurant ID is required!" });
            }
    
    
            let filter = {};
    
            if(user.role === "CompanyAdmin"){
              filter = { _id: restaurantId , companyAdmin: user._id };
            }else if( user.role === 'User'){
              filter = { _id: restaurantId };
            }else{
              return res.status(403).json({ message: "Unauthorized!" });
            }
    
            // const cacheKey = `departments:restaurant:${restaurantId}`;
    
      
            const restaurant = await RESTAURANT.findOne(filter);
              if (!restaurant) {
                  return res.status(404).json({ message: "No matching restaurants found!" });
              }
    
              const courseItems = await COURSE.find({  restaurantId  }).sort({ createdAt: -1 });
    
               // Store in Redis (set for 1 hour)
            //   await redisClient.setEx(cacheKey, 3600, JSON.stringify(departments));
    
    
    
             
              return res.status(200).json({ data: courseItems })
    
        }catch(err){
            next(err)
        }
    }


    

      export const getComboForPOS = async (req, res, next) => {
        try {
          const { restaurantId } = req.params;
          const userId = req.user;
      
          const user = await USER.findOne({ _id: userId, });
          if (!user) return res.status(400).json({ message: "User not found!" });
          if (!restaurantId) return res.status(400).json({ message: "restaurantId is required!" });
      
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
                restaurantId: new mongoose.Types.ObjectId(restaurantId)
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
                          { $eq: ["$isDeleted", false] },
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
                      $expr: { $eq: ["$_id", "$$foodId"] } 
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
      
          return res.status(200).json({ data: combo || null });
        } catch (error) {
          next(error);
        }
      };