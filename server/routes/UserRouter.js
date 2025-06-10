import express from 'express'
import {VerifyToken } from '../middleware/jwt.js'
import { createCompanyhAdmin,LoginUser ,createUser,getAllUsers,updateUser,deleteUser} from '../controller/User/UserAuth.js';
import { createRestuarantBranch,getAllRestaurant,updateRestaurantBranch,deleteRestaurant,
    addCustomerType,updateCustomerTypes,deleteCustomerTypes ,getAllCustomerTypes
} from '../controller/Restaurant/restaurant.js';

import { createFloors,deleteFloor,getAllFloorsbyRest,updateFloorName ,createTables,getAllTablesbyRest,updateTable,deleteTable } from '../controller/Restaurant/floors&tables.js'
import {createCategory,deleteCategory,getAllCategories,updateCategory } from '../controller/foodController/categoryCnrl.js'
import {CreateMenuType,getAllMenuTypes,updateMenuTypes,deleteMenuTypes,createCourse,getAllCourses,updateCourse,deleteCourse } from '../controller/foodController/menuTypeCntrls.js'
import { createAddOns,deleteAddOn,getAllAddOns,updateAddOns } from '../controller/foodController/AddOnsCntrl.js'
const router = express.Router();



//create company admin 
router.post('/create-admin',VerifyToken,createCompanyhAdmin);
router.post('/login',LoginUser);

//
router.post('/create-restaurant',VerifyToken,createRestuarantBranch);
router.get('/get-restaurants',VerifyToken, getAllRestaurant);
router.put('/update-restaurant',VerifyToken,updateRestaurantBranch);
router.delete('/delete-restaurant/:restaurantId',VerifyToken, deleteRestaurant);


//customer types
router.post('/customer-type',VerifyToken,addCustomerType);
router.put('/customer-type',VerifyToken,updateCustomerTypes);
router.delete('/customer-type',VerifyToken,deleteCustomerTypes);
router.get('/customer-type/:restaurantId',VerifyToken , getAllCustomerTypes)


//floors
router.post('/floors',VerifyToken,createFloors);
router.get('/floors/:restaurantId',VerifyToken,getAllFloorsbyRest);
router.put('/floors',VerifyToken,updateFloorName);
router.delete('/floors/:floorId',VerifyToken,deleteFloor)


//tables
router.post('/tables',VerifyToken,createTables);
router.get('/tables/:restaurantId',VerifyToken,getAllTablesbyRest);
router.put('/tables',VerifyToken,updateTable);
router.delete('/tables/:tableId',VerifyToken,deleteTable);

//user creation
router.post('/user',VerifyToken,createUser);
router.get('/user/:restaurantId',VerifyToken,getAllUsers);
router.put('/user-update',VerifyToken, updateUser);
router.delete('/user',VerifyToken, deleteUser);

//category
router.post('/category',VerifyToken,createCategory);
router.get('/category/:restaurantId' ,VerifyToken,getAllCategories)
router.put('/category',VerifyToken,updateCategory );
router.delete('/category/:categoryId',VerifyToken,deleteCategory);


//menu type 
router.post('/menu-type',VerifyToken,CreateMenuType)
router.get('/menu-type/:restaurantId',VerifyToken,getAllMenuTypes)
router.put('/menu-type',VerifyToken,updateMenuTypes)
router.delete('/menu-type',VerifyToken,deleteMenuTypes);


//course sections
router.post('/course',VerifyToken,createCourse);
router.get('/course/:restaurantId',VerifyToken,getAllCourses);
router.put('/course',VerifyToken, updateCourse);
router.delete('/course',VerifyToken, deleteCourse);


//add-ons 
router.post('/add-ons',VerifyToken,createAddOns);
router.get('/add-ons/:restaurantId',VerifyToken,getAllAddOns )
router.put('/add-ons',VerifyToken,updateAddOns )
router.delete('/add-ons',VerifyToken,deleteAddOn);















export default router;