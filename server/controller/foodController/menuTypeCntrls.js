import MENUTYPE from '../../model/menuType.js'
import USER from '../../model/userModel.js';
import RESTAURANT from '../../model/restaurant.js'
import COURSE from '../../model/course.js'

export const CreateMenuType = async(req,res,next)=>{
    try {

        const { restaurantIds , menuTypes  } = req.body;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId  })
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

        if (!restaurantIds || !Array.isArray(restaurantIds) || restaurantIds.length === 0) {
            return res.status(400).json({ message: "Restaurant IDs are required!" });
        }


        if (!menuTypes || !Array.isArray(menuTypes) || menuTypes.length === 0) {
            return res.status(400).json({ message: "Menu type are required!" });
        }

        for(const menuType of menuTypes){
            if(!menuType.name){
                return res.status(400).json({ message: "Menu type name is required!" });
            }
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

                 
              // Collect all potential duplicates in one batch query
              const menuTypeNames = menuTypes.map((menu) => menu.name.trim().toLowerCase());;
              const existingMenuType = await MENUTYPE.find({
                  restaurantId: { $in: restaurantIds },
                  name: { $in: menuTypeNames }, // Case-insensitive match
                  isDeleted:false,
              }).collation({ locale: 'en', strength: 2 });
      
              if (existingMenuType.length > 0) {
                  const duplicateNames = existingMenuType.map(
                      (menu) => `Restaurant ID: ${menu.restaurantId}, Menu: ${menu.name}`
                  );
                  return res.status(400).json({
                      message: `Menu Type already exists in the specified restaurant!`,
                  });
              }

              // Prepare department data for bulk insertion 
          const menuTypeData = [];

          for (const restaurant of restaurants) {
            for(const menu of menuTypes){
                menuTypeData.push({
                   name:menu.name,
                   restaurantId :restaurant._id,
                   createdById : user._id,
                   createdBy: user.name,
               })
            }

         }

         const createMenutypes = await MENUTYPE.insertMany(menuTypeData);

         return res.status(201).json({
            message: "Menu type added successfully!",
            data: createMenutypes,
        });


        
    } catch (err) {
        next(err)
    }
}

export const getAllMenuTypes = async (req,res,next)=>{
    try{

        const { restaurantId  } = req.params;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId,  })
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

          const menuTypes = await MENUTYPE.find({  restaurantId  }).sort({ createdAt: -1 });
        

          return res.status(200).json({ data: menuTypes })

    }catch(err){
        next(err)
    }
}

export const updateMenuTypes = async (req,res,next)=>{
    try{

       
        const { restaurantId ,menuTypeId , name } = req.body;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId,  })
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant ID is required!" });
        }

        if (!menuTypeId) {
            return res.status(400).json({ message: "Menu type ID is required!" });
        }
        if (!name || typeof name !== "string" || name.trim().length === 0) {
            return res.status(400).json({ message: "New menu type name is required!" });
        }

        let filter = {};

        // Access control based on user role
        if (user.role === "CompanyAdmin") {
            filter = { _id: restaurantId, companyAdmin: user._id };
        } else if (user.role === "User") {
            filter = { _id: restaurantId };
        } else {
            return res.status(403).json({ message: "Unauthorized access!" });
        }

        const restaurant = await RESTAURANT.findOne(filter);
        if (!restaurant) {
            return res.status(404).json({ message: "No matching restaurants found!" });
        }


         const menuType = await MENUTYPE.findOne({ _id: menuTypeId, restaurantId });
         if (!menuType) {
             return res.status(404).json({ message: "Menu type not found!" });
         }

         const existMenuType = await MENUTYPE.findOne({
            restaurantId,
            name: name.trim(),
            _id: { $ne: menuTypeId }, // Exclude the current department
        });

         if(existMenuType){
            return res.status(400).json({
                message: `Menu type already exists in the specified restaurant!`,
            });
         }

         if (menuType.name === name.trim()) {
            return res.status(400).json({ message: "New menu type name is the same as the current name!" });
        }

        menuType.name = name.trim();
         await menuType.save();
     
         return res.status(200).json({
            message: "Menu type updated successfully!",
            data: menuType,
        });
 
    }catch(err){
        next(err)
    }
}

export const deleteMenuTypes = async (req,res,next)=>{
    try{

       
        const { restaurantId ,menuTypeId } = req.body;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId,  })
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant ID is required!" });
        }

        if (!menuTypeId) {
            return res.status(400).json({ message: "Menu type ID is required!" });
        }
       

        let filter = {};

        // Access control based on user role
        if (user.role === "CompanyAdmin") {
            filter = { _id: restaurantId, companyAdmin: user._id };
        } else if (user.role === "User") {
            filter = { _id: restaurantId };
        } else {
            return res.status(403).json({ message: "Unauthorized access!" });
        }

        const restaurant = await RESTAURANT.findOne(filter);
        if (!restaurant) {
            return res.status(404).json({ message: "No matching restaurants found!" });
        }

         // Verify if the department exists in the restaurant
         const menType = await MENUTYPE.findOne({ _id: menuTypeId, restaurantId });
         if (!menType) {
             return res.status(404).json({ message: "Menuu type not found!" });
         }

            await MENUTYPE.findByIdAndDelete(menuTypeId)
      
         return res.status(200).json({
            message: "Meny type deleted successfully!",
        });
 
    }catch(err){
        next(err)
    }
}




