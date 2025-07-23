import mongoose from "mongoose";
import MENUTYPE from '../../model/menuType.js'
import USER from '../../model/userModel.js';
import RESTAURANT from '../../model/restaurant.js'
import COURSE from '../../model/course.js'
import CATEGORY from '../../model/category.js'
import CHOICE from "../../model/choice.js";
import FOOD from '../../model/food.js'
import { getIO  } from "../../config/socket.js";
import ORDER from '../../model/oreder.js';
import COMBOGROUP from '../../model/comboGroup.js'



export const createFood = async (req, res, next) => {
  try {

    let {
      foodName,
      restaurantId,
      foodType,
      categoryId,
      kitchenId ,
      prices,
      basePrice,
      menuTypeIds,
      courseIds,
      portions,
      special,
      addOnsIds,
      choices,
      offer,
      preperationTime,

    } = req.body;

    const foodImg = req.file ? `/uploads/${req.file.filename}` : null;

  
    if (typeof menuTypeIds === "string") {
      menuTypeIds = JSON.parse(menuTypeIds); // Parse string into array if necessary
    }

    if (typeof courseIds === "string" && courseIds.trim() !== "") {
      courseIds = JSON.parse(courseIds);
    } else {
      courseIds = [];
    }
  

    if (typeof portions === "string") {
      portions = JSON.parse(portions); // Parse the string into an actual array of objects
    }
    if (typeof prices === "string") {
      prices = JSON.parse(prices);
    }

    if (typeof addOnsIds === "string") {
      addOnsIds = JSON.parse(addOnsIds); // Parse the string into an actual array of objects
    }
    if (typeof choices === "string") {
      choices = JSON.parse(choices); // Parse the string into an actual array of objects
    }

    if (typeof offer === "string") {
      offer = JSON.parse(offer);
    }

    


    if (Array.isArray(menuTypeIds)) {
      menuTypeIds = menuTypeIds.map((id) => new mongoose.Types.ObjectId(id)); // Convert each string ID to ObjectId
    } else {
      return res.status(400).json({ message: "menuTypeIds must be an array!" });
    }

    if (Array.isArray(courseIds)) {
      courseIds = courseIds.map((id) => new mongoose.Types.ObjectId(id)); // Convert each string ID to ObjectId
    } else {
      courseIds = [];
    }

    const userId = req.user;

      const user = await USER.findOne({ _id: userId})
    if (!user) {
      return res.status(400).json({ message: "User not found!" });
    }

    if (!restaurantId) {
      return res.status(400).json({ message: "Restaurant ID are required!" });
    }
    if (!foodName)
      return res.status(400).json({ message: "Food name is required!" });
    if (!foodType)
      return res.status(400).json({ message: "Food type is required!" });
    if (!categoryId)
      return res.status(400).json({ message: "Category Id is required!" });

    const duplicateFood = await FOOD.findOne({
      foodName: { $regex: `^${foodName}$`, $options: "i" },
      restaurantId,
    });

    if (duplicateFood) {
      return res
        .status(400)
        .json({ message: "Food with this name already exists!" });
    }

    // Validate portions
    if (Array.isArray(portions)) {
      for (const p of portions) {
        if (!p.name) {
          return res
            .status(400)
            .json({ message: "Each portion must include a name,price" });
        }
        if (!Array.isArray(p.prices) || p.prices.length === 0) {
          return res.status(400).json({ message: "Each portion must have prices." });
        }
      }
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

    const restaurant = await RESTAURANT.find(filter);
    if (!restaurant) {
      return res.status(404).json({ message: "No matching restaurant found!" });
    }

    const category = await CATEGORY.findOne({
      _id: categoryId,
      restaurantId,
      
    });
    if (!category)
      return res.status(404).json({ message: "Category not found!" });


    

    const validMenuTypes = await MENUTYPE.find({
      _id: { $in: menuTypeIds },
      restaurantId,
      
    });
    if (validMenuTypes.length !== menuTypeIds.length) {
      return res
        .status(400)
        .json({
          message: "One or more menuTypeIds are invalid for restaurant!",
        });
    }

 

    if (courseIds.length > 0) {
      const validCourses = await COURSE.find({
        _id: { $in: courseIds },
        restaurantId,
        
      });
      if (validCourses.length !== courseIds.length) {
        return res.status(400).json({ message: "One or more courseIds are invalid for the restaurant!" });
      }
    }

    const choiceIds = [];

    if (Array.isArray(choices) && choices.length > 0) {
     
      for (const choiceName of choices) {
    
        let existingChoice = await CHOICE.findOne({
          name: choiceName,
          restaurantId,
          
        });
        if (existingChoice) {
          choiceIds.push(existingChoice._id);
        } else {
          const newChoice = await CHOICE.create({
            name: choiceName,
            restaurantId,
            createdById: user._id,
            createdBy:user.name,
           
          });
         
          choiceIds.push(newChoice._id);
          
        }
      }
    }


    const newFood = await FOOD.create({
      foodName,
      restaurantId,
      categoryId,
      image : foodImg ,
      foodType,
      menuTypeIds,
      courseIds,
      prices: portions && portions.length > 0 ? null : prices,
      basePrice : portions && portions.length > 0 ? null : basePrice,
      portions: portions || [],
      special: special || false,
      addOnsIds,
      kitchenId : kitchenId || null,
      choices: choiceIds,
      offer: offer ? offer : null,
      special: special ? special : false,
      preperationTime: preperationTime || null,
      createdById: user._id,
      createdBy:user.name,
      
    });

    const io = getIO();
    io.to(`pos-${restaurantId}`).emit("food-updated", { restaurantId });

    return res
      .status(201)
      .json({ message: "Food created successfully", data: newFood });
  } catch (err) {
    next(err);
  }
};





export const getAllFoodbyRestaurat = async (req, res, next) => {
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


    const food = await FOOD.find({ restaurantId })
    .sort({ createdAt: -1 })
    .populate([
      { path: "categoryId", select: "name" },
      { path: "menuTypeIds", select: "name" },
      { path: "kitchenId", select: "name" },
      { path: "courseIds", select: "name" },
      { path: "addOnsIds", select: "name" },
      { path: "choices", select: "name" },
      { 
        path: "prices.customerTypeId", 
        select: "type",
        model: "customerTypes" 
      },
      {
        path: "portions.prices.customerTypeId",
        select: "type",
        model: "customerTypes"
      }
    ]); 


    return res.status(200).json({ data: food });
  } catch (err) {
    next(err);
  }
};

