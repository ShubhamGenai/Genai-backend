const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController")


router.get("/getTests",studentController.getTests);
router.get("./getCurses",studentController.getCourses)
router.get("/getTestById/:id",studentController.getTestById)
router.get("/getCourseById/:id",studentController.getCourseById)

router.get("/getTestCategories",studentController.getTestCategories)



module.exports = router