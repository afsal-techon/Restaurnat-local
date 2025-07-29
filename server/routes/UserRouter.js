import express from 'express'
import {VerifyToken } from '../middleware/jwt.js'
import { createCompanyhAdmin,LoginUser ,createUser,getAllUsers,updateUser,deleteUser, getAllUsersForLoginPin} from '../controller/User/UserAuth.js';
import { createRestuarantBranch,getAllRestaurant,updateRestaurantBranch,deleteRestaurant,
    addCustomerType,updateCustomerTypes,deleteCustomerTypes ,getAllCustomerTypes
} from '../controller/Restaurant/restaurant.js';

import {createAccounts,getAccounts,updateAccount,deleteAccount,getTransactionList, generateTransactionListPDF, createTransactionModule, getPurchseExpenceList, generatePurchseExpencePDF, TransactionListExcel } from '../controller/Restaurant/accounts.js'

import { createFloors,deleteFloor,getAllFloorsbyRest,updateFloorName ,createTables,getAllTablesbyRest,updateTable,deleteTable ,addKitchen,deleteKitchen,getAllKitchen,updateKitchen } from '../controller/Restaurant/floors&tables.js'
import {createCategory,deleteCategory,getAllCategories,updateCategory } from '../controller/foodController/categoryCnrl.js'
import {CreateMenuType,getAllMenuTypes,updateMenuTypes,deleteMenuTypes } from '../controller/foodController/menuTypeCntrls.js'
import { createAddOns,deleteAddOn,getAllAddOns,updateAddOns } from '../controller/foodController/AddOnsCntrl.js';
import { createFood,deleteFood,getAllFoodbyRestaurat,getOneFood,updateFood } from '../controller/foodController/mainFood.js'
import {getAllByCategoryForPOS,getAllComboForPOS,getAllFoodForPOS,getComboForPOS,getCourseForPOS,getMenusItemsForPOS,getOneComboForPOS } from '../controller/POS controller/menuCntrl.js';
import {  getFloorsForPOS,getTablesForPOS ,createCustomerForPOS,getCustomerTypesForPOS,getCustomersForPOS,updateCustomerforPOS, payCustomerDue, getCustomerOrderHistory, getCustomerDueHistory, generateCustomerDueHistoryPDF,} from '../controller/POS controller/posBasicCntrl.js';
import {createOrder,getOneOrderDetails,getTodayOrdersForPOS,posOrderBilling,cancelOrder, changeTable, printDinInCustomerReceipt, rePrintForTakeHome, rePrintDinIn } from '../controller/POS controller/posOrderCntrl.js';
import { createCompo,getAllCombo,deleteCombo,getOneCombo,updateCombo} from '../controller/foodController/comboCntrl.js'
import { getQuickViewDashboard,getSalesOverview ,getPaymentOverview,getOrderSummary,getTopSellingItems,getLatestCompletedOrders} from '../controller/DashbordController/dashbordCntrl.js'

