const express = require("express")
const router=express.Router()
const authController=require("../controllers/authControllers");
const authMiddleware = require("../middlewares/AuthMiddleware");


router.post('/register', authController.registerUser);
router.post('/verify-otp', authController.verifyOtp);
router.post('/complete-profile', authController.completeProfile);
router.post('/login', authController.loginUser);


router.post('/reset-password/email', authController.restpassword);
router.post('/reset-password/verify-otp', authController.verifyResetOtp);
router.post('/reset-password/set-password', authController.setPassword);


router.get("/google",authController.googlelogin)
router.get('/google/callback', authController.googleCallback);


router.post("/admin-signup",authController.registerAdmin)
router.post("/admin-signin",authController.adminSignIn)


router.get("/userDetails",authMiddleware,authController.getUserDetails)




module.exports=router