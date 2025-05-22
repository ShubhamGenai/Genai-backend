const express = require("express");
const router = express.Router();
const contentController = require("../controllers/contentController");

router.post('/add-course',contentController.addCourse);
router.post("/add-lesson", contentController.addLesson);
router.post("/add-module", contentController.addModule)
router.post("/add-test", contentController.addTest)
router.post("/add-quiz", contentController.addQuiz)
router.get("/get-quiz", contentController.getQuiz)
router.get("/get-lesson", contentController.getLesson)
router.get("/lesson-view/:lessonId", contentController.getLessonById)



module.exports =  router;