import upload from '../middleware/multer.js'
import { categorySalesExcel, customerTypeWiseSalesExcel, DailySalesExcel, generateCategorySalesPDF, generateCustomerTypeWisePDF, generateDailySalesPDF, generateItemWiseSalesPDF, getCategoryWiseSalesReport, getCustomerTypeWiseSalesReport, getDailySalesReport, getItemWiseSalesReport, itemWiseSalesExcel } from '../controller/ReportsController/salesReportCntrl.js';
import { generateCancelledOrdersPDF, generateOrderSummaryPDF, getALLOrderSummary, getCancelledOrders, getCancelledOrdersExcel, getSingleOrder, orderSummaryExcel } from '../controller/ReportsController/orederReport.js';
import { dailyCollectionExcel, dailyTransactionExcel, generateDailyCollectionPDF, generatePaymentSummaryPDF, getDailyCollectionReport, getDailyTransactionPDF, getDailyTransactionReport, getPaymentSummary, paymentSummaryExcel } from '../controller/ReportsController/paymentReport.js';
import { expenseReportExcel, generateExpenseReportPDF, generatePurchaseReportPDF, getExpenseReport, getPurchaseReport, purchaseReportExcel } from '../controller/purchse-Expense/purchse-expence.js';
import checkOfflinePermission from '../middleware/permission.js'
import { getPosSettings, getPritnerConfigs, updatePosSettings, updatePrinterConfig, upsertPrinterConfig } from '../controller/Settings/printer-settings.js';
import { createSupplier, deleteSupplier, getSupplierDueHistory, getSuppliers, paySupplierDue, SupplierDueHistoryPdf, updateSupplier } from '../controller/supplierCntrl/supplierCntrl.js';
import { createIngredient, deleteIngredient, getAllIngredients, updateIngredient } from '../controller/purchse-Expense/ingredients.js';
import { createPurchase, getAllPurchasesReport, getOnePurchase, getPurchaseList, updatePurchase } from '../controller/purchse-Expense/purchase.js';
import { createExpense, getAllExpensesReport, getExpenseList, getOneExpense, updateExpense } from '../controller/purchse-Expense/Expense.js';
import {  getKOTTickets } from '../controller/kithchenPanel/kitchenCntrl.js';
import { assignRiderForOut, completeHomeDelivery, createRider, deleteRider, getDeliveredHomeDelivery, getOutForHomeDelivery, getPlacedHomeDelivery, getRiders, getWaitingForHomeDelivery, markOrderReadyForPickup, updateRider } from '../controller/Delivery/homeDeliveryCntrl.js';
import { getProfitAndLossReport, profitAndLossExcel, profitandLossPdf } from '../controller/ReportsController/otherReports.js';
import { getBillSettings, updateBillSettings } from '../controller/Settings/Bill-settings.js';
const router = express.Router();



//create company admin 
router.post('/create-admin', createCompanyhAdmin);
router.post('/login',LoginUser);

//
router.post('/create-restaurant',VerifyToken,checkOfflinePermission('Admin'),upload.single('logo'),createRestuarantBranch);
router.get('/get-restaurants',VerifyToken, getAllRestaurant);
router.put('/update-restaurant',VerifyToken,checkOfflinePermission('Admin'),upload.single('logo'),updateRestaurantBranch);
router.delete('/delete-restaurant/:restaurantId',VerifyToken,checkOfflinePermission('Admin'), deleteRestaurant);


//customer types
router.post('/customer-type',VerifyToken,checkOfflinePermission('Admin'),addCustomerType);
router.put('/customer-type',VerifyToken,checkOfflinePermission('Admin'),updateCustomerTypes);
router.delete('/customer-type',VerifyToken,checkOfflinePermission('Admin'),deleteCustomerTypes);
router.get('/customer-type/:restaurantId',VerifyToken, getAllCustomerTypes)


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
router.get('/kitchen/:restaurantId',VerifyToken,getAllKitchen);
router.put('/kitchen',VerifyToken,checkOfflinePermission('Admin'),updateKitchen);
router.delete('/kitchen/:kitchenId',VerifyToken,checkOfflinePermission('Admin'),deleteKitchen);


//user creation
router.post('/user',VerifyToken,checkOfflinePermission('Admin'),createUser);
router.get('/user/:restaurantId',VerifyToken,checkOfflinePermission('Admin'),getAllUsers);
router.get('/user',getAllUsersForLoginPin);
router.put('/user-update',VerifyToken, checkOfflinePermission('Admin'),updateUser);
router.delete('/user',VerifyToken,checkOfflinePermission('Admin'), deleteUser);


//category
router.post('/category',VerifyToken,checkOfflinePermission('Menu Setup'),createCategory);
router.get('/category/:restaurantId',VerifyToken,checkOfflinePermission('Menu Setup'),getAllCategories)
router.put('/category',VerifyToken,checkOfflinePermission('Menu Setup'),updateCategory );
router.delete('/category/:categoryId',checkOfflinePermission('Menu Setup'),VerifyToken,deleteCategory);


