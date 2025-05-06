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
router.get("/getCartCourses",authMiddleware,studentController.getCartCourses)
router.post("/getModulesDetails",studentController.getModulesDetails) // Fetch modules by IDs

// router.get("/getCourseCategories",studentController.getCourseCategories)


//course -cart
// router.post("/addCourseToCart",authMiddleware,studentController.addCourseToCart)
// router.get("/checkCourse-itemCart",authMiddleware,studentController.checkCourseItemInCart)
// router.get("/getCartCourse",authMiddleware,studentController.getCartCourse)
// router.delete("/removeFromCart",authMiddleware,studentController.removeFromCart)


//test payment
// router.post("/create-course-payment",authMiddleware,studentController.createCourseOrder);
// router.post("/verify-course-payment",authMiddleware,studentController.verifyCoursePayment);

module.exports = router