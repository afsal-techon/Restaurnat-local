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
import checkOfflinePermission from '../middleware/permission.js'
const router = express.Router();



//create company admin 
router.post('/create-admin', createCompanyhAdmin);
router.post('/login',LoginUser);

//
router.post('/create-restaurant',VerifyToken,checkOfflinePermission('Admin'),upload.single('logo'),createRestuarantBranch);
router.get('/get-restaurants',VerifyToken,checkOfflinePermission('Admin'), getAllRestaurant);
router.put('/update-restaurant',VerifyToken,checkOfflinePermission('Admin'),upload.single('logo'),updateRestaurantBranch);
router.delete('/delete-restaurant/:restaurantId',VerifyToken,checkOfflinePermission('Admin'), deleteRestaurant);


//customer types
router.post('/customer-type',VerifyToken,checkOfflinePermission('Admin'),addCustomerType);
router.put('/customer-type',VerifyToken,checkOfflinePermission('Admin'),updateCustomerTypes);
router.delete('/customer-type',VerifyToken,checkOfflinePermission('Admin'),deleteCustomerTypes);
router.get('/customer-type/:restaurantId',VerifyToken,checkOfflinePermission('Admin'), getAllCustomerTypes)


//floors
router.post('/floors',VerifyToken,checkOfflinePermission('Admin'),createFloors);
router.get('/floors/:restaurantId',VerifyToken,checkOfflinePermission('Admin'),getAllFloorsbyRest);
router.put('/floors',VerifyToken,checkOfflinePermission('Admin'),updateFloorName);
router.delete('/floors/:floorId',VerifyToken,checkOfflinePermission('Admin'),deleteFloor)


//tables
router.post('/tables',VerifyToken,checkOfflinePermission('Admin'),createTables);
router.get('/tables/:restaurantId',VerifyToken,checkOfflinePermission('Admin'),getAllTablesbyRest);
router.put('/tables',VerifyToken,checkOfflinePermission('Admin'),updateTable);
router.delete('/tables/:tableId',VerifyToken,checkOfflinePermission('Admin'),deleteTable);

//kitchen 
router.post('/kitchen',VerifyToken,checkOfflinePermission('Admin'),addKitchen);
router.get('/kitchen/:restaurantId',VerifyToken,checkOfflinePermission('Admin'),getAllKitchen);
router.put('/kitchen',VerifyToken,checkOfflinePermission('Admin'),updateKitchen);
router.delete('/kitchen/:kitchenId',VerifyToken,checkOfflinePermission('Admin'),deleteKitchen);


//user creation
router.post('/user',VerifyToken,checkOfflinePermission('Admin'),createUser);
router.get('/user/:restaurantId',VerifyToken,checkOfflinePermission('Admin'),getAllUsers);
router.put('/user-update',VerifyToken, checkOfflinePermission('Admin'),updateUser);
router.delete('/user',VerifyToken,checkOfflinePermission('Admin'), deleteUser);


//category
router.post('/category',VerifyToken,checkOfflinePermission('MenuManagement'),createCategory);
router.get('/category/:restaurantId',checkOfflinePermission('MenuManagement'),VerifyToken,getAllCategories)
router.put('/category',VerifyToken,checkOfflinePermission('MenuManagement'),updateCategory );
router.delete('/category/:categoryId',checkOfflinePermission('MenuManagement'),VerifyToken,deleteCategory);


//menu type 
router.post('/menu-type',VerifyToken,checkOfflinePermission('MenuManagement'),CreateMenuType)
router.get('/menu-type/:restaurantId',VerifyToken,checkOfflinePermission('MenuManagement'),getAllMenuTypes)
router.put('/menu-type',VerifyToken,checkOfflinePermission('MenuManagement'),updateMenuTypes)
router.delete('/menu-type',VerifyToken,checkOfflinePermission('MenuManagement'),deleteMenuTypes);


//course sections
// router.post('/course',VerifyToken,createCourse);
// router.get('/course/:restaurantId',VerifyToken,getAllCourses);
// router.put('/course',VerifyToken, updateCourse);
// router.delete('/course',VerifyToken, deleteCourse);


//add-ons 
router.post('/add-ons',VerifyToken,checkOfflinePermission('MenuManagement'),createAddOns);
router.get('/add-ons/:restaurantId',VerifyToken,checkOfflinePermission('MenuManagement'),getAllAddOns )
router.put('/add-ons',VerifyToken,checkOfflinePermission('MenuManagement'),updateAddOns )
router.delete('/add-ons',VerifyToken,checkOfflinePermission('MenuManagement'),deleteAddOn);


