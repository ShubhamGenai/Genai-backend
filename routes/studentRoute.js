const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");
const authMiddleware = require("../middlewares/AuthMiddleware");

// Student profile (authenticated)
router.get("/profile", authMiddleware, studentController.getMyStudentProfile);
router.put("/profile", authMiddleware, studentController.updateMyStudentProfile);
router.put("/profile/education", authMiddleware, studentController.updateMyStudentEducation);
router.put("/profile/skills", authMiddleware, studentController.updateMyStudentSkills);

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
router.post("/submitTest",authMiddleware,studentController.submitTest)

//test payment
router.post("/create-payment",authMiddleware,studentController.createOrder);
router.post("/verify-payment",authMiddleware,studentController.verifyPayment);
router.post("/enroll-free-test",authMiddleware,studentController.enrollFreeTest);
router.post("/enroll-free-course", authMiddleware, studentController.enrollFreeCourse);
router.get("/course-access/:courseId", authMiddleware, studentController.getCourseAccessStatus);
router.get("/course-player-data/:courseId", authMiddleware, studentController.getCoursePlayerData);

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

// Get enrolled tests
router.get("/getEnrolledTests", authMiddleware, studentController.getEnrolledTests);

// Get dashboard overview
router.get("/getDashboardOverview", authMiddleware, studentController.getDashboardOverview);

// Get test submission history
router.get("/getTestSubmissionHistory/:testId", authMiddleware, studentController.getTestSubmissionHistory);

// Get detailed submission results
router.get("/getTestSubmissionDetails/:submissionId", authMiddleware, studentController.getTestSubmissionDetails);

// AI Chat endpoint
router.post("/ai-chat", authMiddleware, studentController.aiChat);

// Generate question explanation
router.post("/generate-question-explanation", authMiddleware, studentController.generateQuestionExplanation);

// AI-generated course content (per course / lesson); persisted per student
router.post("/generate-course-content", authMiddleware, studentController.generateCourseContent);
router.post(
  "/generate-lesson-from-context",
  authMiddleware,
  studentController.generateLessonFromContext
);
router.get(
  "/course-ai-content/:courseId",
  authMiddleware,
  studentController.getStudentCourseAiContent
);

router.post("/course-progress", authMiddleware, studentController.updateCourseProgress);
router.get("/course-progress/:courseId", authMiddleware, studentController.getCourseProgress);

// Get AI career recommendations
router.get("/getAICareerRecommendations", authMiddleware, studentController.getAICareerRecommendations);

// Library documents (student-facing)
router.get("/library-documents", studentController.getLibraryDocumentsForStudent);
router.get("/library-documents/:id", studentController.getLibraryDocumentByIdForStudent);

// Library document payments
router.post("/create-library-payment", authMiddleware, studentController.createLibraryOrder);
router.post("/verify-library-payment", authMiddleware, studentController.verifyLibraryPayment);
router.get("/library-purchases", authMiddleware, studentController.getPurchasedLibraryDocuments);

//test payment
// router.post("/create-course-payment",authMiddleware,studentController.createCourseOrder);
// router.post("/verify-course-payment",authMiddleware,studentController.verifyCoursePayment);

module.exports = router