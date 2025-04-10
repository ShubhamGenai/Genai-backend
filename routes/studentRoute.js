const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");
const authMiddleware = require("../middlewares/AuthMiddleware");


router.get("/getTests",studentController.getTests);
router.get("./getCurses",studentController.getCourses)
router.get("/getTestById/:id",studentController.getTestById)
router.get("/getCourseById/:id",studentController.getCourseById)

router.get("/getTestCategories",studentController.getTestCategories)

router.post("/addToCart",authMiddleware,studentController.addToCart)
router.get("/checkitemCart",authMiddleware,studentController.checkItemInCart)
router.get("/getCartTests",authMiddleware,studentController.getCartTests)
router.delete("/removeFromCart",authMiddleware,studentController.removeFromCart)
router.post("/getQuiz",studentController.getQuiz);

router.post("/submitQuiz",authMiddleware,studentController.submitQuiz)

module.exports = router