const express = require("express");
const { checkAndGetUserByToken, CreateAccount, SignAccount, getMyProfile, verifyOTPAndSignIn, VerifyCreateAccountOTP } = require("../Controllers/AuthController");
const { participateProject, giveYourDividendToTheProject } = require("../Controllers/UserProjectController");
const { authenticateTokenAndUserData, authenticateUser } = require("../Middlewares/VerifyToken");
const { createProject } = require("../Controllers/ProjectController");
const { handlePaymentCallback, handleBuyActionsCallback } = require("../Controllers/paymentCallbackController");
const { buyAction } = require("../Controllers/ActionController");
const { bulkCreateUsersFromPDF, uploadPDF } = require("../utils/bulkCreateUsers");
const router = express.Router();


router.post("/createAccount",CreateAccount)
router.post("/login",SignAccount)
router.post("/auth/verify-otp", verifyOTPAndSignIn);
router.post("/createAccount/verify-otp", VerifyCreateAccountOTP);
router.get('/verify-token/:token', checkAndGetUserByToken);
router.post("/createAnProject",createProject)
router.post('/participeToProject',authenticateUser,participateProject)
router.post("/giveYourDividendToTheProject",authenticateUser,giveYourDividendToTheProject)
router.get('/getMyProfile', authenticateUser, getMyProfile);
router.post("/buyActions",authenticateUser,buyAction)
router.post("/bulk-create-users",uploadPDF, bulkCreateUsersFromPDF);
router.post("/ipn",handlePaymentCallback)
router.post("/ipnpayment",handleBuyActionsCallback)

module.exports=router