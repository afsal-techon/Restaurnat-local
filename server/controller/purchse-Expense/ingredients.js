import INGREDIENT from '../../model/ingredients.js'
import ACCOUNTS from '../../model/account.js'
import USER from '../../model/userModel.js';
import TRANSACTION from '../../model/transaction.js';

export const createIngredient = async (req, res, next) => {
    try {
      const {
        ingredient,
        purchaseUnit,
      } = req.body;
  
      const userId = req.user;
  
      const user = await USER.findOne({ _id: userId});
      if (!user) {
        return res.status(400).json({ message: "User not found!" });
      }
  
  
      if (!ingredient || typeof ingredient !== "string" || !ingredient.trim()) {
        return res.status(400).json({ message: "Ingredient name is required!" });
      }
      
      if (!purchaseUnit) {
        return res.status(400).json({ message: "Purchase unit is required!" });
      }
  
      // Check for duplicate ingredient names
      const existingIngredient = await INGREDIENT.find({
        ingredient: { $regex: `^${ingredient}$`, $options: "i" },
      }).collation({ locale: "en", strength: 2 });
  
      if (existingIngredient.length > 0) {
        return res.status(400).json({
          message: `The ingredient '${ingredient}' already exists!`,
        });
      }
  
    const ingredientData = {
  ingredient: ingredient.trim(),
  purchaseUnit,
  createdById: user._id,
  createdBy: user.name,
};

const created = await INGREDIENT.create(ingredientData);
  
      return res.status(201).json({
        message: "Ingredients added successfully!",
        data: created,
      });
    } catch (err) {
      next(err);
    }
  };


    export const getAllIngredients = async (req, res, next) => {
    try {

      const userId = req.user;
  
      const user = await USER.findOne({ _id: userId });
      if (!user) {
        return res.status(400).json({ message: "User not found!" });
      }
  
      const ingredients = await INGREDIENT.find({
      }).sort({ createdAt: -1 });

       return res.status(200).json({
       data: ingredients,
      });
    } catch (err) {
      next(err);
    }
  };

    export const updateIngredient = async (req,res,next)=>{
    try {
      const {
        ingredientId,
        ingredient,
        purchaseUnit,
      } = req.body;

      const userId = req.user;

      if(!ingredientId){
        return res.status(400).json({ message:'Ingredient ID is required!'})
      };

      const user = await USER.findOne({ _id: userId})
      if (!user) {
        return res.status(400).json({ message: "User not found!" });
      }

      const existing = await INGREDIENT.findOne({
        _id: ingredientId
      });

      if (!existing) {
        return res.status(404).json({ message: "Ingredient not found!" });
      }


    if (ingredient && ingredient.trim().toLowerCase() !== existing.ingredient.toLowerCase()) {
      const duplicate = await INGREDIENT.findOne({
        _id: { $ne: ingredientId },
        ingredient: { $regex: `^${ingredient}$`, $options: "i" },
      }).collation({ locale: "en", strength: 2 });

      if (duplicate) {
        return res.status(400).json({
          message: `The ingredient '${ingredient}' already exists!`,
        });
      }
    }

    if (ingredient) existing.ingredient = ingredient.trim();
    if (purchaseUnit) existing.purchaseUnit = purchaseUnit;;
    await existing.save();

    return res.status(200).json({ message:'Ingredient updated successfully!',data:existing})

      
    } catch (err) {
      next(err)
      
    }

  }

    export const deleteIngredient = async (req, res, next) => {
    try {
      const { ingredientId } = req.params;
      const userId = req.user;
  
      if (!ingredientId) {
        return res.status(400).json({ message: "Ingredient Id is required!" });
      }
  
      const user = await USER.findOne({ _id: userId});
      if (!user) {
        return res.status(400).json({ message: "User not found!" });
      }
  
      const ingredient = await INGREDIENT.findById(ingredientId);
      if (!ingredient) {
        return res.status(404).json({ message: "Ingredient not found!" });
      }
  
      await INGREDIENT.findByIdAndDelete()
  
      return res.status(200).json({ message: "Ingredient deleted successfully!" });
    } catch (err) {
      next(err);
    }
  };
  