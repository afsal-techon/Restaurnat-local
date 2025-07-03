import express from 'express'
import {VerifyToken } from '../middleware/jwt.js'
import { createCompanyhAdmin,LoginUser ,createUser,getAllUsers,updateUser,deleteUser} from '../controller/User/UserAuth.js';
import { createRestuarantBranch,getAllRestaurant,updateRestaurantBranch,deleteRestaurant,
    addCustomerType,updateCustomerTypes,deleteCustomerTypes ,getAllCustomerTypes
} from '../controller/Restaurant/restaurant.js';

import {createAccounts,getAccounts,updateAccount,deleteAccount,getTransactionList, generateTransactionListPDF, createTransactionModule, getPurchseExpenceList, generatePurchseExpencePDF } from '../controller/Restaurant/accounts.js'

import { createFloors,deleteFloor,getAllFloorsbyRest,updateFloorName ,createTables,getAllTablesbyRest,updateTable,deleteTable ,addKitchen,deleteKitchen,getAllKitchen,updateKitchen } from '../controller/Restaurant/floors&tables.js'
import {createCategory,deleteCategory,getAllCategories,updateCategory } from '../controller/foodController/categoryCnrl.js'
import {CreateMenuType,getAllMenuTypes,updateMenuTypes,deleteMenuTypes } from '../controller/foodController/menuTypeCntrls.js'
import { createAddOns,deleteAddOn,getAllAddOns,updateAddOns } from '../controller/foodController/AddOnsCntrl.js';
import { createFood,deleteFood,getAllFoodbyRestaurat,getOneFood,updateFood } from '../controller/foodController/mainFood.js'
import {getAllByCategoryForPOS,getAllComboForPOS,getAllFoodForPOS,getComboForPOS,getCourseForPOS,getMenusItemsForPOS,getOneComboForPOS } from '../controller/POS controller/menuCntrl.js';
import {  getFloorsForPOS,getTablesForPOS ,createCustomerForPOS,getCustomerCreditHistory,getCustomerTypesForPOS,getCustomersForPOS,updateCustomerforPOS, payCustomerDue, getCustomerOrderHistory,} from '../controller/POS controller/posBasicCntrl.js';
import {createOrder,getOneOrderDetails,getTodayOrdersForPOS,posOrderBilling,cancelOrder } from '../controller/POS controller/posOrderCntrl.js';
import { createCompo,getAllCombo,deleteCombo,getOneCombo,updateCombo} from '../controller/foodController/comboCntrl.js'
import { getQuickViewDashboard,getSalesOverview ,getPaymentOverview,getOrderSummary,getTopSellingItems,getLatestCompletedOrders} from '../controller/DashbordController/dashbordCntrl.js'

import upload from '../middleware/multer.js'
import { generateCategorySalesPDF, generateCustomerTypeWisePDF, generateDailySalesPDF, generateItemWiseSalesPDF, getCategoryWiseSalesReport, getCustomerTypeWiseSalesReport, getDailySalesReport, getItemWiseSalesReport } from '../controller/ReportsController/salesReportCntrl.js';
import { generateCancelledOrdersPDF, generateOrderSummaryPDF, getALLOrderSummary, getCancelledOrders, getSingleOrder } from '../controller/ReportsController/orederReport.js';
import { generateDailyCollectionPDF, generatePaymentSummaryPDF, getDailyCollectionReport, getDailyTransactionReport, getPaymentSummary } from '../controller/ReportsController/paymentReport.js';
import { generatePurchaseReportPDF, getExpenseReport, getPurchaseReport } from '../controller/purchse-Expense/purchse-expence.js';
const router = express.Router();



//create company admin 
router.post('/create-admin', createCompanyhAdmin);
router.post('/login',LoginUser);

//
router.post('/create-restaurant',VerifyToken,upload.single('logo'),createRestuarantBranch);
router.get('/get-restaurants',VerifyToken, getAllRestaurant);
router.put('/update-restaurant',VerifyToken,upload.single('logo'),updateRestaurantBranch);
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

//kitchen 
router.post('/kitchen',VerifyToken,addKitchen);
router.get('/kitchen/:restaurantId',VerifyToken,getAllKitchen);
router.put('/kitchen',VerifyToken,updateKitchen);
router.delete('/kitchen/:kitchenId',VerifyToken,deleteKitchen);


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
// router.post('/course',VerifyToken,createCourse);
// router.get('/course/:restaurantId',VerifyToken,getAllCourses);
// router.put('/course',VerifyToken, updateCourse);
// router.delete('/course',VerifyToken, deleteCourse);


//add-ons 
router.post('/add-ons',VerifyToken,createAddOns);
router.get('/add-ons/:restaurantId',VerifyToken,getAllAddOns )
router.put('/add-ons',VerifyToken,updateAddOns )
router.delete('/add-ons',VerifyToken,deleteAddOn);


//food
router.post('/food',VerifyToken,upload.single('foodImg'),createFood);
router.get('/food/:restaurantId',VerifyToken,getAllFoodbyRestaurat);
router.put('/food',VerifyToken,upload.single('foodImg'), updateFood)
router.get('/food-id/:foodId',VerifyToken, getOneFood);
router.delete('/food/:foodId',VerifyToken,deleteFood);


