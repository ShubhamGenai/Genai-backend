const express = require("express");
const router = express.Router();
const contentController = require("../controllers/contentController");

router.post('/add-course',contentController.addCourse);
router.post("/add-lesson", contentController.addLesson);
router.post("/add-module", contentController.addModule)



module.exports =  router;