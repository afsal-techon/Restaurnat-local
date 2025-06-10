import CATEGORY from '../../model/category.js'
import USER from '../../model/userModel.js';
import RESTAURANT from '../../model/restaurant.js'



export const createCategory = async(req,res,next)=>{
    try {
        
        const { restaurantIds , name  } = req.body;

        const userId = req.user;

       

          const user = await USER.findOne({ _id: userId })
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }


        if(!name){
            return res.status(400).json({ message:'Category name is required!'})
        }

          let filter = {};
        
              if(user.role === "CompanyAdmin"){
                filter = { _id: { $in: restaurantIds }, companyAdmin: user._id };
              }else if( user.role === 'User'){
                filter = { _id: { $in: restaurantIds }};
              }else{
                return res.status(403).json({ message: "Unauthorized!" });
              }
        
              const restaurants = await RESTAURANT.find(filter);
                if (!restaurants || restaurants.length === 0) {
                    return res.status(404).json({ message: "No matching restaurants found!" });
        }
        const existingCategory = await CATEGORY.findOne({
            name: { $regex: `^${name}$`, $options: "i" },
            restaurantId: { $in: restaurantIds },
          });

          if (existingCategory) {
            return res.status(409).json({
                  message:`category name '${existingCategory.name}' is already used in the selected restaurant!`
            });
          }  

              const createdCategories = [];

              for(const restaurant of restaurants){
                const category = new CATEGORY({
                    name,
                    restaurantId: restaurant._id,
                    createdById: user._id,
                    createdBy:user.name
                })
    
              const saved = await category.save();
              createdCategories.push(saved);

            //   req.io?.to(`pos_category-${restaurant._id}`).emit("category-updated", { restaurantId: restaurant._id });
            //   req.io?.to(`pos-${restaurant._id}`).emit("food-updated",{ restaurantId : restaurant._id});
            
            }

            return res.status(200).json({ message:'Category created successfylly!',data:createdCategories})

        
    } catch (err) {
        next(err)
    }
}

export const getAllCategories = async (req, res, next) => {
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
      next(err);
    }
  }

  export const updateCategory = async (req, res, next) => {
    try {
        const { categoryId, restaurantId, name } = req.body;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId })
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

        // Validate categoryId and restaurantId
        if (!categoryId) {
            return res.status(400).json({ message: "Category ID are required!" });
        }
        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant ID are required!" });
        }

        if (!name) {
            return res.status(400).json({ message: "Category name is required!" });
        }

        // Find the category to be updated
        let category = await CATEGORY.findOne({ _id: categoryId, restaurantId: restaurantId });
        if (!category) {
            return res.status(404).json({ message: "Category not found!" });
        }

        // Check if the user has permission to update the category
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
            return res.status(404).json({ message: "Restaurant not found or user doesn't have permission!" });
        }

        // Check if the new name is already taken in the restaurant
        const existingCategory = await CATEGORY.findOne({
            name: { $regex: `^${name}$`, $options: "i" },
            restaurantId: restaurantId,
            _id: { $ne: categoryId }  //  Exclude current category
        });
        
        if (existingCategory) {
            return res.status(409).json({
                message:`category name '${existingCategory.name}' is already used!`
            });
        }

        category.name = name;

        const updatedCategory = await category.save();

        // req.io?.to(`pos_category-${restaurant._id}`).emit("category-updated", { restaurantId: restaurant._id });
        // req.io?.to(`pos-${restaurant._id}`).emit("food-updated",{ restaurantId : restaurant._id});


        return res.status(200).json({
            message: "Category updated successfully!",
            data: updatedCategory
        });

    } catch (err) {
        next(err);
    }
};

export const deleteCategory = async (req, res, next) => {
    try {
      const { categoryId } = req.params;
      const userId = req.user;
  
      if (!categoryId) {
        return res.status(400).json({ message: "Category ID is required!" });
      }
  
        const user = await USER.findOne({ _id: userId })
      if (!user) {
        return res.status(400).json({ message: "User not found!" });
      }
  
      const category = await CATEGORY.findById(categoryId);
      if (!category) {
        return res.status(404).json({ message: "Category not found!" });
      }

      await CATEGORY.findByIdAndDelete(categoryId)

    //   req.io?.to(`pos_category-${category.restaurantId}`).emit("category-updated", { restaurantId: category.restaurantId });
    //   req.io?.to(`pos-${category.restaurantId}`).emit("food-updated",{ restaurantId : category.restaurantId});
  

      return res.status(200).json({ message: "Category deleted successfully!" });
  
    } catch (err) {
      next(err);
    }
  };