export const updateFood = async (req, res, next) => {
  try {
    let {
      foodId,
      foodName,
      restaurantId,
      foodType,
      categoryId,
      basePrice,
      prices,
      kitchenId,
      menuTypeIds,
      courseIds,
      portions,
      special,
      addOnsIds,
      choices,
      preperationTime,
      offer,
    } = req.body;




    const userId = req.user;
      const user = await USER.findOne({ _id: userId, })
    if (!user) {
      return res.status(400).json({ message: "User not found!" });
    }

    if (!restaurantId) {
      return res.status(400).json({ message: "restaurant id is required!" });
    }
    if (!foodId) {
      return res.status(400).json({ message: "Food id  is required!" });
    }

    if (typeof menuTypeIds === "string") menuTypeIds = JSON.parse(menuTypeIds);
    if (typeof courseIds === "string" && courseIds.trim() !== "") {
      courseIds = JSON.parse(courseIds);
    } else {
      courseIds = [];
    }
    if (typeof portions === "string") portions = JSON.parse(portions);
    if (typeof addOnsIds === "string") addOnsIds = JSON.parse(addOnsIds);
    if (typeof choices === "string") choices = JSON.parse(choices);
    if (typeof offer === "string")  offer = JSON.parse(offer);
    if (typeof prices === "string") {
      prices = JSON.parse(prices);
    }
    

    if (menuTypeIds && !Array.isArray(menuTypeIds))
      return res.status(400).json({ message: "menuTypeIds must be an array!" });


    const duplicateFood = await FOOD.findOne({
      _id: { $ne: foodId },
      foodName: { $regex: `^${foodName}$`, $options: "i" },
      restaurantId,
      
    });

    if (duplicateFood) {
      return res
        .status(400)
        .json({ message: "Food with this name already exists!" });
    }

  

    const food = await FOOD.findOne({ _id: foodId, });
    if (!food) return res.status(404).json({ message: "Food not found!" });

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
    if (!restaurant)
      return res.status(404).json({ message: "No matching restaurant found!" });

    const category = await CATEGORY.findOne({
      _id: categoryId,
      restaurantId,
      
    });
    if (!category)
      return res.status(404).json({ message: "Category not found!" });

    const validMenuTypes = await MENUTYPE.find({
      _id: { $in: menuTypeIds },
      restaurantId,
      
    });
    if (validMenuTypes.length !== menuTypeIds.length) {
      return res.status(400).json({ message: "Invalid menu types!" });
    }

    if (courseIds.length > 0) {
      const validCourses = await COURSE.find({
        _id: { $in: courseIds },
        restaurantId,
        
      });
      if (validCourses.length !== courseIds.length) {
        return res.status(400).json({ message: "One or more courseIds are invalid for the restaurant!" });
      }
    }

    const choiceIds = [];
    if (Array.isArray(choices) && choices.length > 0) {
      for (const choiceName of choices) {
        let existingChoice = await CHOICE.findOne({
          name: choiceName,
          restaurantId,
          
        });
        if (existingChoice) {
          choiceIds.push(existingChoice._id);
        } else {
          const newChoice = await CHOICE.create({
            name: choiceName,
            restaurantId,
            createdById: user._id,
            createdBy:user.name,
           
          });
          choiceIds.push(newChoice._id);
        }
      }
    }

      const foodImg = req.file ? `/uploads/${req.file.filename}` : food.image;

    food.foodName = foodName;
    food.restaurantId = restaurantId;
    food.categoryId = categoryId;
    food.foodType = foodType;
    food.menuTypeIds = menuTypeIds;
      food.image = foodImg
    food.image = foodImg;
    food.courseIds = courseIds;
    food.prices = portions && portions.length > 0 ? null : prices;
    food.basePrice = portions && portions.length > 0 ? null : basePrice,
    food.portions = portions || [];
    food.kitchenId = kitchenId || null;
    food.special = special || false;
    food.addOnsIds = addOnsIds;
    food.preperationTime = preperationTime;
    food.choices = choiceIds;
    (food.offer = offer ? offer : null), 

    await food.save();

    const io = getIO();
    io.to(`pos-${restaurantId}`).emit("food-updated", { restaurantId });
  

    return res
      .status(200)
      .json({ message: "Food updated successfully", data: food });
  } catch (err) {
    next(err);
  }
};

