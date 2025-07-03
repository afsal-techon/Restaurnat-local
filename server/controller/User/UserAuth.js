import USER from '../../model/userModel.js'
import RESTAURANT from '../../model/restaurant.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'



// export const createCompanyhAdmin = async (req,res,next)=>{
//     try{
//         const { name, email, password, role  } = req.body;

//         const userId = req.user;

//         if(!name){
//             return res.status(400).json({ message:'Name is required!'})
//         } 
//         if(!email){
//             return res.status(400).json({ message:'Email is required!'})
//         }
//         if(!password){
//             return res.status(400).json({ message:'Password is required!'})
//         }
//         if(!role){
//             return res.status(400).json({ message:'role is required!'})
//         }

//         if (!["CompanyAdmin"].includes(role)) {
//             return res.status(400).json({ message: "Invalid role!" });
//         }

//         const existingUser = await USER.findOne({ email });
//         if (existingUser) {
//             return res.status(400).json({ message: "User with this email already exists!" });
//         }

//         const hashedPassword = await bcrypt.hash(password, 10);


//        const user =  await USER.create({
//             name,
//             email,
//             password: hashedPassword,
//             role,
//         });

//         return res.status(200).json({ message:'Account created succsffully',user})

//     }catch(err){
//         next(err)
//     }
// }



export const createCompanyhAdmin = async (req, res, next) => {
  try {
    const { pin, role } = req.body;

    if (!pin || typeof pin !== 'string' || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ message: 'A valid 4-digit PIN is required!' });
    }

    if (!role || role !== 'CompanyAdmin') {
      return res.status(400).json({ message: 'Role must be CompanyAdmin!' });
    }

    const user = await USER.create({
      pin,
      role,
    });

    return res.status(200).json({ message: 'Company Admin created successfully', user });
  } catch (err) {
    next(err);
  }
};



// export const LoginUser = async (req,res,next)=>{
//     try{

//         const {  email, password } = req.body;

//         if(!email){
//             return res.status(404).json({ message:'Email is required!'})
//         }
//         if(!password){
//             return res.status(404).json({ message:'Password is required!'})
//         }
        
//         const user = await USER.findOne({ email });
//         if(!user){
//             return res.status(400).json({ message:'User not found!'})
//         };

//         const isMatch = await bcrypt.compare(password, user.password);
//         if (!isMatch) {
//             return res.status(400).json({ message: "Invalid password!" });
//         }

//         const token = jwt.sign({id:user._id,role:user.role,email:user.email}
//             ,process.env.JWT_SECRET_KEY , {expiresIn:'30d' }
//         )

//         return res.status(200).json({ message:'Login successful',token,user})

//     }catch(err){
//         next(err)
//     }
// }

export const LoginUser = async (req, res, next) => {
  try {
    const { pin } = req.body;

    if (!pin || typeof pin !== 'string' || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ message: 'A valid 4-digit PIN is required!' });
    }

    const user = await USER.findOne({ pin });

    if (!user) {
      return res.status(400).json({ message: 'Invalid PIN!' });
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user,
    });
  } catch (err) {
    next(err);
  }
};




export const createUser = async(req,res,next)=>{
    try {

        const { restaurantId,name, email, password  } = req.body
   
    
        const userId = req.user;
        const user = await USER.findOne({ _id: userId  })
        if (!user) return res.status(400).json({ message: "User not found!" });
       

        if(!restaurantId) {
          return res.status(400).json({ message:'Branch Id not found!'})
        }
          if(!email) {
            return res.status(400).json({ message:'Email  not found!'})
          }
          if(!password) {
            return res.status(400).json({ message:'Password  not found!'})
          }
         

          const existingUser = await USER.findOne({ email });
          if (existingUser) {
            return res.status(400).json({ message: "Email already exists!" });
          }

           // Hash the password
              const hashedPassword = await bcrypt.hash(password, 10);

              const newUser = new USER({
                name: name,
                restaurantId,
                email,
                password : hashedPassword,
                role:'User',
                createdById : user._id,
                
              });
   

              await newUser.save();

            return  res.status(200).json({ message: "User created successfully", data: newUser });
        
    } catch (err) {
        next(err)
    }
}


export const getAllUsers = async(req,res,next)=>{
    try {

        const { restaurantId } = req.params;

        const userId = req.user;
        const user = await USER.findOne({ _id: userId })
        console.log(user,'uservan')
        if (!user) return res.status(400).json({ message: "User not found!" });

        let filter = {};
        if (user.role === "CompanyAdmin") {
            filter = { _id: restaurantId, companyAdmin: user._id };
        } else if (user.role === "User") {
            filter = { _id: restaurantId };
        } else {
            return res.status(403).json({ message: "Unauthorized!" });
        }

        const restaurantData = await RESTAURANT.findOne(filter);
        if (!restaurantData) {
            return res.status(404).json({ message: "No matching restaurant found!" });
        }

        const users = await USER.find({ restaurantId })

        // await redisClient.setEx(cacheKey, 3600, JSON.stringify(users));

        return res.status(200).json({ data: users })
        
    } catch (err) {
        next(err)
    }
}


export const updateUser = async(req,res,next)=>{
    try {
  
      const {
        userId,
        restaurantId,
        name,
        email,
        password,
      } = req.body;
  
      const userid = req.user;
      console.log(userid,'userid')
      const user = await USER.findOne({ _id: userId })
      if (!user) return res.status(400).json({ message: "User not found!" });
  
      const userData = await USER.findById(userId);
      if (!userData) return res.status(404).json({ message: "No User found!" });
  
      if (!restaurantId) {
        return res.status(400).json({ message: "Branch Id is required!" });
      }
  
  
      // Check for email uniqueness (excluding current user)
      const emailTaken = await USER.findOne({ email, _id: { $ne: userId } });
      if (emailTaken) return res.status(400).json({ message: "Email already in use!" });

  
      const updateData = {
        name: name,
        restaurantId,
        email,
        role:userData.role,
       
   
      };
  
      // If password is provided, hash and update
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }
  
      const updatedUser = await USER.findByIdAndUpdate(userId, updateData, { new: true });
  
      // Remove from Redis cache
      // await redisClient.del(`users:${restaurantId}`);
  
      return res.status(200).json({
        message: "User updated successfully",
        data: updatedUser
      });
  
    } catch (err) {
        next(err)
    }
  }
  
  
  export const deleteUser = async(req,res,next)=>{
    try {
  
      const { restaurantId ,userId } = req.body;
  
          const userid = req.user;
           //added
          const user = await USER.findOne({ _id: userid })
          if (!user) {
              return res.status(400).json({ message: "User not found!" });
          }
  
          if (!restaurantId) {
              return res.status(400).json({ message: "Restaurant ID is required!" });
          }
  
          if (!userId) {
              return res.status(400).json({ message: "userId not found!" });
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
  
          const userData = await USER.findById(userId);
          if (!userData) {
              return res.status(400).json({ message: "User data not found!" });
          }

          if(userData.role == 'CompanyAdmin'){
            return res.status(400).json({ message:'You cant delete the company admin'})
          }
  
  
          await USER.findByIdAndDelete(userId)
  
          return res.status(200).json({
            message: "User deleted successfully!",
        });
  
    } catch (err) {
      next(err)
    }
  }