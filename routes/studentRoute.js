const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");
const authMiddleware = require("../middlewares/AuthMiddleware");

//test
router.get("/getTests",studentController.getTests);
router.get("/getTestById/:id",studentController.getTestById)
router.get("/getTestCategories",studentController.getTestCategories)

//cart
router.post("/addToCart",authMiddleware,studentController.addToCart)
router.get("/checkitemCart",authMiddleware,studentController.checkItemInCart)
router.get("/getCartTests",authMiddleware,studentController.getCartTests)
router.delete("/removeFromCart",authMiddleware,studentController.removeFromCart)

//test - player
router.post("/getQuiz",studentController.getQuiz);
router.post("/submitQuiz",authMiddleware,studentController.submitQuiz)

//test payment
router.post("/create-payment",authMiddleware,studentController.createOrder);
router.post("/verify-payment",authMiddleware,studentController.verifyPayment);


//course/
router.get("/getCourse",studentController.getCourse);
router.get("/getCourseById/:id",studentController.getCourseById)
// router.get("/getCourseCategories",studentController.getCourseCategories)

module.exports = router