const express = require("express")
const router=express.Router()
const authController=require("../controllers/authControllers")


router.post('/register', authController.registerUser);
router.post('/verify-otp', authController.verifyOtp);
router.post('/complete-profile', authController.completeProfile);
router.post('/login', authController.loginUser);

module.exports=router