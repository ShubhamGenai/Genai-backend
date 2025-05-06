const express = require("express");
const router = express.Router();
const employerController = require("../controllers/employerController")

router.post("/verify-employer",employerController.employerEmailVerify)
router.post("/employer-register",employerController.employerRegistration)
router.post("/employer-signin",employerController.employerSignin)

module.exports = router;