export const createCourse = async (req,res,next)=>{
    try{


        const { restaurantIds , courses  } = req.body;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId })
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

        if (!restaurantIds || !Array.isArray(restaurantIds) || restaurantIds.length === 0) {
            return res.status(400).json({ message: "Restaurant IDs are required!" });
        }

        if (!courses || !Array.isArray(courses) || courses.length === 0) {
            return res.status(400).json({ message: "courses are required!" });
        }

      for(const course of courses){
        if(!course.name){
            return res.status(400).json({ message: "Course name is required!" });
        }
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

              // Collect all potential duplicates in one batch query
              const courseNames = courses.map((dept) => dept.name.trim().toLowerCase());
              const existingCourse = await COURSE.find({
                  restaurantId: { $in: restaurantIds },
                  name: { $in: courseNames },
                  isDeleted:false,
              }).collation({ locale: 'en', strength: 2 });
      
              if (existingCourse.length > 0) {
                  const duplicateNames = existingCourse.map(
                      (dept) => `Restaurant ID: ${dept.restaurantId}, Course: ${dept.name}`
                  );
                  return res.status(400).json({
                      message: `Course already exists in the specified restaurant!`,
                  });
              }

    

          // Prepare department data for bulk insertion 
          const courseData = [];

          for (const restaurant of restaurants) {
             for(const cour of courses){
                courseData.push({
                    name:cour.name,
                    restaurantId :restaurant._id,
                    createdById : user._id,
                    createdBy: user.name,
                })
             }
          }

          const createCourse = await COURSE.insertMany(courseData);

          return res.status(201).json({
            message: "Course added successfully!",
            data: createCourse,
        });

    }catch(err){
        next(err)
    }
}


export const getAllCourses = async (req,res,next)=>{
    try{

        const { restaurantId  } = req.params;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId })
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

  

          const courseItems = await COURSE.find({  restaurantId }).sort({ createdAt: -1 });
          return res.status(200).json({ data: courseItems })

    }catch(err){
        next(err)
    }
}


export const updateCourse = async (req,res,next)=>{
    try{

       
        const { restaurantId ,courseId , name } = req.body;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId })
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant ID is required!" });
        }

        if (!courseId) {
            return res.status(400).json({ message: "Course ID is required!" });
        }
        if (!name || typeof name !== "string" || name.trim().length === 0) {
            return res.status(400).json({ message: "New course name is required!" });
        }

        let filter = {};

        // Access control based on user role
        if (user.role === "CompanyAdmin") {
            filter = { _id: restaurantId, companyAdmin: user._id };
        } else if (user.role === "User") {
            filter = { _id: restaurantId };
        } else {
            return res.status(403).json({ message: "Unauthorized access!" });
        }

        const restaurant = await RESTAURANT.findOne(filter);
        if (!restaurant) {
            return res.status(404).json({ message: "No matching restaurants found!" });
        }

         // Verify if the department exists in the restaurant
         const course = await COURSE.findOne({ _id: courseId, restaurantId });
         if (!course) {
             return res.status(404).json({ message: "Course not found!" });
         }

         const existCourse = await COURSE.findOne({
            restaurantId,
            name: name.trim(),
            _id: { $ne: courseId }, // Exclude the current department
        });

         if(existCourse){
            return res.status(400).json({
                message: `Course already exists in the specified restaurant!`,
            });
         }

         if (course.name === name.trim()) {
            return res.status(400).json({ message: "New Course name is the same as the current name!" });
        }

         course.name = name.trim();
         await course.save();

         return res.status(200).json({
            message: "Course updated successfully!",
            data: course,
        });
 
    }catch(err){
        next(err)
    }
}



export const deleteCourse = async (req,res,next)=>{
    try{

       
        const { restaurantId ,courseId } = req.body;

        const userId = req.user;

          const user = await USER.findOne({ _id: userId })
        if (!user) {
            return res.status(400).json({ message: "User not found!" });
        }

        if (!restaurantId) {
            return res.status(400).json({ message: "Restaurant ID is required!" });
        }

        if (!courseId) {
            return res.status(400).json({ message: "Course ID is required!" });
        }
       

        let filter = {};

        // Access control based on user role
        if (user.role === "CompanyAdmin") {
            filter = { _id: restaurantId, companyAdmin: user._id };
        } else if (user.role === "User") {
            filter = { _id: restaurantId };
        } else {
            return res.status(403).json({ message: "Unauthorized access!" });
        }

        const restaurant = await RESTAURANT.findOne(filter);
        if (!restaurant) {
            return res.status(404).json({ message: "No matching restaurants found!" });
        }

         // Verify if the department exists in the restaurant
         const course = await COURSE.findOne({ _id: courseId, restaurantId });
         if (!course) {
             return res.status(404).json({ message: "Course not found!" });
         }


            await COURSE.findByIdAndDelete(courseId)
            
         return res.status(200).json({
            message: "Course deleted successfully!",
        });
 
    }catch(err){
        next(err)
    }
}