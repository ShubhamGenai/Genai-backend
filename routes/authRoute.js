const express = require("express")
const router=express.Router()
const authController=require("../controllers/authControllers");
const authMiddleware = require("../middlewares/AuthMiddleware");


router.post('/register', authController.registerUser);
router.post('/verify-otp', authController.verifyOtp);
router.post('/resend-otp', authController.resendOtp);
router.post('/complete-profile', authController.completeProfile);
router.post('/login', authController.loginUser);


router.post('/reset-password/email', authController.restpassword);
router.post('/reset-password/verify-otp', authController.verifyResetOtp);
router.post('/reset-password/set-password', authController.setPassword);


router.post("/google",authController.googlelogin)
router.get('/google/callback', authController.googleCallback);


router.post("/admin-signup",authController.registerAdmin)
router.post("/admin-signin",authController.adminSignIn)

router.post("/content-manager-signup",authController.registerContent)
router.post("/content-manager-signin",authController.contentManagerSignIn)


router.get("/userDetails",authMiddleware,authController.getUserDetails)


// Mobile Authentication Routes
router.post('/login/send-otp', authController.sendLoginOtp);
router.post('/login/verify-otp', authController.verifyLoginOtp);
router.post('/signup/send-otp', authController.sendSignupOtp);
router.post('/signup/verify-otp', authController.verifySignupOtp);

// Student learning goal & preference onboarding
router.post(
  "/save-learning-preferences",
  authMiddleware,
  authController.saveLearningPreferences
);


module.exports=router