//menu type 
router.post('/menu-type',VerifyToken,checkOfflinePermission('Menu Setup'),CreateMenuType)
router.get('/menu-type/:restaurantId',VerifyToken,checkOfflinePermission('Menu Setup'),getAllMenuTypes)
router.put('/menu-type',VerifyToken,checkOfflinePermission('Menu Setup'),updateMenuTypes)
router.delete('/menu-type',VerifyToken,checkOfflinePermission('Menu Setup'),deleteMenuTypes);


//course sections
// router.post('/course',VerifyToken,createCourse);
// router.get('/course/:restaurantId',VerifyToken,getAllCourses);
// router.put('/course',VerifyToken, updateCourse);
// router.delete('/course',VerifyToken, deleteCourse);


//add-ons 
router.post('/add-ons',VerifyToken,checkOfflinePermission('Menu Setup'),createAddOns);
router.get('/add-ons/:restaurantId',VerifyToken,checkOfflinePermission('Menu Setup'),getAllAddOns )
router.put('/add-ons',VerifyToken,checkOfflinePermission('Menu Setup'),updateAddOns )
router.delete('/add-ons',VerifyToken,checkOfflinePermission('Menu Setup'),deleteAddOn);


//food
router.post('/food',VerifyToken,checkOfflinePermission('Menu Setup'),upload.single('foodImg'),createFood);
router.get('/food/:restaurantId',VerifyToken,checkOfflinePermission('Menu Setup'),getAllFoodbyRestaurat);
router.put('/food',VerifyToken,checkOfflinePermission('Menu Setup'),upload.single('foodImg'), updateFood)
router.get('/food-id/:foodId',VerifyToken,checkOfflinePermission('Menu Setup'), getOneFood);
router.delete('/food/:foodId',VerifyToken,checkOfflinePermission('Menu Setup'),deleteFood);


//compo section 
router.post('/combo',VerifyToken,checkOfflinePermission('Menu Setup'),upload.single('comboImg'),createCompo);
router.put('/combo',VerifyToken,checkOfflinePermission('Menu Setup'),upload.single('comboImg'),updateCombo);
router.get('/combo/:restaurantId',VerifyToken,checkOfflinePermission('Menu Setup'),getAllCombo);
router.get('/combo/:restaurantId/:comboId',VerifyToken,checkOfflinePermission('Menu Setup'),getOneCombo);
router.delete('/combo/:comboId',VerifyToken,checkOfflinePermission('Menu Setup'),deleteCombo );




//pos-category-food
router.get("/pos-foods/:restaurantId",VerifyToken,checkOfflinePermission('Sale'),getAllFoodForPOS)
router.get('/pos-category/:restaurantId',VerifyToken,checkOfflinePermission('Sale'),getAllByCategoryForPOS);
router.get('/pos-menuitems/:restaurantId',VerifyToken,checkOfflinePermission('Sale'),getMenusItemsForPOS)
router.get('/pos-course/:restaurantId',VerifyToken,checkOfflinePermission('Sale'),getCourseForPOS);
router.get('/pos-combo/:restaurantId',VerifyToken,checkOfflinePermission('Sale'),getComboForPOS)

//pos-combo
// router.get('/pos-combo/:restaurantId',VerifyToken,getAllComboForPOS);
router.get('/pos-combo/:restaurantId/:comboId',VerifyToken,checkOfflinePermission('Sale'),getOneComboForPOS)


//pos-tables and floors
router.get('/pos-floors/:restaurantId',VerifyToken,checkOfflinePermission('Sale'),getFloorsForPOS);
router.get('/pos-tables/:restaurantId',VerifyToken,checkOfflinePermission('Sale'),getTablesForPOS);


