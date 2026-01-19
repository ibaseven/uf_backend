const express = require("express");
const { checkAndGetUserByToken, CreateAccount, SignAccount, getMyProfile, createAdmin, getAllActionnaire, getUserById, sendPasswordResetOTP, verifyOTPAndResetPassword, resetPassWord, updateOwnProfile, updateUser, getUserBalance, changePassword, getTheOwner, deleteUser } = require("../Controllers/AuthController");
// ANCIEN CODE OTP - imports commentés: verifyOTPAndSignIn, VerifyCreateAccountOTP, resendPasswordResetOTP, resendSignUpOTP, resendLoginOTP
const { participateProject, giveYourDividendToTheProject, getProjectByUser } = require("../Controllers/UserProjectController");
const { authenticateTokenAndUserData, authenticateUser, adminRole, authenticateAdmin } = require("../Middlewares/VerifyToken");
const { createProject, getAllProject, getProjectParticipants, decreaseParticipantPacks, increaseParticipantPacks, updateProject, deleteProject } = require("../Controllers/ProjectController");
const { handlePaymentCallback, handleBuyActionsCallback, confirmPaymentManually } = require("../Controllers/paymentCallbackController");
const { buyAction } = require("../Controllers/ActionController");
const { bulkCreateUsersFromPDF, uploadPDF } = require("../utils/bulkCreateUsers");
const { getAllTransactionsByUser, getAllTransactions, getTransactionsByProcess } = require("../Controllers/TransactionController");
const { uploadImg } = require("../Middlewares/awsUpload");
const { previewPdfImport } = require("../utils/test");
const { updateActionPrice, getActionPrice } = require("../Controllers/SettingsController");
const { payduniaCallbackLimiter, verifyPaydunyaCallback, paydunyaCallbackLimiter } = require("../Middlewares/payduniaCallbackMiddleware");
const { initiateDividendWithdrawal, confirmDividendWithdrawal, initiateDividendActionsWithdrawal, initiateDividendProjectWithdrawal, confirmDividendProjectWithdrawal, confirmDividendActionsWithdrawal } = require("../Controllers/Balance");
const { deducteTheFee } = require("../Controllers/feesController");
const { createActionAndCalculateDividendes, distributeProjectDividende } = require("../Controllers/ActionandProjectController");
const { createBulkUsersWithRandomPasswords, createSingleUserWithRandomPassword } = require("../Controllers/BulkUserCreationController");
const { sendPasswordsToActionnaires } = require("../Controllers/PasswordNotificationController");
const { sendInvitations, sendInvitationToActionnaire } = require("../Controllers/WhatsAppInvitationController");


const router = express.Router();
const uploadFields = [
  { name: 'rapport', maxCount: 3 }
];

router.post("/createAccount",CreateAccount)
router.post("/login",SignAccount)
// ANCIEN CODE OTP - COMMENTÉ
// router.post("/resend-login-otp", resendLoginOTP);
// router.post("/auth/verify-otp", verifyOTPAndSignIn);
// router.post("/createAccount/verify-otp", VerifyCreateAccountOTP);
// router.post("/resendOtpCreateAccount/verify-otp", resendSignUpOTP);
// FIN ANCIEN CODE OTP
router.get('/verify-token/:token', checkAndGetUserByToken);
router.post('/change-password', changePassword);
router.post("/createAnProject",uploadImg(uploadFields),createProject)
router.post('/participeToProject',authenticateUser,participateProject)
router.post("/giveYourDividendToTheProject",authenticateUser,giveYourDividendToTheProject)
router.get('/getMyProfile', authenticateUser, getMyProfile);
router.post("/buyActions",authenticateUser,buyAction)
router.post("/bulk-create-users",uploadPDF, bulkCreateUsersFromPDF);
//router.post("/ipn",payduniaCallbackLimiter,handlePaymentCallback)
router.post("/ipn",paydunyaCallbackLimiter,verifyPaydunyaCallback,handlePaymentCallback)
router.get("/getAllActionnaire",authenticateUser,getAllActionnaire)
router.get("/getTheOwner",authenticateUser,getTheOwner)
router.get("/getransactionbyuser",authenticateUser,getAllTransactionsByUser)
router.get("/getAllProject",authenticateUser,getAllProject)
router.get("/getProjectByUser",authenticateUser,getProjectByUser)
router.get("/getAllTransactions",authenticateUser,getAllTransactions)
router.post('/bulk-import', uploadPDF, previewPdfImport);
router.post("/ipnpayment",paydunyaCallbackLimiter,verifyPaydunyaCallback,handleBuyActionsCallback)
//router.post("/ipnpayment",payduniaCallbackLimiter,handleBuyActionsCallback)
router.post("/createAdmin",createAdmin)
router.get("/get-user/:id",authenticateUser,getUserById);
router.get("/get-admin",adminRole,getUserBalance);
router.put('/updateProfile', authenticateUser, updateOwnProfile);
router.post('/request-password-reset', sendPasswordResetOTP);
router.post('/verify-reset-otp', verifyOTPAndResetPassword);
// ANCIEN CODE OTP - COMMENTÉ
// router.post('/resend-reset-otp', resendPasswordResetOTP);
// FIN ANCIEN CODE OTP
router.post("/reset-password/:resetToken", resetPassWord);
router.put("/action/price", adminRole,updateActionPrice);
router.get("/action/getPrice",getActionPrice);
router.put('/admin/users/:userId', authenticateUser, adminRole, updateUser);
router.post("/dividends/withdrawActions/initiate" ,adminRole, initiateDividendActionsWithdrawal);
router.post("/dividends/withdrawProjects/initiate" ,adminRole, initiateDividendProjectWithdrawal);
router.post("/dividends/withdrawProjects/confirm",adminRole, confirmDividendProjectWithdrawal);
router.post("/dividends/withdrawActions/confirm",adminRole, confirmDividendActionsWithdrawal);
router.post("/deduceFees",authenticateUser,deducteTheFee);
router.get("/getTransactionsByProcess",getTransactionsByProcess)
router.get('/projects/:projectId/participants', authenticateUser,getProjectParticipants);
router.put('/projects/:projectId/participants/:userId/decrease',authenticateUser,decreaseParticipantPacks);
router.put('/projects/:projectId/participants/:userId/increase',authenticateUser,increaseParticipantPacks);
router.put("/updateProject/:id",authenticateUser, adminRole,updateProject)
router.delete("/deleteProject/:id",authenticateUser, adminRole,deleteProject)
router.delete("/deteleUser/:id",authenticateUser, adminRole,deleteUser)
router.post("/calculateDividende", adminRole,createActionAndCalculateDividendes)

router.post("/project/dividende",adminRole, distributeProjectDividende);
router.post("/admin/users/bulk-create", adminRole, createBulkUsersWithRandomPasswords);
router.post("/admin/users/create-with-password", adminRole, createSingleUserWithRandomPassword);
router.post('/send-passwords-actionnaires', sendPasswordsToActionnaires);

// Routes pour les invitations WhatsApp
router.post('/send-whatsapp-invitations', adminRole, sendInvitations);
router.post('/send-whatsapp-invitation/:userId', adminRole, sendInvitationToActionnaire);
router.post("/confirm", confirmPaymentManually);
module.exports=router