//food
router.post('/food',VerifyToken,checkOfflinePermission('MenuManagement'),upload.single('foodImg'),createFood);
router.get('/food/:restaurantId',VerifyToken,checkOfflinePermission('MenuManagement'),getAllFoodbyRestaurat);
router.put('/food',VerifyToken,checkOfflinePermission('MenuManagement'),upload.single('foodImg'), updateFood)
router.get('/food-id/:foodId',VerifyToken,checkOfflinePermission('MenuManagement'), getOneFood);
router.delete('/food/:foodId',VerifyToken,checkOfflinePermission('MenuManagement'),deleteFood);


//compo section 
router.post('/combo',VerifyToken,checkOfflinePermission('MenuManagement'),upload.single('comboImg'),createCompo);
router.put('/combo',VerifyToken,checkOfflinePermission('MenuManagement'),upload.single('comboImg'),updateCombo);
router.get('/combo/:restaurantId',VerifyToken,checkOfflinePermission('MenuManagement'),getAllCombo);
router.get('/combo/:restaurantId/:comboId',VerifyToken,checkOfflinePermission('MenuManagement'),getOneCombo);
router.delete('/combo/:comboId',VerifyToken,checkOfflinePermission('MenuManagement'),deleteCombo );




//pos-category-food
router.get("/pos-foods/:restaurantId",VerifyToken,checkOfflinePermission('Sales'),getAllFoodForPOS)
router.get('/pos-category/:restaurantId',VerifyToken,checkOfflinePermission('Sales'),getAllByCategoryForPOS);
router.get('/pos-menuitems/:restaurantId',VerifyToken,checkOfflinePermission('Sales'),getMenusItemsForPOS)
router.get('/pos-course/:restaurantId',VerifyToken,checkOfflinePermission('Sales'),getCourseForPOS);
router.get('/pos-combo/:restaurantId',VerifyToken,checkOfflinePermission('Sales'),getComboForPOS)

//pos-combo
// router.get('/pos-combo/:restaurantId',VerifyToken,getAllComboForPOS);
router.get('/pos-combo/:restaurantId/:comboId',VerifyToken,checkOfflinePermission('Sales'),getOneComboForPOS)


//pos-tables and floors
router.get('/pos-floors/:restaurantId',VerifyToken,checkOfflinePermission('Sales'),getFloorsForPOS);
router.get('/pos-tables/:restaurantId',VerifyToken,checkOfflinePermission('Sales'),getTablesForPOS);


//pos-customer
router.post('/pos-customer',VerifyToken,checkOfflinePermission('Sales'),createCustomerForPOS);
router.get('/pos-customer/:restaurantId',VerifyToken,checkOfflinePermission('Sales'),getCustomersForPOS);
router.put('/pos-customer',VerifyToken,checkOfflinePermission('Sales'),updateCustomerforPOS);
router.get('/pos-customerTypes/:restaurantId',VerifyToken,checkOfflinePermission('Sales'),getCustomerTypesForPOS)
router.get('/pos-customer/history/:customerId',VerifyToken,checkOfflinePermission('Sales'),getCustomerCreditHistory)
router.post('/pos-customer/due',VerifyToken,checkOfflinePermission('Admin'),payCustomerDue);
router.get('/customer/history',VerifyToken,checkOfflinePermission('Admin'),getCustomerOrderHistory)



//pos-order-listing
router.get('/pos/order/list/:restaurantId',VerifyToken,checkOfflinePermission('Sales'),getTodayOrdersForPOS);
router.get('/pos/order/:orderId',VerifyToken,checkOfflinePermission('Sales'),getOneOrderDetails)


//pos-order
router.post('/pos/order',VerifyToken,checkOfflinePermission('Sales'),createOrder);
// router.post('/pos/cancel-order',VerifyToken,cancelOrder)

//pos-order
router.post('/pos/cancel-order',VerifyToken,checkOfflinePermission('Sales'),cancelOrder)

//pos-billing
router.post('/pos/order/billing',VerifyToken,checkOfflinePermission('Sales'),posOrderBilling);