//pos-customer
router.post('/pos-customer',VerifyToken,checkOfflinePermission('Sale'),createCustomerForPOS);
router.get('/pos-customer/:restaurantId',VerifyToken,checkOfflinePermission('Sale'),getCustomersForPOS);
router.put('/pos-customer',VerifyToken,checkOfflinePermission('Sale'),updateCustomerforPOS);
router.get('/pos-customerTypes/:restaurantId',VerifyToken,checkOfflinePermission('Sale'),getCustomerTypesForPOS)
router.post('/pos-customer/due',VerifyToken,checkOfflinePermission('Admin'),payCustomerDue);
router.get('/customer/history',VerifyToken,checkOfflinePermission('Admin'),getCustomerOrderHistory);
router.get('/customer/credit',VerifyToken,checkOfflinePermission('Admin'),getCustomerDueHistory)
router.get('/credit/pdf',VerifyToken,checkOfflinePermission('Admin'),generateCustomerDueHistoryPDF )




//pos-order-listing
router.get('/pos/order/list/:restaurantId',VerifyToken,checkOfflinePermission('Sale'),getTodayOrdersForPOS);
router.get('/pos/order/:orderId',VerifyToken,checkOfflinePermission('Sale'),getOneOrderDetails)


//pos-order
router.post('/pos/order',VerifyToken,checkOfflinePermission('Sale'),createOrder);
// router.post('/pos/cancel-order',VerifyToken,cancelOrder)

//pos-order
router.post('/pos/cancel-order',VerifyToken,checkOfflinePermission('Sale'),cancelOrder)

//pos-billing
router.post('/pos/order/billing',VerifyToken,checkOfflinePermission('Sale'),posOrderBilling);


//accounts
router.post('/accounts',VerifyToken,checkOfflinePermission('Admin'),createAccounts);
router.get('/accounts/:restaurantId',VerifyToken,getAccounts);
router.put('/accounts',VerifyToken,checkOfflinePermission('Admin'),updateAccount);
router.delete('/accounts/:accountId',VerifyToken,checkOfflinePermission('Admin'),deleteAccount);
router.get('/accounts/transaction/data',VerifyToken,checkOfflinePermission('Admin'),getTransactionList);
//excel
router.get('/accounts/history/excel',VerifyToken,checkOfflinePermission('Admin'),TransactionListExcel);
router.get('/transaction/pdf',VerifyToken,checkOfflinePermission('Admin'),generateTransactionListPDF);
router.post('/transaction/exp-pur',VerifyToken,checkOfflinePermission('Purchase'),createTransactionModule);
router.get('/transaction/exp-pur',VerifyToken,checkOfflinePermission('Purchase'),getPurchseExpenceList);
router.get('/exp-pur/pdf',VerifyToken,checkOfflinePermission('Purchase'),generatePurchseExpencePDF)


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
//excel
router.get('/category-sales/excel',VerifyToken,checkOfflinePermission('Reports'),categorySalesExcel)
router.get('/Daily-sales/excel',VerifyToken,checkOfflinePermission('Reports'),DailySalesExcel)
router.get('/item-sales/excel',VerifyToken,checkOfflinePermission('Reports'),itemWiseSalesExcel)
router.get('/customertypes/excel',VerifyToken,checkOfflinePermission('Reports'),customerTypeWiseSalesExcel)


//order report 
router.get('/reports/order-summary',VerifyToken,checkOfflinePermission('Reports'),getALLOrderSummary);
router.get('/reports/one-order/:orderId',VerifyToken,checkOfflinePermission('Reports'),getSingleOrder);
router.get('/reports/cancelled-order',VerifyToken,checkOfflinePermission('Reports'),getCancelledOrders)
router.get('/order-summary/pdf',VerifyToken,checkOfflinePermission('Reports'),generateOrderSummaryPDF)
router.get('/cancel-order/pdf',VerifyToken,checkOfflinePermission('Reports'),generateCancelledOrdersPDF)
//excel
router.get('/order-summary/excel',VerifyToken,checkOfflinePermission('Reports'),orderSummaryExcel)
router.get('/cancel-order/excel',VerifyToken,checkOfflinePermission('Reports'),getCancelledOrdersExcel)