export const getOneFood = async (req, res, next) => {
  try {
    const { foodId } = req.params;
    const userId = req.user;
      const user = await USER.findOne({ _id: userId, })
    if (!user) {
      return res.status(400).json({ message: "User not found!" });
    }


    const food = await FOOD.findOne({ _id: foodId, })
    .populate([
      { path: "categoryId", select: "name" },
      { path: "menuTypeIds", select: "name" },
      { path: "kitchenId", select: "name" },
      { path: "courseIds", select: "name" },
      { path: "addOnsIds", select: "name" },
      { path: "choices", select: "name" },
      { 
        path: "prices.customerTypeId", 
        select: "type",
        model: "CustomerType" 
      },
      {
        path: "portions.prices.customerTypeId",
        select: "type",
        model: "CustomerType"
      }
    ]);

    if (!food) {
      return res.status(404).json({ message: "Food not found!" });
    }

    return res.status(200).json({ data: food });
  } catch (err) {
    next(err);
  }
};


export const deleteFood = async (req, res, next) => {
  try {
    const { foodId } = req.params;
    const userId = req.user;

    if (!foodId) {
      return res.status(400).json({ message: "Food ID is required!" });
    }

      const user = await USER.findOne({ _id: userId, })
    if (!user) {
      return res.status(400).json({ message: "User not found!" });
    }

    const food = await FOOD.findById(foodId);
    if (!food) {
      return res.status(404).json({ message: "Food not found!" });
    }

    
    //  Check: foodId used in direct order items
     const usedInOrders = await ORDER.exists({ "items.foodId": foodId });
    if (usedInOrders) {
      return res.status(400).json({ message: "Cannot delete this food item. It is used in orders." });
    }

       //  Check: foodId used in nested combo items inside order
    const usedInNestedOrderCombos = await ORDER.exists({ "items.items.foodId": foodId });
    if (usedInNestedOrderCombos) {
      return res.status(400).json({ message: "Cannot delete this food item. It is used in combo items in orders." });
    }

       //  Check: foodId used in combo groups
    const usedInComboGroups = await COMBOGROUP.exists({ "foodItems.foodId": foodId });
    if (usedInComboGroups) {
      return res.status(400).json({ message: "Cannot delete this food item. It is used in combos." });
    }

    await FOOD.findByIdAndDelete(foodId)

 
    // Emit to notify clients of the update
    const io = getIO();
    io.to(`pos-${food.restaurantId}`).emit("food-updated", { restaurantId: food.restaurantId });
  
    return res.status(200).json({ message: "Food deleted successfully!" });

  } catch (err) {
    next(err);
  }
};