//compo section 
router.post('/combo',VerifyToken,upload.single('comboImg'),createCompo);
router.put('/combo',VerifyToken,upload.single('comboImg'),updateCombo);
router.get('/combo/:restaurantId',VerifyToken,getAllCombo);
router.get('/combo/:restaurantId/:comboId',VerifyToken,getOneCombo);
router.delete('/combo/:comboId',VerifyToken,deleteCombo );




//pos-category-food
router.get("/pos-foods/:restaurantId",VerifyToken,getAllFoodForPOS)
router.get('/pos-category/:restaurantId',VerifyToken,getAllByCategoryForPOS);
router.get('/pos-menuitems/:restaurantId',VerifyToken,getMenusItemsForPOS)
router.get('/pos-course/:restaurantId',VerifyToken,getCourseForPOS);
router.get('/pos-combo/:restaurantId',VerifyToken,getComboForPOS)

//pos-combo
// router.get('/pos-combo/:restaurantId',VerifyToken,getAllComboForPOS);
router.get('/pos-combo/:restaurantId/:comboId',VerifyToken,getOneComboForPOS)


//pos-tables and floors
router.get('/pos-floors/:restaurantId',VerifyToken,getFloorsForPOS);
router.get('/pos-tables/:restaurantId',VerifyToken,getTablesForPOS);


//pos-customer
router.post('/pos-customer',VerifyToken,createCustomerForPOS);
router.get('/pos-customer/:restaurantId',VerifyToken,getCustomersForPOS);
router.put('/pos-customer',VerifyToken,updateCustomerforPOS);
router.get('/pos-customerTypes/:restaurantId',VerifyToken,getCustomerTypesForPOS)
router.get('/pos-customer/history/:customerId',VerifyToken,getCustomerCreditHistory)
router.post('/pos-customer/due',VerifyToken,payCustomerDue);
router.get('/customer/history',VerifyToken,getCustomerOrderHistory)



//pos-order-listing
router.get('/pos/order/list/:restaurantId',VerifyToken,getTodayOrdersForPOS);
router.get('/pos/order/:orderId',VerifyToken,getOneOrderDetails)


//pos-order
router.post('/pos/order',VerifyToken,createOrder);
// router.post('/pos/cancel-order',VerifyToken,cancelOrder)

//pos-order
router.post('/pos/cancel-order',VerifyToken,cancelOrder)

//pos-billing
router.post('/pos/order/billing',VerifyToken,posOrderBilling);


//accounts
router.post('/accounts',VerifyToken,createAccounts);
router.get('/accounts/:restaurantId',VerifyToken,getAccounts);
router.put('/accounts',VerifyToken,updateAccount);
router.delete('/accounts/:accountId',VerifyToken,deleteAccount);
router.get('/accounts/transaction/data',VerifyToken,getTransactionList);
router.get('/transaction/pdf',VerifyToken,generateTransactionListPDF);
router.post('/transaction/exp-pur',VerifyToken,createTransactionModule);
router.get('/transaction/exp-pur',VerifyToken,getPurchseExpenceList);
router.get('/exp-pur/pdf',VerifyToken,generatePurchseExpencePDF)




//dashboard apis 
router.get('/dashboard/quick-view/:fromDate/:toDate',VerifyToken,getQuickViewDashboard );
router.get('/dashboard/sales-overview/:fromDate/:toDate',VerifyToken,getSalesOverview );
router.get('/dashboard/payment-overview/:fromDate/:toDate',VerifyToken,getPaymentOverview );
router.get('/dashboard/order-summary',VerifyToken,getOrderSummary );
router.get('/dashboard/top-selling',VerifyToken,getTopSellingItems );
router.get('/dashboard/latest-orders',VerifyToken,getLatestCompletedOrders );

//Report          

//sales
router.get('/reports/daily-sale',VerifyToken,getDailySalesReport);
router.get('/reports/category-sale',VerifyToken,getCategoryWiseSalesReport);
router.get('/reports/item-sale',VerifyToken,getItemWiseSalesReport);
router.get('/reports/customerType-sale',VerifyToken,getCustomerTypeWiseSalesReport);
router.get('/daily-sale/pdf',VerifyToken,generateDailySalesPDF);
router.get('/category-sale/pdf',VerifyToken,generateCategorySalesPDF);
router.get('/item-sale/pdf',VerifyToken,generateItemWiseSalesPDF);
router.get('/customertype-sale/pdf',VerifyToken,generateCustomerTypeWisePDF)



//order report 
router.get('/reports/order-summary',VerifyToken,getALLOrderSummary);
router.get('/reports/one-order/:orderId',VerifyToken,getSingleOrder);
router.get('/reports/cancelled-order',VerifyToken,getCancelledOrders)
router.get('/order-summary/pdf',VerifyToken,generateOrderSummaryPDF)
router.get('/cancel-order/pdf',VerifyToken,generateCancelledOrdersPDF)

//Payment  Report 
router.get('/reports/payment-summary',VerifyToken,getPaymentSummary);
router.get('/reports/daily-payment',VerifyToken,getDailyCollectionReport);
router.get('/payment-summary/pdf',VerifyToken,generatePaymentSummaryPDF);
router.get('/payment-collection/pdf',VerifyToken,generateDailyCollectionPDF)

//daily transaction type 
router.get('/reports/daily-transaction',VerifyToken,getDailyTransactionReport)


//purchse Expence Report
router.get('/reports/purchase',VerifyToken,getPurchaseReport);
router.get('/reports/expanse',VerifyToken,getExpenseReport);
router.get('/purchase/pdf',VerifyToken,generatePurchaseReportPDF)

























export default router;