//Payment  Report 
router.get('/reports/payment-summary',VerifyToken,checkOfflinePermission('Reports'),getPaymentSummary);
router.get('/reports/daily-payment',VerifyToken,checkOfflinePermission('Reports'),getDailyCollectionReport);
router.get('/payment-summary/pdf',VerifyToken,checkOfflinePermission('Reports'),generatePaymentSummaryPDF);
router.get('/payment-collection/pdf',VerifyToken,checkOfflinePermission('Reports'),generateDailyCollectionPDF)
//excel 
router.get('/payment-summary/excel',VerifyToken,checkOfflinePermission('Reports'),paymentSummaryExcel);
router.get('/daily-collection/excel',VerifyToken,checkOfflinePermission('Reports'),dailyCollectionExcel);
router.get('/daily-transaction/excel',VerifyToken,checkOfflinePermission('Reports'),dailyTransactionExcel)


//daily transaction type 
router.get('/reports/daily-transaction',VerifyToken,checkOfflinePermission('Reports'),getDailyTransactionReport)
router.get('/daily-transaction/pdf',VerifyToken,checkOfflinePermission('Reports'),getDailyTransactionPDF)


//purchse Expence Report
router.get('/reports/purchase',VerifyToken,checkOfflinePermission('Reports'),getPurchaseReport);
router.get('/reports/expanse',VerifyToken,checkOfflinePermission('Reports'),getExpenseReport);
router.get('/purchase/pdf',VerifyToken,checkOfflinePermission('Reports'),generatePurchaseReportPDF);
router.get('/expense/pdf',VerifyToken,checkOfflinePermission('Reports'),generateExpenseReportPDF)
//excel
router.get('/purchase/excel',VerifyToken,checkOfflinePermission('Reports'),purchaseReportExcel)
router.get('/expense/excel',VerifyToken,checkOfflinePermission('Reports'),expenseReportExcel)

//change table
router.post('/order/change-table',VerifyToken,checkOfflinePermission('Admin'),changeTable);

//printer config
router.post('/printer/upsert',VerifyToken,checkOfflinePermission('Admin'),upsertPrinterConfig);
router.put('/printer/upsert',VerifyToken,checkOfflinePermission('Admin'),updatePrinterConfig);
router.get('/printer/get',VerifyToken,checkOfflinePermission('Admin'),getPritnerConfigs);
router.post('/print-settings',VerifyToken,checkOfflinePermission('Admin'),updatePosSettings);
router.get('/print-settings/:restaurantId',VerifyToken,checkOfflinePermission('Admin'),getPosSettings);


//settings 
router.post('/bill-settings',VerifyToken,checkOfflinePermission('Admin'),updateBillSettings);
router.get('/bill-settings/:restaurantId',VerifyToken,checkOfflinePermission('Admin'),getBillSettings)


//supplier
router.post('/vendor',VerifyToken,checkOfflinePermission('Admin'),createSupplier);
router.get('/vendor-id',VerifyToken,checkOfflinePermission('Admin'),getSuppliers);
router.put('/vendor',VerifyToken,checkOfflinePermission('Admin'),updateSupplier);
router.delete('/vendor/:supplierId',VerifyToken,checkOfflinePermission('Admin'),deleteSupplier);
router.get('/vendor/credit',VerifyToken,checkOfflinePermission('Admin'),getSupplierDueHistory);
router.post('/vendor/pay',VerifyToken,checkOfflinePermission('Admin'),paySupplierDue);
router.get('/vendor/credit/pdf',VerifyToken,checkOfflinePermission('Admin'),SupplierDueHistoryPdf);

//ingredients
router.post('/ingredient',VerifyToken,checkOfflinePermission('Admin'),createIngredient)
router.get('/ingredient/id',VerifyToken,checkOfflinePermission('Admin'),getAllIngredients)
router.put('/ingredient',VerifyToken,checkOfflinePermission('Admin'),updateIngredient)
router.delete('/ingredient/:ingredientId',VerifyToken,checkOfflinePermission('Admin'),deleteIngredient);