//accounts
router.post('/accounts',VerifyToken,checkOfflinePermission('Admin'),createAccounts);
router.get('/accounts/:restaurantId',VerifyToken,checkOfflinePermission('Admin'),getAccounts);
router.put('/accounts',VerifyToken,checkOfflinePermission('Admin'),updateAccount);
router.delete('/accounts/:accountId',VerifyToken,checkOfflinePermission('Admin'),deleteAccount);
router.get('/accounts/transaction/data',VerifyToken,checkOfflinePermission('Admin'),getTransactionList);
router.get('/transaction/pdf',VerifyToken,checkOfflinePermission('Admin'),generateTransactionListPDF);
router.post('/transaction/exp-pur',VerifyToken,checkOfflinePermission('Purchase'),createTransactionModule);
router.get('/transaction/exp-pur',VerifyToken,checkOfflinePermission('Admin'),getPurchseExpenceList);
router.get('/exp-pur/pdf',VerifyToken,checkOfflinePermission('Admin'),generatePurchseExpencePDF)




//dashboard apis 
router.get('/dashboard/quick-view/:fromDate/:toDate',VerifyToken,checkOfflinePermission('Admin'),getQuickViewDashboard );
router.get('/dashboard/sales-overview/:fromDate/:toDate',VerifyToken,checkOfflinePermission('Admin'),getSalesOverview );
router.get('/dashboard/payment-overview/:fromDate/:toDate',VerifyToken,checkOfflinePermission('Admin'),getPaymentOverview );
router.get('/dashboard/order-summary',VerifyToken,checkOfflinePermission('Admin'),getOrderSummary );
router.get('/dashboard/top-selling',VerifyToken,checkOfflinePermission('Admin'),getTopSellingItems );
router.get('/dashboard/latest-orders',VerifyToken,checkOfflinePermission('Admin'),getLatestCompletedOrders );

//Report          

//sales
router.get('/reports/daily-sale',VerifyToken,checkOfflinePermission('Reports'),getDailySalesReport);
router.get('/reports/category-sale',VerifyToken,checkOfflinePermission('Reports'),getCategoryWiseSalesReport);
router.get('/reports/item-sale',VerifyToken,checkOfflinePermission('Reports'),getItemWiseSalesReport);
router.get('/reports/customerType-sale',VerifyToken,checkOfflinePermission('Reports'),getCustomerTypeWiseSalesReport);
router.get('/daily-sale/pdf',VerifyToken,checkOfflinePermission('Reports'),generateDailySalesPDF);
router.get('/category-sale/pdf',VerifyToken,checkOfflinePermission('Reports'),generateCategorySalesPDF);
router.get('/item-sale/pdf',VerifyToken,checkOfflinePermission('Reports'),generateItemWiseSalesPDF);
router.get('/customertype-sale/pdf',VerifyToken,checkOfflinePermission('Reports'),generateCustomerTypeWisePDF)



//order report 
router.get('/reports/order-summary',VerifyToken,checkOfflinePermission('Reports'),getALLOrderSummary);
router.get('/reports/one-order/:orderId',VerifyToken,checkOfflinePermission('Reports'),getSingleOrder);
router.get('/reports/cancelled-order',VerifyToken,checkOfflinePermission('Reports'),getCancelledOrders)
router.get('/order-summary/pdf',VerifyToken,checkOfflinePermission('Reports'),generateOrderSummaryPDF)
router.get('/cancel-order/pdf',VerifyToken,checkOfflinePermission('Reports'),generateCancelledOrdersPDF)

//Payment  Report 
router.get('/reports/payment-summary',VerifyToken,checkOfflinePermission('Reports'),getPaymentSummary);
router.get('/reports/daily-payment',VerifyToken,checkOfflinePermission('Reports'),getDailyCollectionReport);
router.get('/payment-summary/pdf',VerifyToken,checkOfflinePermission('Reports'),generatePaymentSummaryPDF);
router.get('/payment-collection/pdf',VerifyToken,checkOfflinePermission('Reports'),generateDailyCollectionPDF)

//daily transaction type 
router.get('/reports/daily-transaction',VerifyToken,checkOfflinePermission('Reports'),getDailyTransactionReport)


//purchse Expence Report
router.get('/reports/purchase',VerifyToken,checkOfflinePermission('Reports'),getPurchaseReport);
router.get('/reports/expanse',VerifyToken,checkOfflinePermission('Reports'),getExpenseReport);
router.get('/purchase/pdf',VerifyToken,checkOfflinePermission('Reports'),generatePurchaseReportPDF)





export default router;