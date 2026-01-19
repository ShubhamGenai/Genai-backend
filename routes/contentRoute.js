const express = require("express");
const router = express.Router();
const contentController = require("../controllers/contentController");

router.post('/add-course',contentController.addCourse);
router.put('/update-course/:id', contentController.updateCourse);
router.delete('/delete-course/:id', contentController.deleteCourse);
router.post("/add-lesson", contentController.addLesson);
router.put("/update-lesson/:id", contentController.updateLesson);
router.delete("/delete-lesson/:id", contentController.deleteLesson);
router.post("/add-module", contentController.addModule)
router.put("/update-module/:id", contentController.updateModule);
router.delete("/delete-module/:id", contentController.deleteModule);
router.post("/add-test", contentController.addTest)
router.put("/update-test/:id", contentController.updateTest)
router.delete("/delete-test/:id", contentController.deleteTest)
router.post("/add-quiz", contentController.addQuiz)
router.put("/update-quiz/:id", contentController.updateQuiz)
router.delete("/delete-quiz/:id", contentController.deleteQuiz)
router.get("/get-tests", contentController.getTests)
router.get("/get-test/:id", contentController.getTestById)
router.get("/get-test-images", contentController.getTestImages)
router.get("/get-courses", contentController.getCourses)
router.get("/get-course/:id", contentController.getCourseById)
router.get("/get-quiz", contentController.getQuiz)
router.get("/get-lesson", contentController.getLesson)
router.get("/get-module", contentController.getModules)
router.get("/get-modulebyid", contentController.getModuleById)
router.get("/lesson-view/:lessonId", contentController.getLessonById)
router.post("/upload-library-document", contentController.upload.single('pdfFile'), contentController.uploadLibraryDocument)
router.get("/get-library-documents", contentController.getLibraryDocuments)
router.post("/add-library-category", contentController.addLibraryCategory)
router.get("/get-library-categories", contentController.getLibraryCategories)
router.post("/add-library-class", contentController.addLibraryClass)
router.get("/get-library-classes", contentController.getLibraryClasses)
router.get("/dashboard-stats", contentController.getDashboardStats)
router.get("/recent-activities", contentController.getRecentActivities)
router.post("/upload-question-image", contentController.uploadImage.single('imageFile'), contentController.uploadQuestionImage)
router.post("/upload-test-image", contentController.uploadImage.single('imageFile'), contentController.uploadTestImage)
router.post("/parse-pdf", contentController.pdfUpload.single('pdfFile'), contentController.parsePdf)
router.post("/generate-quiz-questions", contentController.generateQuizQuestions)


module.exports =  router;