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

//couse payment

router.post("/create-course-payment",authMiddleware,studentController.createCourseOrder);
router.post("/verify-course-payment",authMiddleware,studentController.verifyCoursePayment);
// router.get("/getCourseCategories",studentController.getCourseCategories)



//cart-payment
router.post("/create-cart-payment",authMiddleware,studentController.createCartOrder);
router.post("/verify-cart-payment",authMiddleware,studentController.verifyCartPayment);

router.get("/get-latest-Course-test",studentController.getLatestCoursesAndTests)    



//test payment
// router.post("/create-course-payment",authMiddleware,studentController.createCourseOrder);
// router.post("/verify-course-payment",authMiddleware,studentController.verifyCoursePayment);

module.exports = router