//purchase     
router.post('/purchase',VerifyToken,checkOfflinePermission('Purchase'),createPurchase);
router.get('/purchase',VerifyToken,checkOfflinePermission('Purchase'),getPurchaseList)
router.get('/purhcase-report',VerifyToken,checkOfflinePermission('Purchase'),getAllPurchasesReport);
router.put('/purchase',VerifyToken,checkOfflinePermission('Purchase'),updatePurchase);
router.get('/purchase/one/:purchaseId',VerifyToken,checkOfflinePermission('Purchase'),getOnePurchase)



//Expense
router.post('/expense',VerifyToken,checkOfflinePermission('Admin'),createExpense);
router.get('/expense',VerifyToken,checkOfflinePermission('Admin'),getExpenseList);
router.put('/expense',VerifyToken,checkOfflinePermission('Admin'),updateExpense);
router.get('/expense/:expenseId',VerifyToken,checkOfflinePermission('Admin'),getOneExpense)
router.get('/expense-report',VerifyToken,checkOfflinePermission('Admin'),getAllExpensesReport);



//kitchen kot 
router.get('/get-kot/:restaurantId',VerifyToken,checkOfflinePermission('Admin'),getKOTTickets);
// router.get('/pending-kot/:restaurantId',VerifyToken,checkOfflinePermission('Admin'),getPendingKOTTickets);
// router.get('/prepared-kot/:restaurantId',VerifyToken,checkOfflinePermission('Admin'),getPreparedKOTTickets);
// router.get('/completed-kot/:restaurantId',VerifyToken,checkOfflinePermission('Admin'),getCompltedKOTTickets);

//kot action
// router.post('/kot/accept',VerifyToken,checkOfflinePermission('Admin'),acceptKOT);
// router.post('/kot/ready',VerifyToken,checkOfflinePermission('Admin'),readyKOT);



//riders 
router.post('/rider',VerifyToken,checkOfflinePermission('Admin'),createRider);
router.get('/rider',VerifyToken,checkOfflinePermission('Admin'),getRiders);
router.get('/rider/:riderId',VerifyToken,checkOfflinePermission('Admin'),getRiders);
router.put('/rider',VerifyToken,checkOfflinePermission('Admin'),updateRider);
router.delete('/rider/:riderId',VerifyToken,checkOfflinePermission('Admin'),deleteRider);


//Deliver listings 
router.get('/placed/delivery',VerifyToken,checkOfflinePermission('Admin'),getPlacedHomeDelivery);
router.get('/waiting/delivery',VerifyToken,checkOfflinePermission('Admin'),getWaitingForHomeDelivery)
router.get('/out/delivery',VerifyToken,checkOfflinePermission('Admin'),getOutForHomeDelivery)
router.get('/completed/delivery',VerifyToken,checkOfflinePermission('Admin'),getDeliveredHomeDelivery);

//delivery status chagnes
router.post('/ready/delivery',VerifyToken,checkOfflinePermission('Admin'),markOrderReadyForPickup)
router.post('/assign/delivery',VerifyToken,checkOfflinePermission('Admin'),assignRiderForOut)
router.post('/complete/delivery',VerifyToken,checkOfflinePermission('Admin'),completeHomeDelivery)


//profit and loss
router.get('/reports/profit-loss',VerifyToken,checkOfflinePermission('Reports'),getProfitAndLossReport);
router.get('/profit-loss/pdf',VerifyToken,checkOfflinePermission('Reports'),profitandLossPdf);
router.get('/profit-loss/excel',VerifyToken,checkOfflinePermission('Reports'),profitAndLossExcel);


router.get('/dineIn/print/:orderId',VerifyToken,checkOfflinePermission('Admin'),printDinInCustomerReceipt);
router.get('/re-print/:orderId',VerifyToken,checkOfflinePermission('Admin'),rePrintForTakeHome)
router.get('/dineIn/re-print/:orderId',VerifyToken,checkOfflinePermission('Admin'),rePrintDinIn);





export default router;