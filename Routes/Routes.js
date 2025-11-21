const express = require("express");
const { checkAndGetUserByToken, CreateAccount, SignAccount, getMyProfile, verifyOTPAndSignIn, VerifyCreateAccountOTP, createAdmin, getAllActionnaire, getUserById, sendPasswordResetOTP, verifyOTPAndResetPassword, resendPasswordResetOTP, resetPassWord, updateOwnProfile } = require("../Controllers/AuthController");
const { participateProject, giveYourDividendToTheProject, getProjectByUser, changePassword } = require("../Controllers/UserProjectController");
const { authenticateTokenAndUserData, authenticateUser } = require("../Middlewares/VerifyToken");
const { createProject, getAllProject } = require("../Controllers/ProjectController");
const { handlePaymentCallback, handleBuyActionsCallback } = require("../Controllers/paymentCallbackController");
const { buyAction } = require("../Controllers/ActionController");
const { bulkCreateUsersFromPDF, uploadPDF } = require("../utils/bulkCreateUsers");
const { getAllTransactionsByUser, getAllTransactions } = require("../Controllers/TransactionController");
const { uploadImg } = require("../Middlewares/awsUpload");
const { previewPdfImport } = require("../utils/test");


const router = express.Router();
const uploadFields = [
  { name: 'rapport', maxCount: 3 }
];

router.post("/createAccount",CreateAccount)
router.post("/login",SignAccount)
router.post("/auth/verify-otp", verifyOTPAndSignIn);
router.post("/createAccount/verify-otp", VerifyCreateAccountOTP);
router.get('/verify-token/:token', checkAndGetUserByToken);
router.post('/change-password', changePassword);
router.post("/createAnProject",uploadImg(uploadFields),createProject)
router.post('/participeToProject',authenticateUser,participateProject)
router.post("/giveYourDividendToTheProject",authenticateUser,giveYourDividendToTheProject)
router.get('/getMyProfile', authenticateUser, getMyProfile);
router.post("/buyActions",authenticateUser,buyAction)
router.post("/bulk-create-users",uploadPDF, bulkCreateUsersFromPDF);
router.post("/ipn",handlePaymentCallback)
router.get("/getAllActionnaire",getAllActionnaire)
router.get("/getransactionbyuser",authenticateUser,getAllTransactionsByUser)
router.get("/getAllProject",authenticateUser,getAllProject)
router.get("/getProjectByUser",authenticateUser,getProjectByUser)
router.get("/getAllTransactions",authenticateUser,getAllTransactions)
router.post('/bulk-import', uploadPDF, previewPdfImport);
router.post("/ipnpayment",handleBuyActionsCallback)
router.post("/createAdmin",createAdmin)
router.get("/get-user/:id",authenticateUser,getUserById);
router.put('/updateProfile', authenticateUser, updateOwnProfile);
router.post('/request-password-reset', sendPasswordResetOTP);
router.post('/verify-reset-otp', verifyOTPAndResetPassword);
router.post('/resend-reset-otp', resendPasswordResetOTP);
router.post("/reset-password/:resetToken", resetPassWord);
module.exports=router