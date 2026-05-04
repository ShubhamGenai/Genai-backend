const Cart = require("../models/Cart");
const Course = require("../models/courseModel/courseModel");
const Test = require("../models/testModel/testModel");
const Quiz = require("../models/courseModel/quiz");
const LibraryDocument = require("../models/libraryModel");
const SubmissionModel = require("../models/testModel/SubmissionModel");
const paymentSchema = require("../models/paymentSchema");
const Razorpay = require("razorpay");
const dotenv = require("dotenv");
const User = require("../models/UserModel");
const Student = require("../models/studentSchema");
const crypto = require('crypto');
const EnrolledTest = require("../models/testModel/enrolledTest");
const Module = require("../models/courseModel/module");
const { default:mongoose } = require("mongoose");
const EnrolledCourse = require("../models/courseModel/enrolledCourseModel");
const Anthropic = require("@anthropic-ai/sdk");
const { formatAiExplanationToHtml } = require('../utils/aiFormatter');
const { logStudentActivity } = require("./studentActivityController");
const {
  LIMITS,
  clip,
  sanitizeOptionalUrl,
  normalizeEducationEntry,
  normalizeSkillEntry,
  findOrCreateStudent,
} = require("../utils/studentProfileSanitize");
dotenv.config();

const getMyStudentProfile = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const user = await User.findById(req.user.id).select("-password").lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const student = await findOrCreateStudent(Student, req.user.id);
    const s = student.toObject();
    const addr = s.address || {};
    const education = (s.education || []).map((e, idx) => ({
      _id: e._id ? String(e._id) : `e${idx}`,
      degree: e.degree || "",
      institution: e.institution || "",
      startYear: e.startYear || "",
      endYear: e.endYear || "",
      gpa: e.gpa || "",
      description: e.description || "",
      achievements: Array.isArray(e.achievements) ? e.achievements : [],
    }));
    const skills = (s.skills || []).map((sk) => ({
      name: sk.name || "",
      level: sk.level || "beginner",
      category: sk.category || "other",
      endorsed: typeof sk.endorsed === "number" ? sk.endorsed : 0,
    }));
    return res.json({
      success: true,
      data: {
        name: user.name || "",
        email: user.email || "",
        phone: s.contact || user.mobile || "",
        location: s.location || "",
        role: user.role,
        bio: clip(String(s.bio || ""), LIMITS.bio),
        github: sanitizeOptionalUrl(s.github || "") || "",
        linkedin: sanitizeOptionalUrl(s.linkedin || "") || "",
        website: sanitizeOptionalUrl(s.website || "") || "",
        joinDate: user.createdAt ? new Date(user.createdAt).toISOString().slice(0, 10) : "",
        dateOfBirth: s.dateOfBirth || "",
        gender: s.gender || "",
        nationality: s.nationality || "",
        avatar: sanitizeOptionalUrl(s.avatar || "", LIMITS.urlField) || "/profile.jpg",
        address: {
          street: addr.street || "",
          city: addr.city || "",
          state: addr.state || "",
          country: addr.country || "",
          pincode: addr.pincode || "",
        },
        education,
        skills,
      },
    });
  } catch (error) {
    console.error("getMyStudentProfile:", error);
    return res.status(500).json({ success: false, message: "Failed to load profile" });
  }
};

const updateMyStudentProfile = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const body = req.body || {};
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    let userDirty = false;
    if (typeof body.name === "string") {
      user.name = clip(body.name, LIMITS.name);
      userDirty = true;
    }
    if (typeof body.phone === "string") {
      user.mobile = clip(body.phone, LIMITS.phone);
      userDirty = true;
    }
    if (userDirty) await user.save();

    const student = await findOrCreateStudent(Student, req.user.id);
    const applyOptionalUrl = (field) => {
      if (typeof body[field] !== "string") return;
      const t = body[field].trim();
      if (t === "") {
        student[field] = "";
        return;
      }
      const safe = sanitizeOptionalUrl(body[field]);
      if (safe) student[field] = safe;
    };
    if (typeof body.bio === "string") student.bio = clip(body.bio, LIMITS.bio);
    applyOptionalUrl("github");
    applyOptionalUrl("linkedin");
    applyOptionalUrl("website");
    if (typeof body.location === "string") student.location = clip(body.location, LIMITS.line);
    if (typeof body.dateOfBirth === "string") student.dateOfBirth = clip(body.dateOfBirth, 32);
    if (typeof body.gender === "string") student.gender = clip(body.gender, 64);
    if (typeof body.nationality === "string") student.nationality = clip(body.nationality, 64);
    if (typeof body.avatar === "string") {
      const t = body.avatar.trim();
      if (t === "") student.avatar = "";
      else {
        const safe = sanitizeOptionalUrl(body.avatar, LIMITS.urlField);
        if (safe) student.avatar = safe;
      }
    }
    if (typeof body.phone === "string") student.contact = clip(body.phone, LIMITS.phone);
    if (body.address && typeof body.address === "object") {
      student.address = {
        street: clip(String(body.address.street ?? ""), LIMITS.line),
        city: clip(String(body.address.city ?? ""), LIMITS.line),
        state: clip(String(body.address.state ?? ""), LIMITS.line),
        country: clip(String(body.address.country ?? ""), LIMITS.line),
        pincode: clip(String(body.address.pincode ?? ""), 24),
      };
    }
    await student.save();
    return res.json({ success: true, message: "Profile updated successfully" });
  } catch (error) {
    console.error("updateMyStudentProfile:", error);
    return res.status(500).json({ success: false, message: "Failed to update profile" });
  }
};

const updateMyStudentEducation = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const { education } = req.body || {};
    if (!Array.isArray(education)) {
      return res.status(400).json({ success: false, message: "education must be an array" });
    }
    const student = await findOrCreateStudent(Student, req.user.id);
    student.education = education
      .slice(0, LIMITS.educationMax)
      .map((e) => normalizeEducationEntry(e));
    await student.save();
    return res.json({ success: true, message: "Education updated successfully" });
  } catch (error) {
    console.error("updateMyStudentEducation:", error);
    return res.status(500).json({ success: false, message: "Failed to update education" });
  }
};

const updateMyStudentSkills = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const { skills } = req.body || {};
    if (!Array.isArray(skills)) {
      return res.status(400).json({ success: false, message: "skills must be an array" });
    }
    const student = await findOrCreateStudent(Student, req.user.id);
    student.skills = skills
      .slice(0, LIMITS.skillsMax)
      .map((s) => normalizeSkillEntry(s))
      .filter((s) => s.name.length > 0);
    await student.save();
    return res.json({ success: true, message: "Skills updated successfully" });
  } catch (error) {
    console.error("updateMyStudentSkills:", error);
    return res.status(500).json({ success: false, message: "Failed to update skills" });
  }
};

// Initialize Anthropic (Claude) client for AI chat
let anthropic = null;
const DEFAULT_CLAUDE_MODEL = process.env.CLAUDE_MODEL_NAME || "claude-3-sonnet-20240229";

if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  console.log('✅ Anthropic (Claude) API initialized for AI chat');
} else {
  console.warn('⚠️ ANTHROPIC_API_KEY not found. AI chat will not work.');
}


const getCourse = async (req, res) => {
    try {
      const courses = await Course.find(); // Populate modules if needed
      res.status(200).json(courses);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  
  const TEST_KINDS = ["standard", "practice", "mock", "test_series"];

  // ✅ Fetch tests (optional ?testKind=practice|mock|test_series|standard)
  const getTests = async (req, res) => {
    try {
      const { testKind } = req.query;
      let filter = {};
      if (testKind) {
        if (!TEST_KINDS.includes(String(testKind))) {
          return res.status(400).json({ error: "Invalid testKind query" });
        }
        if (String(testKind) === "standard") {
          filter = {
            $or: [
              { testKind: "standard" },
              { testKind: { $exists: false } },
              { testKind: null },
            ],
          };
        } else {
          filter = { testKind: String(testKind) };
        }
      }
      const tests = await Test.find(filter);
      res.status(200).json(tests);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  /** Student question bank: grouped by subject + category (no correct answers in GET). */
  const getQuestionBank = async (req, res) => {
    try {
      const search = String(req.query.search || "").trim().toLowerCase();

      const quizzes = await Quiz.find({ includeInQuestionBank: true })
        .select("title questions bankSubject bankCategory")
        .lean();

      const groupMap = new Map();

      for (const q of quizzes) {
        const subject = String(q.bankSubject || "General").trim() || "General";
        const category = String(q.bankCategory || "General").trim() || "General";
        const key = `${subject}|||${category}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, { subject, category, questions: [] });
        }
        const bucket = groupMap.get(key);
        const questionList = q.questions || [];

        questionList.forEach((sub, idx) => {
          const text = String(sub.questionText || "");
          if (search) {
            const hay = `${text} ${subject} ${category} ${q.title || ""}`.toLowerCase();
            if (!hay.includes(search)) return;
          }
          const subId = sub._id != null ? String(sub._id) : null;
          bucket.questions.push({
            id: `${q._id}_${subId || `idx${idx}`}`,
            quizId: String(q._id),
            questionId: subId || undefined,
            questionIndex: subId == null ? idx : undefined,
            quizTitle: q.title,
            questionText: text,
            passage: sub.passage || "",
            options: Array.isArray(sub.options) ? sub.options.map((o) => String(o)) : [],
            marks: sub.marks && !Number.isNaN(Number(sub.marks)) ? Number(sub.marks) : 1,
            imageUrl:
              sub.imageUrl && String(sub.imageUrl).trim()
                ? String(sub.imageUrl).trim()
                : "",
          });
        });
      }

      const groups = Array.from(groupMap.values())
        .filter((g) => g.questions.length > 0)
        .sort(
          (a, b) =>
            a.subject.localeCompare(b.subject, undefined, { sensitivity: "base" }) ||
            a.category.localeCompare(b.category, undefined, { sensitivity: "base" })
        );

      const totalQuestions = groups.reduce((n, g) => n + g.questions.length, 0);

      res.status(200).json({
        success: true,
        groups,
        totalQuestions,
      });
    } catch (error) {
      console.error("getQuestionBank:", error);
      res.status(500).json({ success: false, error: error.message || "Failed to load question bank" });
    }
  };

  /** Signed-in students only: reveal correct answer for a question-bank item. */
  const revealQuestionBankAnswer = async (req, res) => {
    try {
      const userId = req.user?.id || req.user?._id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Sign in required" });
      }
      if (req.user?.role && req.user.role !== "student") {
        return res.status(403).json({ success: false, message: "Students only" });
      }

      const { quizId, questionId, questionIndex } = req.body || {};
      if (!quizId || (!questionId && questionIndex === undefined)) {
        return res.status(400).json({
          success: false,
          message: "quizId and (questionId or questionIndex) are required",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(quizId)) {
        return res.status(400).json({ success: false, message: "Invalid quizId" });
      }

      const quiz = await Quiz.findOne({
        _id: quizId,
        includeInQuestionBank: true,
      });

      if (!quiz) {
        return res.status(404).json({ success: false, message: "Quiz not found or not in question bank" });
      }

      let sub = null;
      if (questionId) {
        try {
          sub = quiz.questions.id(String(questionId));
        } catch (e) {
          sub = null;
        }
        if (!sub) {
          sub = (quiz.questions || []).find((x) => String(x._id) === String(questionId));
        }
      } else {
        const qIdx = parseInt(questionIndex, 10);
        if (!Number.isNaN(qIdx) && qIdx >= 0) {
          sub = quiz.questions[qIdx];
        }
      }

      if (!sub) {
        return res.status(404).json({ success: false, message: "Question not found" });
      }

      return res.status(200).json({
        success: true,
        correctAnswer: String(sub.answer || "").trim(),
        questionText: sub.questionText,
        options: (sub.options || []).map((o) => String(o)),
        subject: quiz.bankSubject || "General",
        category: quiz.bankCategory || "General",
        quizTitle: quiz.title,
      });
    } catch (error) {
      console.error("revealQuestionBankAnswer:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to reveal answer",
      });
    }
  };

// Get all active library documents for students
const getLibraryDocumentsForStudent = async (req, res) => {
  try {
    const docs = await LibraryDocument.find({ isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      documents: docs
    });
  } catch (error) {
    console.error("Error fetching library documents for student:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch library documents"
    });
  }
};

// Get a single library document by id for students
const getLibraryDocumentByIdForStudent = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: "Document id is required" });
    }

    const doc = await LibraryDocument.findOne({ _id: id, isActive: true }).lean();
    if (!doc) {
      return res.status(404).json({ success: false, error: "Library document not found" });
    }

    res.status(200).json({
      success: true,
      document: doc
    });
  } catch (error) {
    console.error("Error fetching library document for student:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch library document"
    });
  }
};


  const getTestCategories = async (req, res) => {
    try {
      const categories = await Test.distinct("category");
      res.status(200).json(categories);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  
  // ✅ Fetch a single course by ID
  const getCourseById = async (req, res) => {
    try {
      const course = await Course.findById(req.params.id);
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
      
      res.status(200).json(course);
    
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };


  
  // ✅ Fetch a single test by ID
  const getTestById = async (req, res) => {
  
    
    try {
      const test = await Test.findById(req.params.id);
      if (!test) {
        return res.status(404).json({ error: "Test not found" });
      }
      res.status(200).json(test);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };



  const addToCart = async (req, res) => {
    const { itemId, itemType } = req.body;
    const userId = req.user?.id || req.user?._id;
  
    if (!itemId || !itemType || !userId) {
      return res.status(400).json({ message: "Invalid request data." });
    }
  
    try {

      let cart = await Cart.findOne({ userId });
  
      if (!cart) {
        cart = new Cart({ userId, courses: [], tests: [] });
      }
  
      if (itemType === "test") {
        const alreadyExists = cart.tests.some(t => t.testId.toString() === itemId);
        if (!alreadyExists) {
          cart.tests.push({ testId: itemId });
        }
      } else if (itemType === "course") {
        const alreadyExists = cart.courses.some(c => c.courseId.toString() === itemId);
        if (!alreadyExists) {
          cart.courses.push({ courseId: itemId });
        }
      } else {
        return res.status(400).json({ message: "Invalid item type." });
      }
  
      await cart.save();
      res.json({ success: true, cart });
    } catch (err) {
      console.error("Cart Add Error:", err.message);
      res.status(500).json({ message: "Error adding to cart." });
    }
  };



  const checkItemInCart = async (req, res) => {
    const userId = req.user?.id || req.user?._id;
    const { itemId, itemType } = req.query;
  
    if (!itemId || !itemType) {
      return res.status(400).json({ message: "Item ID and type are required." });
    }
  
    try {
      const cart = await Cart.findOne({ userId });
  
      if (!cart) return res.json({ inCart: false });
  
      let inCart = false;
  
      if (itemType === "test") {
        inCart = cart.tests.some(t => t.testId.toString() === itemId);
      } else if (itemType === "course") {
        inCart = cart.courses.some(c => c.courseId.toString() === itemId);
    }

  
      res.json({ inCart });
    } catch (error) {
      console.error("Error checking cart:", error.message);
      res.status(500).json({ message: "Internal server error" });
    }
  };
  

  const removeFromCart = async (req, res) => {
    const { itemId, itemType } = req.body;
    const userId = req.user.id;
  
    try {
      const cart = await Cart.findOne({ userId });
      if (!cart) return res.status(404).json({ message: "Cart not found" });
  
      if (itemType === "test") {
        cart.tests = cart.tests.filter(t => !t.testId.equals(itemId));
      }else if (itemType === "course") {
        cart.courses = cart.courses.filter(c => !c.courseId.equals(itemId));
      }
  
  
      await cart.save();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Error removing from cart" });
    }
  };
  

  const getCartTests = async (req, res) => {
    const userId = req.user.id;
    try {
      const cart = await Cart.findOne({ userId }).populate("tests.testId");
      const tests = cart?.tests?.map(t => t.testId) || [];
      
      res.json({ tests });
    } catch (err) {
      res.status(500).json({ message: "Error fetching cart tests." });
    }
  };

  const getCartCourses = async (req, res) => {
    const userId = req.user.id;
    try {
      const cart = await Cart.findOne({ userId }).populate("courses.courseId");
      const courses = cart?.courses?.map(c => c.courseId) || [];
      
      res.json({ courses });
    } catch (err) {
      res.status(500).json({ message: "Error fetching cart courses." });
    }
  };
  
  // code to fetch all quizzes inside a tset for test player

  const getQuiz = async (req, res) => {
   
    
    try {
      const { ids } = req.body;
      const quizzes = await Quiz.find({ _id: { $in: ids } }).populate({
        path: 'questions',
        select: 'questionText options answer' // include only these fields
      })
      if (!quizzes) {
        return res.status(404).json({ message: 'Quiz not found' });
      }
  
      res.status(200).json(quizzes);
      
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  }


  const submitQuiz = async (req, res) => {
    try {
      const userId = req.user.id; // assuming user is authenticated
      const {
        quizIds,
        answers,
        startTime,
        endTime,
        duration,
        markedQuestions
      } = req.body;
  
      // Basic validation
      if (!quizIds || !answers || !startTime || !endTime) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
  
      // Save submission
      const submission = new SubmissionModel({
        user: userId,
        quizIds,
        answers,
        startTime,
        endTime,
        duration,
        markedQuestions
      });
  
      await submission.save();
      await logStudentActivity({
        userId,
        eventType: "quiz_submit",
        submissionId: submission._id,
        metadata: { quizCount: Array.isArray(quizIds) ? quizIds.length : 0 },
      });
  
      res.status(201).json({
        message: 'Quiz submitted successfully',
        submissionId: submission._id
      });
    } catch (error) {
      console.error('Quiz submission failed:', error);
      res.status(500).json({ message: 'Server error while submitting quiz' });
    }
  };

  // Submit test with detailed results
  const submitTest = async (req, res) => {
    try {
      const userId = req.user?.id || req.user?._id;
      const {
        testId,
        answers,
        questions,
        startTime,
        endTime,
        duration,
        markedQuestions
      } = req.body;

      if (!testId || !answers || !questions) {
        return res.status(400).json({ message: 'Missing required fields: testId, answers, and questions are required' });
      }

      // Find student by userId
      const student = await Student.findOne({ userId });
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }

      // Calculate results
      let correctAnswers = 0;
      let incorrectAnswers = 0;
      let unanswered = 0;
      let totalMarks = 0;
      let obtainedMarks = 0;

      const detailedAnswers = questions.map((question, index) => {
        const questionId = question.id || question._id || index;
        const selectedAnswer = answers[questionId];
        const correctAnswer = question.correctAnswer || question.answer;
        const marks = question.marks || 1;
        
        totalMarks += marks;
        
        let isCorrect = false;
        if (selectedAnswer !== null && selectedAnswer !== undefined) {
          // Compare selected answer with correct answer
          if (typeof selectedAnswer === 'number') {
            // If answer is an index, get the option value
            const selectedOption = question.options && question.options[selectedAnswer] 
              ? question.options[selectedAnswer] 
              : null;
            isCorrect = selectedOption === correctAnswer || String(selectedAnswer) === String(correctAnswer);
          } else {
            isCorrect = String(selectedAnswer) === String(correctAnswer);
          }
          
          if (isCorrect) {
            correctAnswers++;
            obtainedMarks += marks;
          } else {
            incorrectAnswers++;
            // Apply negative marking if needed (typically -0.25 marks per wrong answer)
            obtainedMarks -= marks * 0.25;
          }
        } else {
          unanswered++;
        }

        return {
          questionId: questionId,
          quizId: question.quizId || '',
          questionIndex: index,
          questionText: question.question || question.questionText || '',
          options: question.options || [],
          selectedOption: selectedAnswer !== null && selectedAnswer !== undefined 
            ? (typeof selectedAnswer === 'number' && question.options 
                ? question.options[selectedAnswer] 
                : selectedAnswer)
            : null,
          correctAnswer: correctAnswer,
          isCorrect: isCorrect,
          marks: marks,
          obtainedMarks: isCorrect ? marks : (selectedAnswer !== null && selectedAnswer !== undefined ? -(marks * 0.25) : 0)
        };
      });

      // Calculate percentage score
      const score = totalMarks > 0 ? Math.round((obtainedMarks / totalMarks) * 100) : 0;
      const scorePercentage = Math.max(0, score); // Ensure non-negative

      // Get test to check passing score
      const test = await Test.findById(testId);
      const passingScore = test?.passingScore || 50;
      const status = scorePercentage >= passingScore ? 'passed' : 'failed';

      // Find or create EnrolledTest record
      let enrolledTest = await EnrolledTest.findOne({ 
        studentId: student._id, 
        testId: testId 
      });

      if (!enrolledTest) {
        // Create new EnrolledTest record
        enrolledTest = await EnrolledTest.create({
          studentId: student._id,
          testId: testId,
          paymentStatus: 'completed', // Assume completed if they're taking the test
        });
      }

      // Add attempt to testAttempts array
      enrolledTest.testAttempts.push({
        attemptDate: endTime ? new Date(endTime) : new Date(),
        score: scorePercentage,
        correctAnswers: correctAnswers,
        incorrectAnswers: incorrectAnswers,
        status: status
      });

      // Update isPassed if this attempt passed
      if (status === 'passed' && !enrolledTest.isPassed) {
        enrolledTest.isPassed = true;
      }

      await enrolledTest.save();

      // Save detailed submission
      const submission = new SubmissionModel({
        user: userId,
        testId: testId,
        quizIds: test?.quizzes || [],
        answers: detailedAnswers,
        startTime: startTime ? new Date(startTime) : new Date(),
        endTime: endTime ? new Date(endTime) : new Date(),
        duration: duration || '0',
        markedQuestions: markedQuestions || [],
        totalQuestions: questions.length,
        totalMarks: totalMarks,
        obtainedMarks: Math.max(0, obtainedMarks),
        percentageScore: scorePercentage,
        status: status
      });

      await submission.save();
      await logStudentActivity({
        userId,
        studentId: student._id,
        eventType: "test_submit",
        testId,
        submissionId: submission._id,
        score: scorePercentage,
        metadata: {
          status,
          correctAnswers,
          incorrectAnswers,
          unanswered,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Test submitted successfully',
        submissionId: submission._id,
        results: {
          totalQuestions: questions.length,
          correctAnswers,
          incorrectAnswers,
          unanswered,
          totalMarks,
          obtainedMarks: Math.max(0, obtainedMarks), // Ensure non-negative
          score: scorePercentage,
          status,
          passingScore,
          detailedAnswers,
          attemptDate: new Date()
        }
      });
    } catch (error) {
      console.error('Test submission failed:', error);
      res.status(500).json({ message: 'Server error while submitting test', error: error.message });
    }
  };



  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  
  // 1️⃣ Create Razorpay order
  const createOrder = async (req, res) => {
    const { testId } = req.body;
    const userId = req.user?.id || req.user?._id;
  
    try {
      const test = await Test.findById(testId);
      if (!test) return res.status(404).json({ message: "Test not found" });
  
      // 🛠️ Properly fetch the Student using the userId
      const student = await Student.findOne({ userId });
      if (!student) return res.status(404).json({ message: "Student not found" });
  
      const amount = test.price.discounted;
  
      const order = await razorpay.orders.create({
        amount: amount * 100,
        currency: "INR",
        receipt: `receipt_${Date.now()}`
      });
  
      // 💾 Create payment record
      const payment = await paymentSchema.create({
        userId: userId,
        student: student._id,
        test: testId,
        razorpayOrderId: order.id,
        amount,
      });
  
      res.status(201).json({ order, paymentId: payment._id });
    } catch (err) {
      res.status(500).json({ message: "Error creating order", error: err.message });
    }
  };
  
  
  // 2️⃣ Verify payment
  const verifyPayment = async (req, res) => {
   
  
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentId
    } = req.body;
  
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");
  
    const isAuthentic = generated_signature === razorpay_signature;
  
    if (!isAuthentic) {
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }
  
    try {
      // 1. Update payment status
      const payment = await paymentSchema.findByIdAndUpdate(paymentId, {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: "paid",
      }, { new: true });
  
      const studentId = payment.student;
      const testId = payment.test;
  
      // 2. Enroll student to test
      const student = await Student.findById(studentId);
      if (!student.enrolledTests.includes(testId)) {
        student.enrolledTests.push(testId);
        await student.save();
      }
  
      // ✅ 3. Update the Test model to store student ID
      const test = await Test.findById(testId);
      if (!test.enrolledStudents.includes(req.user.id)) {
        test.enrolledStudents.push(req.user.id);
        await test.save();
      }
  
      // 4. Optionally create EnrolledTest record if you're tracking more data
      await EnrolledTest.create({
        studentId,
        testId,
        paymentStatus: "completed",
      });
      await logStudentActivity({
        userId: req.user?.id || req.user?._id,
        studentId,
        eventType: "test_payment",
        testId,
        metadata: { paymentId: payment?._id, razorpayPaymentId: razorpay_payment_id },
      });
  
      res.json({ success: true, message: "Payment verified and student enrolled", payment });
  
    } catch (err) {
      res.status(500).json({ success: false, message: "Error verifying payment", error: err.message });
    }
  };

  // Enroll in free test (no payment required)
  const enrollFreeTest = async (req, res) => {
    try {
      const { testId } = req.body;
      const userId = req.user?.id || req.user?._id;

      if (!testId) {
        return res.status(400).json({ success: false, message: "Test ID is required" });
      }

      if (!userId) {
        return res.status(401).json({ success: false, message: "User not authenticated" });
      }

      // Check if test exists and is free
      const test = await Test.findById(testId);
      if (!test) {
        return res.status(404).json({ success: false, message: "Test not found" });
      }

      // Verify test is free
      const isTestFree =
        test.isFree === true ||
        (test.price?.actual === 0 && test.price?.discounted === 0) ||
        (!test.price?.actual && !test.price?.discounted);

      if (!isTestFree) {
        return res.status(400).json({
          success: false,
          message: "This test is not free. Please use the payment flow to enroll."
        });
      }

      // Find student using userId (Student model has userId field referencing User)
      const student = await Student.findOne({ userId });
      if (!student) {
        return res.status(404).json({ success: false, message: "Student not found" });
      }

      // Normalize IDs for safe comparison
      const testIdStr = String(testId);
      const userIdStr = String(userId);

      // Check if student is already enrolled in this test
      const alreadyInStudent = (student.enrolledTests || []).some(
        (t) => String(t) === testIdStr
      );

      if (alreadyInStudent) {
        return res.json({
          success: true,
          message: "You are already enrolled in this test",
          alreadyEnrolled: true
        });
      }

      // Enroll student in the test at Student model level (stores Test ObjectIds)
      student.enrolledTests.push(testId);
      await student.save();

      // Test.enrolledStudents stores User IDs (see testModel.js ref: "user")
      const alreadyInTest = (test.enrolledStudents || []).some(
        (u) => String(u) === userIdStr
      );

      if (!alreadyInTest) {
        test.enrolledStudents.push(userId);
        await test.save();
      }

      // Ensure EnrolledTest record exists (avoid duplicates)
      const studentId = student._id;
      const existingEnrolledTest = await EnrolledTest.findOne({
        studentId,
        testId
      });

      if (!existingEnrolledTest) {
        await EnrolledTest.create({
          studentId,
          testId,
          paymentStatus: "free", // Mark as free enrollment
        });
      }
      await logStudentActivity({
        userId,
        studentId,
        eventType: "test_enroll",
        testId,
        metadata: { mode: "free" },
      });

      res.json({
        success: true,
        message: "Successfully enrolled in free test",
        test: {
          _id: test._id,
          title: test.title,
          isFree: test.isFree
        }
      });
    } catch (err) {
      console.error("Error enrolling in free test:", err);
      res.status(500).json({
        success: false,
        message: "Error enrolling in test",
        error: err.message
      });
    }
  };


const getModulesDetails = async (req, res) => {

try {
  const { moduleIds } = req.body;
  // Validate input
  if (!Array.isArray(moduleIds) || moduleIds.length === 0) {
    return res.status(400).json({ message: 'moduleIds must be a non-empty array' });
  }

  // Convert string IDs to ObjectId if needed
  const objectIds = moduleIds.map(id => new mongoose.Types.ObjectId(id));

  const modules = await Module.find({ _id: { $in: objectIds } }).populate({
    path: "lessons",
    select: "title content duration",
  });

  res.json({ modules });
} catch (err) {
  console.error('Error fetching module details:', err);
  res.status(500).json({ message: 'Failed to fetch module details' });
}
}
  


const createCourseOrder = async (req, res) => {
  console.log(req.body);
  
  const { courseId } = req.body;
  const userId = req.user?.id || req.user?._id;

  try {
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "course not found" });

    // 🛠️ Properly fetch the Student using the userId
    const student = await Student.findOne({ userId });
    if (!student) return res.status(404).json({ message: "Student not found" });

    const amount = course.price.discounted;

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `receipt_${Date.now()}`
    });

    // 💾 Create payment record
    const payment = await paymentSchema.create({
      userId: userId,
      student: student._id,
      course: courseId,
      razorpayOrderId: order.id,
      amount,
    });

    res.status(201).json({ order, paymentId: payment._id });
  } catch (err) {
    res.status(500).json({ message: "Error creating order", error: err.message });
  }
};


// 2️⃣ Verify payment
const verifyCoursePayment = async (req, res) => {
 

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    paymentId
  } = req.body;

  const generated_signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  const isAuthentic = generated_signature === razorpay_signature;

  if (!isAuthentic) {
    return res.status(400).json({ success: false, message: "Payment verification failed" });
  }

  try {
    // 1. Update payment status
    const payment = await paymentSchema.findByIdAndUpdate(paymentId, {
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      status: "paid",
    }, { new: true });

    const studentId = payment.student;
    const courseId = payment.course;

    // 2. Enroll student to test
    const student = await Student.findById(studentId);
    if (!student.enrolledCourses.includes(courseId)) {
      student.enrolledCourses.push(courseId);
      await student.save();
    }

    // ✅ 3. Update the Test model to store student ID
    const course = await Course.findById(courseId);
    if (!course.enrolledStudents.includes(req.user.id)) {
      course.enrolledStudents.push(req.user.id);
      await course.save();
    }

    // 4. Optionally create EnrolledTest record if you're tracking more data
    await EnrolledCourse.create({
      studentId,
      courseId,
      paymentStatus: "completed",
    });
    await logStudentActivity({
      userId: req.user?.id || req.user?._id,
      studentId,
      eventType: "course_payment",
      courseId,
      metadata: { paymentId: payment?._id, razorpayPaymentId: razorpay_payment_id },
    });

    res.json({ success: true, message: "Payment verified and student enrolled", payment });

  } catch (err) {
    res.status(500).json({ success: false, message: "Error verifying payment", error: err.message });
  }
};

// Create Razorpay order for a paid library document
const createLibraryOrder = async (req, res) => {
  const { documentId } = req.body;
  const userId = req.user?.id || req.user?._id;

  try {
    if (!documentId) {
      return res.status(400).json({ message: "documentId is required" });
    }

    const document = await LibraryDocument.findById(documentId);
    if (!document || !document.isActive) {
      return res.status(404).json({ message: "Library document not found" });
    }

    // Ensure document is actually paid
    const discounted = document.price?.discounted ?? 0;
    if (!discounted || Number(discounted) === 0) {
      return res.status(400).json({
        message: "This library document is free and does not require payment",
      });
    }

    const student = await Student.findOne({ userId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const amount = Number(discounted);

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `library_${Date.now()}`,
    });

    const payment = await paymentSchema.create({
      userId,
      student: student._id,
      libraryDocument: documentId,
      razorpayOrderId: order.id,
      amount,
    });

    res.status(201).json({ order, paymentId: payment._id });
  } catch (err) {
    console.error("Error creating library order:", err);
    res
      .status(500)
      .json({ message: "Error creating library order", error: err.message });
  }
};

// Verify Razorpay payment for a library document and grant access
const verifyLibraryPayment = async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    paymentId,
  } = req.body;

  const generated_signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  const isAuthentic = generated_signature === razorpay_signature;

  if (!isAuthentic) {
    return res
      .status(400)
      .json({ success: false, message: "Payment verification failed" });
  }

  try {
    const payment = await paymentSchema.findByIdAndUpdate(
      paymentId,
      {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: "paid",
      },
      { new: true }
    );

    if (!payment) {
      return res
        .status(404)
        .json({ success: false, message: "Payment record not found" });
    }

    const studentId = payment.student;
    const documentId = payment.libraryDocument;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: "No library document associated with this payment",
      });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student not found" });
    }

    // Grant access by adding document to student's purchasedLibraryDocuments
    const docIdStr = String(documentId);
    const alreadyPurchased = (student.purchasedLibraryDocuments || []).some(
      (d) => String(d) === docIdStr
    );

    if (!alreadyPurchased) {
      student.purchasedLibraryDocuments.push(documentId);
      await student.save();
    }

    // Optionally increment downloads count
    await LibraryDocument.findByIdAndUpdate(documentId, {
      $inc: { downloads: 1 },
    });

    res.json({
      success: true,
      message: "Payment verified and library document unlocked",
      payment,
    });
  } catch (err) {
    console.error("Error verifying library payment:", err);
    res.status(500).json({
      success: false,
      message: "Error verifying library payment",
      error: err.message,
    });
  }
};




//cart -payment

const createCartOrder = async (req, res) => {
  const userId = req.user?.id || req.user?._id;

  try {
    const student = await Student.findOne({ userId });
    if (!student) return res.status(404).json({ message: "Student not found" });

    const cart = await Cart.findOne({ userId })
      .populate("courses.courseId")
      .populate("tests.testId");

    if (!cart) return res.status(404).json({ message: "Cart is empty" });

    const totalAmount = [
      ...cart.courses.map(item => item.courseId?.price?.discounted || 0),
      ...cart.tests.map(item => item.testId?.price?.discounted || 0),
    ].reduce((sum, price) => sum + price, 0);

    const order = await razorpay.orders.create({
      amount: totalAmount * 100,
      currency: "INR",
      receipt: `cart_${Date.now()}`
    });

    const payment = await Payment.create({
      userId,
      student: student._id,
      amount: totalAmount,
      razorpayOrderId: order.id,
      status: "created"
    });

    res.status(201).json({
      order,
      paymentId: payment._id,
      message: "Order created successfully"
    });
  } catch (error) {
    res.status(500).json({ message: "Order creation failed", error: error.message });
  }
};


const verifyCartPayment = async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    paymentId
  } = req.body;

  const generated_signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  const isAuthentic = generated_signature === razorpay_signature;
  if (!isAuthentic) {
    return res.status(400).json({ success: false, message: "Invalid signature" });
  }

  try {
    const payment = await paymentSchema.findByIdAndUpdate(paymentId, {
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      status: "paid"
    }, { new: true });

    const student = await Student.findById(payment.student);
    const userId = payment.userId;

    const cart = await Cart.findOne({ userId })
      .populate("courses.courseId")
      .populate("tests.testId");

    const enrolledCourseIds = [];
    const enrolledTestIds = [];

    for (const { courseId } of cart.courses) {
      if (courseId && !student.enrolledCourses.includes(courseId._id)) {
        student.enrolledCourses.push(courseId._id);
        enrolledCourseIds.push(courseId._id);
        await EnrolledCourse.create({
          studentId: student._id,
          courseId: courseId._id,
          paymentStatus: "completed"
        });
        courseId.enrolledStudents.push(userId);
        await courseId.save();
      }
    }

    for (const { testId } of cart.tests) {
      if (testId && !student.enrolledTests.includes(testId._id)) {
        student.enrolledTests.push(testId._id);
        enrolledTestIds.push(testId._id);
        await EnrolledTest.create({
          studentId: student._id,
          testId: testId._id,
          paymentStatus: "completed"
        });
        testId.enrolledStudents.push(userId);
        await testId.save();
      }
    }

    await student.save();

    // Clear the cart
    await Cart.findOneAndUpdate({ userId }, { courses: [], tests: [] });
    await logStudentActivity({
      userId,
      studentId: student._id,
      eventType: "course_payment",
      metadata: {
        mode: "cart",
        enrolledCourseIds: enrolledCourseIds.map((x) => String(x)),
        enrolledTestIds: enrolledTestIds.map((x) => String(x)),
      },
    });

    res.json({ success: true, message: "Payment verified and enrolled successfully", enrolledCourseIds, enrolledTestIds });
  } catch (error) {
    res.status(500).json({ success: false, message: "Verification failed", error: error.message });
  }
};



// Get enrolled tests for the authenticated student
const getEnrolledTests = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Find student by userId
    const student = await Student.findOne({ userId }).populate({
      path: 'enrolledTests',
      model: 'Test',
      select: 'title description image duration numberOfQuestions level price company features skills averageRating enrolledStudents'
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Also get EnrolledTest records for attempt history
    const enrolledTestRecords = await EnrolledTest.find({ studentId: student._id })
      .populate('testId', 'title description image duration numberOfQuestions level')
      .sort({ createdAt: -1 });

    // Combine test data with enrollment info and all attempts
    const enrolledTests = await Promise.all(enrolledTestRecords.map(async (record) => {
      const test = record.testId;
      const latestAttempt = record.testAttempts && record.testAttempts.length > 0
        ? record.testAttempts[record.testAttempts.length - 1]
        : null;

      // Find latest submission for this test
      let latestSubmissionId = null;
      if (latestAttempt) {
        const submission = await SubmissionModel.findOne({
          user: userId,
          testId: test?._id,
          endTime: { 
            $gte: new Date(new Date(latestAttempt.attemptDate).getTime() - 5 * 60 * 1000),
            $lte: new Date(new Date(latestAttempt.attemptDate).getTime() + 5 * 60 * 1000)
          }
        }).sort({ createdAt: -1 });
        latestSubmissionId = submission?._id || null;
      }

      // Get all attempts sorted by date (newest first)
      const allAttempts = record.testAttempts && record.testAttempts.length > 0
        ? await Promise.all([...record.testAttempts]
            .sort((a, b) => new Date(b.attemptDate) - new Date(a.attemptDate))
            .map(async (attempt, index) => {
              // Find matching submission for each attempt
              const submission = await SubmissionModel.findOne({
                user: userId,
                testId: test?._id,
                endTime: { 
                  $gte: new Date(new Date(attempt.attemptDate).getTime() - 5 * 60 * 1000),
                  $lte: new Date(new Date(attempt.attemptDate).getTime() + 5 * 60 * 1000)
                }
              }).sort({ createdAt: -1 });

              return {
                attemptNumber: record.testAttempts.length - index,
                attemptDate: attempt.attemptDate,
                score: attempt.score,
                correctAnswers: attempt.correctAnswers,
                incorrectAnswers: attempt.incorrectAnswers,
                status: attempt.status,
                submissionId: submission?._id || null
              };
            }))
        : [];

      return {
        _id: test?._id,
        id: test?._id,
        title: test?.title || '',
        description: test?.description || '',
        image: test?.image || '',
        duration: test?.duration || 0,
        numberOfQuestions: test?.numberOfQuestions || 0,
        level: test?.level || 'Beginner',
        company: test?.company || '',
        enrolledDate: record.createdAt,
        paymentStatus: record.paymentStatus,
        isPassed: record.isPassed,
        latestScore: latestAttempt?.score || null,
        latestStatus: latestAttempt?.status || null,
        latestAttemptDate: latestAttempt?.attemptDate || null,
        latestSubmissionId: latestSubmissionId, // Add latest submission ID
        totalAttempts: record.testAttempts?.length || 0,
        attempts: allAttempts, // Include all attempts
        certificateUrl: record.certificateUrl || null
      };
    }));

    res.status(200).json({ success: true, tests: enrolledTests });
  } catch (error) {
    console.error('Error fetching enrolled tests:', error);
    res.status(500).json({ message: "Error fetching enrolled tests", error: error.message });
  }
};

// Get test submission history for a specific test
const getTestSubmissionHistory = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { testId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    if (!testId) {
      return res.status(400).json({ message: "Test ID is required" });
    }

    // Find student by userId
    const student = await Student.findOne({ userId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Get EnrolledTest record with all attempts
    const enrolledTest = await EnrolledTest.findOne({ 
      studentId: student._id, 
      testId: testId 
    }).populate('testId', 'title description image duration numberOfQuestions level passingScore');

    if (!enrolledTest) {
      return res.status(404).json({ message: "Test enrollment not found" });
    }

    // Get all submissions for this test
    const submissions = await SubmissionModel.find({
      user: userId,
      testId: testId
    })
      .sort({ createdAt: -1 })
      .limit(10); // Get last 10 submissions

    // Format attempts with submission details
    const attempts = enrolledTest.testAttempts
      .map((attempt, index) => {
        // Try to find matching submission
        const matchingSubmission = submissions.find(sub => {
          const subDate = new Date(sub.endTime || sub.createdAt);
          const attemptDate = new Date(attempt.attemptDate);
          // Match if dates are within 5 minutes of each other
          return Math.abs(subDate - attemptDate) < 5 * 60 * 1000;
        });

        return {
          attemptNumber: enrolledTest.testAttempts.length - index,
          attemptDate: attempt.attemptDate,
          score: attempt.score,
          correctAnswers: attempt.correctAnswers,
          incorrectAnswers: attempt.incorrectAnswers,
          status: attempt.status,
          submissionId: matchingSubmission?._id || null,
          hasDetails: !!matchingSubmission
        };
      })
      .sort((a, b) => new Date(b.attemptDate) - new Date(a.attemptDate));

    res.status(200).json({
      success: true,
      test: enrolledTest.testId,
      enrolledTest: {
        enrolledDate: enrolledTest.createdAt,
        paymentStatus: enrolledTest.paymentStatus,
        isPassed: enrolledTest.isPassed,
        certificateUrl: enrolledTest.certificateUrl,
        totalAttempts: enrolledTest.testAttempts.length
      },
      attempts: attempts
    });
  } catch (error) {
    console.error('Error fetching test submission history:', error);
    res.status(500).json({ message: "Error fetching test submission history", error: error.message });
  }
};

// Get detailed submission results
const getTestSubmissionDetails = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { submissionId } = req.params;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    if (!submissionId) {
      return res.status(400).json({ message: "Submission ID is required" });
    }

    // Get submission
    const submission = await SubmissionModel.findById(submissionId);

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    // Verify it belongs to the user
    if (submission.user.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized access to submission" });
    }

    res.status(200).json({
      success: true,
      submission: {
        _id: submission._id,
        testId: submission.testId,
        startTime: submission.startTime,
        endTime: submission.endTime,
        duration: submission.duration,
        markedQuestions: submission.markedQuestions || [],
        totalQuestions: submission.totalQuestions,
        totalMarks: submission.totalMarks,
        obtainedMarks: submission.obtainedMarks,
        percentageScore: submission.percentageScore,
        status: submission.status,
        answers: submission.answers || [],
        createdAt: submission.createdAt
      }
    });
  } catch (error) {
    console.error('Error fetching submission details:', error);
    res.status(500).json({ message: "Error fetching submission details", error: error.message });
  }
};

// Get dashboard overview data for student
const getDashboardOverview = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    
    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    // Find student by userId
    const student = await Student.findOne({ userId });
    
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Get enrolled courses
    const enrolledCourseRecords = await EnrolledCourse.find({ studentId: student._id })
      .populate('courseId', 'title level category')
      .sort({ createdAt: -1 });

    const totalCourses = enrolledCourseRecords.length;
    const completedCourses = enrolledCourseRecords.filter(c => c.isCompleted).length;
    const coursesInProgress = totalCourses - completedCourses;

    // Get enrolled tests with attempts
    const enrolledTestRecords = await EnrolledTest.find({ studentId: student._id })
      .populate('testId', 'title level company')
      .sort({ createdAt: -1 });

    const totalTests = enrolledTestRecords.length;
    const testsWithAttempts = enrolledTestRecords.filter(t => t.testAttempts && t.testAttempts.length > 0);
    const completedTests = testsWithAttempts.length;
    
    // Calculate average test score
    let totalScore = 0;
    let scoreCount = 0;
    const recentTestScores = [];
    
    // Process records with async operations
    for (const record of enrolledTestRecords) {
      if (record.testAttempts && record.testAttempts.length > 0) {
        const latestAttempt = record.testAttempts[record.testAttempts.length - 1];
        if (latestAttempt.score !== null && latestAttempt.score !== undefined) {
          totalScore += latestAttempt.score;
          scoreCount++;
          
          // Collect recent test scores (last 5) with submission ID
          if (recentTestScores.length < 5) {
            // Find matching submission for this attempt
            const submission = await SubmissionModel.findOne({
              user: userId,
              testId: record.testId?._id,
              endTime: { 
                $gte: new Date(new Date(latestAttempt.attemptDate).getTime() - 5 * 60 * 1000),
                $lte: new Date(new Date(latestAttempt.attemptDate).getTime() + 5 * 60 * 1000)
              }
            }).sort({ createdAt: -1 });

            recentTestScores.push({
              testId: record.testId?._id,
              title: record.testId?.title || 'Test',
              subjects: record.testId?.company || record.testId?.level || 'General',
              score: latestAttempt.score,
              scoreColor: latestAttempt.score >= 80 ? 'text-green-600' : latestAttempt.score >= 60 ? 'text-blue-600' : 'text-orange-600',
              attemptDate: latestAttempt.attemptDate,
              status: latestAttempt.status,
              submissionId: submission?._id || null
            });
          }
        }
      }
    }

    const avgTestScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;
    const previousAvgScore = avgTestScore > 0 ? Math.max(0, avgTestScore - 5) : 0; // Mock previous score
    const scoreTrend = avgTestScore > previousAvgScore ? '+' + (avgTestScore - previousAvgScore) + '%' : '0%';

    // Get job applications count (placeholder - adjust based on your job application model)
    const jobApplicationsCount = 0; // TODO: Implement when job application model is available
    const appliedJobsCount = 0;

    // Calculate concept clarity based on test performance by subject/level
    const conceptClarityMap = new Map();
    enrolledTestRecords.forEach(record => {
      if (record.testAttempts && record.testAttempts.length > 0) {
        const latestAttempt = record.testAttempts[record.testAttempts.length - 1];
        const subject = record.testId?.level || 'General';
        const score = latestAttempt.score || 0;
        
        if (!conceptClarityMap.has(subject)) {
          conceptClarityMap.set(subject, { total: 0, count: 0 });
        }
        const data = conceptClarityMap.get(subject);
        data.total += score;
        data.count += 1;
      }
    });

    // Build concept clarity from map
    const conceptClarity = Array.from(conceptClarityMap.entries())
      .map(([subject, data]) => {
        const progress = Math.round(data.total / data.count);
        let level, levelColor, progressColor;
        if (progress >= 80) {
          level = 'Strong';
          levelColor = 'text-green-600';
          progressColor = 'bg-green-500';
        } else if (progress >= 60) {
          level = 'Good';
          levelColor = 'text-blue-600';
          progressColor = 'bg-blue-500';
        } else {
          level = 'Improving';
          levelColor = 'text-orange-600';
          progressColor = 'bg-orange-500';
        }
        return {
          subject: subject,
          progress,
          level,
          levelColor,
          progressColor
        };
      })
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 4); // Limit to 4 items

    // Learning journey based on course levels
    const foundationCourses = enrolledCourseRecords.filter(c => c.courseId?.level === 'Beginner').length;
    const intermediateCourses = enrolledCourseRecords.filter(c => c.courseId?.level === 'Intermediate').length;
    const advancedCourses = enrolledCourseRecords.filter(c => c.courseId?.level === 'Advanced').length;
    
    const foundationCompleted = enrolledCourseRecords.filter(c => c.courseId?.level === 'Beginner' && c.isCompleted).length;
    const foundationProgress = foundationCourses > 0 ? Math.round((foundationCompleted / foundationCourses) * 100) : 0;
    
    const intermediateCompleted = enrolledCourseRecords.filter(c => c.courseId?.level === 'Intermediate' && c.isCompleted).length;
    const intermediateProgress = intermediateCourses > 0 ? Math.round((intermediateCompleted / intermediateCourses) * 100) : 0;

    const progressByCourse = new Map();
    for (const row of student.courseLearningProgress || []) {
      if (row?.courseId) {
        progressByCourse.set(String(row.courseId), row);
      }
    }

    const coursesWithProgress = enrolledCourseRecords
      .filter((c) => c.paymentStatus === "completed" && c.courseId)
      .map((c) => {
        const cid = String(c.courseId._id || c.courseId);
        const row = progressByCourse.get(cid);
        const pct =
          row != null
            ? Math.min(100, Math.max(0, Number(row.percentComplete) || 0))
            : c.isCompleted
              ? 100
              : 0;
        return {
          courseId: cid,
          title: c.courseId?.title || "Course",
          category: c.courseId?.category || "",
          level: c.courseId?.level || "",
          percentComplete: pct,
          completedLessonsCount: row?.completedLessonsCount ?? 0,
          totalLessons: row?.totalLessons ?? 0,
          isCompleted: Boolean(c.isCompleted || row?.isCompleted),
          lastAccessedAt: row?.lastAccessedAt || c.updatedAt || c.createdAt,
        };
      })
      .sort((a, b) => {
        const ta = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : 0;
        const tb = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 12);

    // Actionable items
    const actionableItems = [
      {
        title: "Continue Learning",
        count: `${coursesInProgress} course${coursesInProgress !== 1 ? 's' : ''} in progress`,
        icon: "BookOpenIcon"
      },
      {
        title: "Resume Tests",
        count: `${totalTests - completedTests} test${totalTests - completedTests !== 1 ? 's' : ''} pending`,
        icon: "FileTextIcon"
      },
      {
        title: "Complete Applications",
        count: `${jobApplicationsCount} draft${jobApplicationsCount !== 1 ? 's' : ''} to finish`,
        icon: "BriefcaseIcon"
      }
    ];

    res.status(200).json({
      success: true,
      data: {
        summaryCards: {
          totalCourses: {
            value: totalCourses,
            subtitle: `${completedCourses} completed`
          },
          testsTaken: {
            value: totalTests,
            subtitle: `${completedTests} completed`
          },
          jobApplications: {
            value: jobApplicationsCount,
            subtitle: `${appliedJobsCount} applied`
          },
          avgTestScore: {
            value: `${avgTestScore}%`,
            subtitle: scoreTrend,
            trend: avgTestScore > previousAvgScore ? 'up' : 'neutral'
          }
        },
        conceptClarity,
        recentTestScores: recentTestScores.sort((a, b) => new Date(b.attemptDate) - new Date(a.attemptDate)),
        coursesWithProgress,
        learningJourney: [
          {
            stage: "Foundation",
            courses: `${foundationCourses} course${foundationCourses !== 1 ? 's' : ''}`,
            progress: foundationProgress,
            completed: foundationProgress === 100
          },
          {
            stage: "Intermediate",
            courses: `${intermediateCourses} course${intermediateCourses !== 1 ? 's' : ''}`,
            progress: intermediateProgress,
            completed: intermediateProgress === 100
          },
          {
            stage: "Advanced",
            courses: `${advancedCourses} course${advancedCourses !== 1 ? 's' : ''}`,
            progress: 0,
            completed: false
          },
          {
            stage: "Specialization",
            courses: "0 courses",
            progress: 0,
            completed: false
          }
        ],
        actionableItems
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({ message: "Error fetching dashboard overview", error: error.message });
  }
};

const getLatestCoursesAndTests = async (req, res) => {
  try {
    const latestCourses = await Course.find()
      .sort({ createdAt: -1 })
      .limit(3);

    const latestTests = await Test.find()
      .sort({ createdAt: -1 })
      .limit(3);

    res.status(200).json({
      success: true,
      courses: latestCourses,
      tests: latestTests,
    });
  } catch (error) {
    console.error('Error fetching latest courses and tests:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Could not fetch data.',
    });
  }
};

// Get all library documents purchased by the authenticated student
const getPurchasedLibraryDocuments = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const student = await Student.findOne({ userId }).populate(
      "purchasedLibraryDocuments"
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const documents = student.purchasedLibraryDocuments || [];

    res.status(200).json({
      success: true,
      documents,
    });
  } catch (error) {
    console.error("Error fetching purchased library documents:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching purchased library documents",
      error: error.message,
    });
  }
};

// Generate AI explanation for a question
const generateQuestionExplanation = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { questionText, options, correctAnswer, selectedAnswer, subject } = req.body;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
    }

    if (!questionText || !correctAnswer) {
      return res.status(400).json({ 
        success: false,
        message: "Question text and correct answer are required" 
      });
    }

    if (!anthropic) {
      console.error('❌ Anthropic client not initialized. Check ANTHROPIC_API_KEY environment variable.');
      return res.status(500).json({ 
        success: false,
        message: "AI service is not available. Please contact support." 
      });
    }

    // Build prompt for explanation
    const optionsText = options && options.length > 0 
      ? options.map((opt, idx) => `${String.fromCharCode(65 + idx)}. ${opt}`).join('\n')
      : 'No options provided';
    
    const userAnswerText = selectedAnswer !== null && selectedAnswer !== undefined 
      ? `The student selected: ${selectedAnswer}`
      : 'The student did not answer this question.';
    
    const prompt = `You are an expert educational tutor. Explain the following test question and provide a detailed explanation of why the correct answer is correct.

Question: ${questionText}

Options:
${optionsText}

Correct Answer: ${correctAnswer}
${userAnswerText}

${subject ? `Subject/Topic: ${subject}` : ''}

Please provide:
1. A clear explanation of why the correct answer (${correctAnswer}) is correct
2. Brief explanations of why other options are incorrect (if applicable)
3. Key concepts or formulas related to this question
4. Any additional context that would help the student understand the topic better

IMPORTANT: 
- Use LaTeX format for mathematical formulas: $formula$ for inline and $$formula$$ for block
- Keep the explanation clear, concise, and educational
- Focus on helping the student understand the concept, not just memorize the answer
- If the question involves formulas or equations, show the working steps

Provide your explanation:`;

    console.log('🤖 Generating question explanation...');
    
    // Use model fallback mechanism similar to aiChat
    const modelNames = [
      DEFAULT_CLAUDE_MODEL,
      "claude-3-sonnet-20240229",
      "claude-3-opus-20240229",
      "claude-3-haiku-20240307"
    ];

    let message = null;
    let lastError = null;

    for (const modelName of modelNames) {
      try {
        message = await anthropic.messages.create({
          model: modelName,
          max_tokens: 1024,
          temperature: 0.7,
          messages: [{
            role: "user",
            content: prompt
          }]
        });
        console.log(`✅ Successfully used model: ${modelName}`);
        break;
      } catch (modelError) {
        lastError = modelError;
        console.warn(`⚠️ Model ${modelName} failed:`, modelError.message);
      }
    }

    if (!message) {
      throw new Error(`All Claude models failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    const rawExplanation = message.content[0].text;
    const explanationHtml = formatAiExplanationToHtml(rawExplanation);
    console.log('✅ Generated explanation successfully');

    return res.json({
      success: true,
      explanationHtml: explanationHtml
    });

  } catch (error) {
    console.error('❌ Error generating question explanation:', error);
    const errorMessage = error.message || 'Failed to generate explanation';
    return res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// AI Chat endpoint - Provides personalized AI assistance based on user performance
const aiChat = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { message, conversationHistory = [] } = req.body;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ 
        success: false,
        message: "Message is required" 
      });
    }

    if (!anthropic) {
      console.error('❌ Anthropic client not initialized. Check ANTHROPIC_API_KEY environment variable.');
      return res.status(500).json({ 
        success: false,
        message: "AI service is not available. Please contact support." 
      });
    }

    // Fetch user performance data for context
    let performanceContext = '';
    let performanceData = null;
    try {
      const student = await Student.findOne({ userId });
      if (student) {
        // Get enrolled tests with attempts
        const enrolledTestRecords = await EnrolledTest.find({ studentId: student._id })
          .populate('testId', 'title level company category')
          .sort({ createdAt: -1 })
          .limit(10);

        // Get enrolled courses
        const enrolledCourseRecords = await EnrolledCourse.find({ studentId: student._id })
          .populate('courseId', 'title level category')
          .sort({ createdAt: -1 })
          .limit(10);

        // Calculate performance metrics
        let totalScore = 0;
        let scoreCount = 0;
        const testScores = [];
        const weakAreas = [];
        const strongAreas = [];

        for (const record of enrolledTestRecords) {
          if (record.testAttempts && record.testAttempts.length > 0) {
            const latestAttempt = record.testAttempts[record.testAttempts.length - 1];
            if (latestAttempt.score !== null && latestAttempt.score !== undefined) {
              totalScore += latestAttempt.score;
              scoreCount++;
              testScores.push({
                test: record.testId?.title || 'Test',
                subject: record.testId?.company || record.testId?.category || 'General',
                score: latestAttempt.score,
                date: latestAttempt.attemptDate
              });

              // Categorize performance
              if (latestAttempt.score >= 80) {
                strongAreas.push(record.testId?.company || record.testId?.category || 'General');
              } else if (latestAttempt.score < 60) {
                weakAreas.push(record.testId?.company || record.testId?.category || 'General');
              }
            }
          }
        }

        const avgScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;
        const completedCourses = enrolledCourseRecords.filter(c => c.isCompleted).length;
        const coursesInProgress = enrolledCourseRecords.length - completedCourses;

        // Store performance data for response
        performanceData = {
          avgScore,
          scoreCount,
          completedCourses,
          coursesInProgress,
          testScores: testScores.slice(0, 5),
          strongAreas: [...new Set(strongAreas)],
          weakAreas: [...new Set(weakAreas)],
          enrolledTests: enrolledTestRecords.map(t => t.testId?.title).filter(Boolean),
          enrolledCourses: enrolledCourseRecords.map(c => c.courseId?.title).filter(Boolean)
        };

        // Build performance context
        performanceContext = `
STUDENT PERFORMANCE SUMMARY:
- Average Test Score: ${avgScore}%
- Total Tests Attempted: ${scoreCount}
- Courses Completed: ${completedCourses}
- Courses In Progress: ${coursesInProgress}
${testScores.length > 0 ? `- Recent Test Scores:\n${testScores.slice(0, 5).map(t => `  * ${t.test} (${t.subject}): ${t.score}%`).join('\n')}` : ''}
${strongAreas.length > 0 ? `- Strong Areas: ${[...new Set(strongAreas)].join(', ')}` : ''}
${weakAreas.length > 0 ? `- Areas Needing Improvement: ${[...new Set(weakAreas)].join(', ')}` : ''}
${enrolledTestRecords.length > 0 ? `- Enrolled Tests: ${enrolledTestRecords.map(t => t.testId?.title).filter(Boolean).join(', ')}` : ''}
${enrolledCourseRecords.length > 0 ? `- Enrolled Courses: ${enrolledCourseRecords.map(c => c.courseId?.title).filter(Boolean).join(', ')}` : ''}
`;
      }
    } catch (perfError) {
      console.error('Error fetching performance data:', perfError);
      // Continue without performance context
    }

    // Build system prompt with performance context
    const systemPrompt = `You are an AI learning assistant for an educational platform. Your role is to help students improve their performance by providing personalized guidance, study suggestions, and answering questions about their learning journey.

${performanceContext ? `Here is the student's current performance data:\n${performanceContext}\n` : 'No performance data available yet. The student is new to the platform.'}

Guidelines:
1. Provide helpful, encouraging, and constructive feedback
2. Analyze their performance data and give specific, actionable suggestions
3. Recommend tests, courses, or study strategies based on their weak and strong areas
4. Be conversational and friendly, but professional
5. If asked about performance, reference the data provided above
6. Suggest specific improvements and next steps
7. Keep responses concise but informative (2-3 paragraphs max)
8. If you don't have enough information, ask clarifying questions
9. Use bullet points or numbered lists when giving multiple suggestions
10. Be specific about which tests or courses to focus on based on their data
11. IMPORTANT: When explaining mathematical or scientific concepts, ALWAYS use LaTeX formulas:
    - For inline formulas: Use $formula$ (e.g., $E = mc^2$, $x^2 + y^2 = z^2$)
    - For block/display formulas: Use $$formula$$ (e.g., $$\\int_0^1 x dx = \\frac{1}{2}$$)
    - Use proper LaTeX syntax for fractions, integrals, summations, etc.
    - Examples: $\\frac{a}{b}$, $\\sqrt{x}$, $\\sum_{i=1}^{n}$, $\\int_a^b f(x)dx$
12. When students ask questions with formulas, acknowledge them and provide detailed explanations with proper mathematical notation
13. For chemistry: Use formulas like $H_2O$, $CO_2$, $\\ce{H2SO4}$ when appropriate

Answer the student's question now:`;

    // Build conversation history for context
    const messages = [];
    
    // Add system message
    messages.push({
      role: "user",
      content: systemPrompt
    });

    // Add conversation history (last 5 messages for context)
    const recentHistory = conversationHistory.slice(-5);
    recentHistory.forEach(msg => {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }
    });

    // Add current message
    messages.push({
      role: "user",
      content: message
    });

    // Call Claude API
    const modelNames = [
      DEFAULT_CLAUDE_MODEL,
      "claude-3-sonnet-20240229",
      "claude-3-opus-20240229",
      "claude-3-haiku-20240307"
    ];

    let response = null;
    let lastError = null;

    for (const modelName of modelNames) {
      try {
        response = await anthropic.messages.create({
          model: modelName,
          max_tokens: 1024,
          temperature: 0.7,
          messages: messages
        });
        break;
      } catch (modelError) {
        lastError = modelError;
        console.warn(`Model ${modelName} failed:`, modelError.message);
      }
    }

    if (!response) {
      throw new Error(`All Claude models failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    const aiResponse = response.content[0].text;

    res.status(200).json({
      success: true,
      response: aiResponse,
      performanceData: performanceData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in AI chat:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      userId: req.user?.id || req.user?._id
    });
    
    // Provide more specific error messages
    let errorMessage = "Failed to get AI response. Please try again.";
    
    if (error.message?.includes('API key')) {
      errorMessage = "AI service configuration error. Please contact support.";
    } else if (error.message?.includes('rate limit')) {
      errorMessage = "AI service is busy. Please try again in a moment.";
    } else if (error.message?.includes('timeout')) {
      errorMessage = "Request timed out. Please try again.";
    }
    
    res.status(500).json({ 
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};




// AI Career Recommendations endpoint - Generates personalized career path recommendations
const getAICareerRecommendations = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
    }

    if (!anthropic) {
      console.error('❌ Anthropic client not initialized. Check ANTHROPIC_API_KEY environment variable.');
      return res.status(500).json({ 
        success: false,
        message: "AI service is not available. Please contact support." 
      });
    }

    // Fetch user data
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    // Fetch student performance data
    const student = await Student.findOne({ userId });
    let performanceContext = '';
    let userProfile = '';

    if (student) {
      // Get enrolled tests with attempts
      const enrolledTestRecords = await EnrolledTest.find({ studentId: student._id })
        .populate('testId', 'title level company category')
        .sort({ createdAt: -1 })
        .limit(10);

      // Get enrolled courses
      const enrolledCourseRecords = await EnrolledCourse.find({ studentId: student._id })
        .populate('courseId', 'title level category')
        .sort({ createdAt: -1 })
        .limit(10);

      // Calculate performance metrics
      let totalScore = 0;
      let scoreCount = 0;
      const testScores = [];
      const strongAreas = [];
      const weakAreas = [];

      for (const record of enrolledTestRecords) {
        if (record.testAttempts && record.testAttempts.length > 0) {
          const latestAttempt = record.testAttempts[record.testAttempts.length - 1];
          if (latestAttempt.score !== null && latestAttempt.score !== undefined) {
            totalScore += latestAttempt.score;
            scoreCount++;
            testScores.push({
              test: record.testId?.title || 'Test',
              subject: record.testId?.company || record.testId?.category || 'General',
              score: latestAttempt.score
            });

            if (latestAttempt.score >= 80) {
              strongAreas.push(record.testId?.company || record.testId?.category || 'General');
            } else if (latestAttempt.score < 60) {
              weakAreas.push(record.testId?.company || record.testId?.category || 'General');
            }
          }
        }
      }

      const avgScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;
      const completedCourses = enrolledCourseRecords.filter(c => c.isCompleted).length;

      performanceContext = `
STUDENT PERFORMANCE:
- Average Test Score: ${avgScore}%
- Tests Attempted: ${scoreCount}
- Courses Completed: ${completedCourses}
- Strong Areas: ${[...new Set(strongAreas)].join(', ') || 'None identified yet'}
- Areas for Improvement: ${[...new Set(weakAreas)].join(', ') || 'None identified yet'}
- Recent Test Scores: ${testScores.slice(0, 5).map(t => `${t.test}: ${t.score}%`).join(', ') || 'No tests taken yet'}
- Enrolled Courses: ${enrolledCourseRecords.map(c => c.courseId?.title).filter(Boolean).join(', ') || 'None'}
- Enrolled Tests: ${enrolledTestRecords.map(t => t.testId?.title).filter(Boolean).join(', ') || 'None'}
      `;
    }

    // Build user profile context
    userProfile = `
USER PROFILE:
- Learning Goal: ${user.learningGoal || 'Not specified'}
- Exam Preference: ${user.examPreference || 'Not specified'}
- Preferred Sections: ${user.preferredSections?.join(', ') || 'Not specified'}
- Study Preference: ${user.studyPreference || 'Not specified'}
- Role: ${user.role || 'Student'}
    `;

    // Create AI prompt for career recommendations
    const prompt = `You are an expert career counselor and educational advisor. Based on the following student information, generate 3 personalized career path recommendations.

${userProfile}

${performanceContext}

Generate exactly 3 career recommendations in the following JSON format (return ONLY valid JSON, no markdown):
[
  {
    "title": "Career path name (e.g., 'Software Engineering', 'Data Science', 'Product Management')",
    "match": 85,
    "description": "Brief 1-2 sentence explanation of why this career matches the student's profile and performance",
    "tags": ["Skill1", "Skill2", "Skill3"]
  }
]

Requirements:
1. Match percentage should be between 70-95 based on how well the career aligns with their performance, goals, and preferences
2. Descriptions should be specific and reference their actual performance data when available
3. Tags should be relevant skills/technologies for that career path
4. Recommendations should be diverse (different career paths)
5. Consider their learning goal (${user.learningGoal || 'general'}) and exam preferences
6. If performance data is limited, base recommendations on their stated preferences

Return ONLY the JSON array, no other text.`;

    console.log('🤖 Generating AI career recommendations...');
    
    // Try different model names in order of preference
    const modelNames = [
      DEFAULT_CLAUDE_MODEL,
      "claude-3-sonnet-20240229",
      "claude-3-opus-20240229",
      "claude-3-haiku-20240307"
    ];
    
    let recommendations = null;
    let lastError = null;
    
    // Try each model until one works
    for (const modelName of modelNames) {
      try {
        const response = await anthropic.messages.create({
          model: modelName,
          max_tokens: 2000,
          messages: [{
            role: "user",
            content: prompt
          }]
        });

        const content = response.content[0].text;
        
        // Extract JSON from response (handle markdown code blocks if present)
        let jsonStr = content.trim();
        if (jsonStr.startsWith('```json')) {
          jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        } else if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/```\n?/g, '').trim();
        }

        recommendations = JSON.parse(jsonStr);
        
        // Validate recommendations structure
        if (!Array.isArray(recommendations) || recommendations.length === 0) {
          throw new Error('Invalid recommendations format');
        }

        // Ensure each recommendation has required fields
        recommendations = recommendations.map(rec => ({
          title: rec.title || 'Career Path',
          match: Math.min(95, Math.max(70, rec.match || 75)),
          description: rec.description || 'A promising career path based on your profile.',
          tags: Array.isArray(rec.tags) ? rec.tags.slice(0, 3) : ['Skills', 'Development', 'Growth'],
          color: "text-blue-600"
        }));

        console.log('✅ AI career recommendations generated successfully');
        break;
      } catch (error) {
        console.error(`❌ Error with model ${modelName}:`, error.message);
        lastError = error;
        continue;
      }
    }

    if (!recommendations) {
      throw new Error(`All Claude models failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    res.status(200).json({
      success: true,
      recommendations: recommendations
    });

  } catch (error) {
    console.error('❌ Error generating AI career recommendations:', error);
    const errorMessage = error.message || 'Failed to generate career recommendations';
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};








  
const normalizeCourseAiLessonKey = (moduleTitle, lessonTitle) => {
  const m = String(moduleTitle || "").trim().toLowerCase().replace(/\s+/g, " ");
  const l = String(lessonTitle || "").trim().toLowerCase().replace(/\s+/g, " ");
  return `${m}::${l}`.slice(0, 512);
};

const findStudentAiCourseEntry = (student, courseId, mode, lessonKey) => {
  const cid = String(courseId);
  const lk = lessonKey || "";
  return (student.courseAiGeneratedContent || []).find(
    (e) => String(e.courseId) === cid && e.mode === mode && String(e.lessonKey || "") === lk
  );
};

const upsertStudentAiCourseEntry = async (studentId, fields) => {
  const student = await Student.findById(studentId);
  if (!student) {
    throw new Error("Student not found");
  }
  if (!student.courseAiGeneratedContent) {
    student.courseAiGeneratedContent = [];
  }
  const cid = String(fields.courseId);
  const lk = fields.lessonKey || "";
  const arr = student.courseAiGeneratedContent;
  const ix = arr.findIndex(
    (e) => String(e.courseId) === cid && e.mode === fields.mode && String(e.lessonKey || "") === lk
  );
  const doc = {
    courseId: fields.courseId,
    mode: fields.mode,
    lessonKey: lk,
    moduleTitle: fields.moduleTitle || "",
    lessonTitle: fields.lessonTitle || "",
    contentMarkdown: fields.contentMarkdown || "",
    contentHtml: fields.contentHtml || "",
    updatedAt: new Date(),
  };
  if (ix >= 0) {
    arr[ix] = doc;
  } else {
    arr.push(doc);
  }
  student.markModified("courseAiGeneratedContent");
  await student.save();
};

const coursePriceIsFree = (price) =>
  Number(price?.discounted) === 0 || Number(price?.actual) === 0;

/** Returns { allowed, isFreeCourse? } — isFreeCourse set when not allowed (for error codes). */
const getCourseEnrollmentGate = async (studentMongoId, courseLean) => {
  const enrollment = await EnrolledCourse.findOne({
    studentId: studentMongoId,
    courseId: courseLean._id,
    paymentStatus: "completed",
  });
  if (enrollment) {
    return { allowed: true };
  }
  return { allowed: false, isFreeCourse: coursePriceIsFree(courseLean.price) };
};

const sendCourseEnrollmentRequired = (res, isFreeCourse) =>
  res.status(403).json({
    success: false,
    code: isFreeCourse ? "FREE_ENROLL_REQUIRED" : "PURCHASE_REQUIRED",
    message: isFreeCourse
      ? "Enroll in this free course to access lessons, AI content, and progress."
      : "Purchase this course to access lessons, AI content, and progress.",
  });

/**
 * AI-generated course content for the selected course (overview or a specific lesson).
 * Persists on the Student document (courseAiGeneratedContent) for this user only.
 * Pass regenerate: true to force a new LLM call and overwrite stored content.
 */
const generateCourseContent = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }
    if (req.user?.role !== "student") {
      return res.status(403).json({ success: false, message: "Only students can use this endpoint" });
    }

    const {
      courseId,
      mode = "lesson",
      moduleTitle,
      lessonTitle,
      regenerate,
      lessonSourceContent,
    } = req.body || {};
    const forceRegenerate = regenerate === true || regenerate === "true" || regenerate === 1;
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ success: false, message: "Valid courseId is required" });
    }

    if (!["overview", "lesson"].includes(mode)) {
      return res.status(400).json({ success: false, message: 'mode must be "overview" or "lesson"' });
    }

    if (!anthropic) {
      return res.status(500).json({
        success: false,
        message: "AI service is not available. Please contact support.",
      });
    }

    const courseForAccess = await Course.findById(courseId).select("price").lean();
    if (!courseForAccess) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    const student = await Student.findOne({ userId });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const gate = await getCourseEnrollmentGate(student._id, courseForAccess);
    if (!gate.allowed) {
      return sendCourseEnrollmentRequired(res, gate.isFreeCourse);
    }

    let lessonKey = "";
    if (mode === "lesson") {
      if (!lessonTitle || !String(lessonTitle).trim()) {
        return res.status(400).json({
          success: false,
          message: 'lessonTitle is required when mode is "lesson"',
        });
      }
      lessonKey = normalizeCourseAiLessonKey(moduleTitle, lessonTitle);
    }

    if (!forceRegenerate) {
      const cached = findStudentAiCourseEntry(student, courseForAccess._id, mode, lessonKey);
      if (cached?.contentHtml) {
        return res.json({
          success: true,
          fromCache: true,
          mode,
          courseId: String(courseForAccess._id),
          contentHtml: cached.contentHtml,
          contentMarkdown: cached.contentMarkdown || "",
        });
      }
    }

    const course = await Course.findById(courseId).populate({
      path: "modules",
      populate: { path: "lessons" },
    });

    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    const moduleLines = [];
    for (const mod of course.modules || []) {
      const titles = (mod.lessons || []).map((l) => l.title).filter(Boolean);
      moduleLines.push(
        `- Module: ${mod.title || "Untitled"}\n  Lessons: ${titles.length ? titles.join("; ") : "(none listed)"}`
      );
    }
    const curriculumOutline = moduleLines.join("\n");

    const learningBits = [
      ...(course.learningOutcomes || []).length
        ? [`Learning outcomes:\n${course.learningOutcomes.map((o) => `- ${o}`).join("\n")}`]
        : [],
      ...(course.targetAudience || []).length
        ? [`Target audience:\n${course.targetAudience.map((t) => `- ${t}`).join("\n")}`]
        : [],
    ].join("\n\n");

    let lessonContext = "";
    if (mode === "lesson") {
      const needle = String(lessonTitle).trim().toLowerCase();
      const modNeedle = moduleTitle ? String(moduleTitle).trim().toLowerCase() : null;
      let matched = null;
      for (const mod of course.modules || []) {
        if (modNeedle && String(mod.title || "").toLowerCase() !== modNeedle) continue;
        for (const les of mod.lessons || []) {
          if (String(les.title || "").toLowerCase() === needle) {
            matched = { module: mod.title, lesson: les };
            break;
          }
        }
        if (matched) break;
      }
      if (!matched) {
        for (const mod of course.modules || []) {
          for (const les of mod.lessons || []) {
            if (String(les.title || "").toLowerCase().includes(needle)) {
              matched = { module: mod.title, lesson: les };
              break;
            }
          }
          if (matched) break;
        }
      }
      if (matched?.lesson?.content && matched.lesson.content !== "none") {
        lessonContext = `\nExisting lesson notes (use as grounding, expand and teach clearly):\n${matched.lesson.content.slice(0, 12000)}`;
      }
      const clientCtx =
        typeof lessonSourceContent === "string" && lessonSourceContent.trim()
          ? lessonSourceContent.trim().slice(0, 12000)
          : "";
      if (clientCtx) {
        lessonContext += `\n\nLesson outline / notes from the app (use as context; align the teaching with this):\n${clientCtx}`;
      }
    }

    let instructions;
    if (mode === "overview") {
      instructions = `Write a clear "Course overview and study guide" for this course.
Include: (1) what the learner will build or know by the end, (2) suggested study order through the modules, (3) prerequisites mindset, (4) 5-8 concrete milestones.
Do not invent unrelated topics; stay aligned with the curriculum outline below.
Tone: encouraging, precise, suitable for ${course.level || "Beginner"} level.`;
    } else {
      instructions = `Write full lesson content for the lesson titled "${String(lessonTitle).trim()}"${
        moduleTitle ? ` in module "${String(moduleTitle).trim()}"` : ""
      }.
Include: learning objectives, core explanation with examples, optional hands-on suggestions, and a short "Key takeaways" or summary bullet list (no quiz section).
Do NOT include any "Check your understanding", "Practice questions", or Q&A with inline answers—learners should not see revealed answers in the lesson text.
Use markdown-style headings (##, ###) and bullet lists where helpful.
For math only, use LaTeX: $inline$ and $$block$$ (avoid \\textbf{Answer} or answer keys in the lesson).
Stay consistent with the course topic and level (${course.level || "Beginner"}).${lessonContext}`;
    }

    const prompt = `You are an expert curriculum designer and tutor.

Course title: ${course.title}
Category: ${course.category || "General"}
Level: ${course.level || "Beginner"}
Short description: ${course.description || ""}
Full description: ${course.courseDescription || ""}

${learningBits ? learningBits + "\n\n" : ""}Curriculum outline:
${curriculumOutline || "(No modules linked to this course)"}

Task:
${instructions}`;

    const modelNames = [
      DEFAULT_CLAUDE_MODEL,
      "claude-3-sonnet-20240229",
      "claude-3-opus-20240229",
      "claude-3-haiku-20240307",
    ];

    let message = null;
    let lastError = null;
    const maxTokens = mode === "overview" ? 2048 : 4096;

    for (const modelName of modelNames) {
      try {
        message = await anthropic.messages.create({
          model: modelName,
          max_tokens: maxTokens,
          temperature: 0.6,
          messages: [{ role: "user", content: prompt }],
        });
        break;
      } catch (modelError) {
        lastError = modelError;
      }
    }

    if (!message) {
      throw new Error(`All Claude models failed. Last error: ${lastError?.message || "Unknown"}`);
    }

    const raw = message.content[0].text;
    const contentHtml = formatAiExplanationToHtml(raw);

    await upsertStudentAiCourseEntry(student._id, {
      courseId: course._id,
      mode,
      lessonKey,
      moduleTitle: mode === "lesson" ? String(moduleTitle || "").trim() : "",
      lessonTitle: mode === "lesson" ? String(lessonTitle || "").trim() : "",
      contentMarkdown: raw,
      contentHtml,
    });

    return res.json({
      success: true,
      fromCache: false,
      saved: true,
      mode,
      courseId: String(course._id),
      contentHtml,
      contentMarkdown: raw,
    });
  } catch (error) {
    console.error("generateCourseContent:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate course content",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Generate lesson HTML from titles + optional source text (catalog/mock courses without Mongo course id).
 * Not persisted — client may cache. Student auth required.
 */
const generateLessonFromContext = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }
    if (req.user?.role !== "student") {
      return res.status(403).json({ success: false, message: "Only students can use this endpoint" });
    }
    if (!anthropic) {
      return res.status(500).json({ success: false, message: "AI service is not available." });
    }

    const {
      moduleTitle,
      lessonTitle,
      sourceContent,
      courseTitle,
      level,
      category,
      learningOutcomes,
    } = req.body || {};

    if (!lessonTitle || !String(lessonTitle).trim()) {
      return res.status(400).json({ success: false, message: "lessonTitle is required" });
    }

    const src =
      typeof sourceContent === "string" && sourceContent.trim()
        ? sourceContent.trim().slice(0, 12000)
        : "";

    const outcomesBlock =
      Array.isArray(learningOutcomes) && learningOutcomes.length > 0
        ? `Course learning outcomes (stay consistent where relevant):\n${learningOutcomes
            .slice(0, 16)
            .map((o) => `- ${String(o)}`)
            .join("\n")}\n\n`
        : "";

    const prompt = `You are an expert tutor. The learner opened a specific lesson in their course app. Generate rich lesson content they can read in the "course content" panel.

Course: ${String(courseTitle || "Course").trim()}
Module: ${String(moduleTitle || "").trim()}
Lesson title: ${String(lessonTitle).trim()}
${category ? `Category: ${String(category).trim()}\n` : ""}Level: ${String(level || "Beginner").trim()}

${outcomesBlock}${
      src
        ? `Primary context — this is the lesson outline or source material from the course. Teach from it, expand with intuition, examples, and structure:\n${src}\n`
        : "No short outline was provided. Teach this lesson title thoroughly for the stated level.\n"
    }

Produce: clear learning objectives; structured explanation with examples; optional hands-on ideas; end with a brief "Key takeaways" list—not a quiz.
Do NOT add "Check your understanding", practice Q&A, or inline answers (no Answer: lines, no \\textbf{Answer}).
Use markdown headings (##, ###). Use LaTeX $inline$ and $$block$$ only for real math—not for labeling answers.`;

    const modelNames = [
      DEFAULT_CLAUDE_MODEL,
      "claude-3-sonnet-20240229",
      "claude-3-opus-20240229",
      "claude-3-haiku-20240307",
    ];

    let message = null;
    let lastError = null;
    for (const modelName of modelNames) {
      try {
        message = await anthropic.messages.create({
          model: modelName,
          max_tokens: 4096,
          temperature: 0.55,
          messages: [{ role: "user", content: prompt }],
        });
        break;
      } catch (modelError) {
        lastError = modelError;
      }
    }

    if (!message) {
      throw new Error(`All Claude models failed. Last error: ${lastError?.message || "Unknown"}`);
    }

    const raw = message.content[0].text;
    const contentHtml = formatAiExplanationToHtml(raw);

    return res.json({
      success: true,
      contentHtml,
      contentMarkdown: raw,
    });
  } catch (error) {
    console.error("generateLessonFromContext:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate lesson content",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const countTotalLessonsInCourseDoc = (course) => {
  let t = 0;
  for (const mod of course.modules || []) {
    t += (mod.lessons || []).length;
  }
  return t;
};

const countUniqueCompletedLessonIds = (progressByModule) => {
  const seen = new Set();
  for (const row of progressByModule || []) {
    for (const lid of row.completedLessonIds || []) {
      seen.add(String(lid));
    }
  }
  return seen.size;
};

const lessonExistsInCourse = (course, moduleId, lessonId) => {
  const mid = String(moduleId);
  const lid = String(lessonId);
  for (const mod of course.modules || []) {
    if (String(mod._id) !== mid) continue;
    for (const les of mod.lessons || []) {
      if (String(les._id) === lid) return true;
    }
  }
  return false;
};

const recalcStudentCourseProgressEntry = (entry, course) => {
  const total = countTotalLessonsInCourseDoc(course);
  const completed = countUniqueCompletedLessonIds(entry.progressByModule);
  entry.totalLessons = total;
  entry.completedLessonsCount = completed;
  entry.percentComplete = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  entry.isCompleted = total > 0 && completed >= total;
  entry.updatedAt = new Date();
};

const syncEnrolledCourseProgress = async (studentMongoId, courseMongoId, entry) => {
  const enc = await EnrolledCourse.findOne({
    studentId: studentMongoId,
    courseId: courseMongoId,
    paymentStatus: "completed",
  });
  if (!enc) return;
  enc.progress = (entry.progressByModule || []).map((p) => ({
    moduleId: p.moduleId,
    completedLessons: [...(p.completedLessonIds || [])],
  }));
  enc.isCompleted = Boolean(entry.isCompleted);
  await enc.save();
};

const getOrCreateStudentCourseProgressEntry = (student, courseMongoId) => {
  if (!student.courseLearningProgress) {
    student.courseLearningProgress = [];
  }
  let entry = student.courseLearningProgress.find((e) => String(e.courseId) === String(courseMongoId));
  if (!entry) {
    entry = {
      courseId: courseMongoId,
      progressByModule: [],
      percentComplete: 0,
      totalLessons: 0,
      completedLessonsCount: 0,
      isCompleted: false,
    };
    student.courseLearningProgress.push(entry);
  }
  return entry;
};

/**
 * POST { courseId, moduleId, lessonId, action: "visit" | "complete" | "incomplete" }
 * Updates Student.courseLearningProgress and mirrors to EnrolledCourse when enrolled.
 */
const updateCourseProgress = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }
    if (req.user?.role !== "student") {
      return res.status(403).json({ success: false, message: "Only students can update progress" });
    }

    const { courseId, moduleId, lessonId, action = "visit" } = req.body || {};

    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ success: false, message: "Valid courseId is required" });
    }
    if (!moduleId || !mongoose.Types.ObjectId.isValid(moduleId)) {
      return res.status(400).json({ success: false, message: "Valid moduleId is required" });
    }
    if (!lessonId || !mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ success: false, message: "Valid lessonId is required" });
    }
    if (!["visit", "complete", "incomplete"].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be "visit", "complete", or "incomplete"' });
    }

    const student = await Student.findOne({ userId });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const courseLean = await Course.findById(courseId).select("price").lean();
    if (!courseLean) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    const gate = await getCourseEnrollmentGate(student._id, courseLean);
    if (!gate.allowed) {
      return sendCourseEnrollmentRequired(res, gate.isFreeCourse);
    }

    const course = await Course.findById(courseId).populate({
      path: "modules",
      populate: { path: "lessons" },
    });
    if (!lessonExistsInCourse(course, moduleId, lessonId)) {
      return res.status(400).json({ success: false, message: "Lesson not found in this module" });
    }

    const entry = getOrCreateStudentCourseProgressEntry(student, course._id);
    entry.lastAccessedAt = new Date();
    entry.lastModuleId = new mongoose.Types.ObjectId(moduleId);
    entry.lastLessonId = new mongoose.Types.ObjectId(lessonId);

    if (action === "complete" || action === "incomplete") {
      let modRow = entry.progressByModule.find((r) => String(r.moduleId) === String(moduleId));
      if (!modRow) {
        modRow = {
          moduleId: new mongoose.Types.ObjectId(moduleId),
          completedLessonIds: [],
        };
        entry.progressByModule.push(modRow);
      }
      const lidStr = String(lessonId);
      const ids = (modRow.completedLessonIds || []).map((x) => String(x));
      if (action === "complete" && !ids.includes(lidStr)) {
        modRow.completedLessonIds.push(new mongoose.Types.ObjectId(lessonId));
      }
      if (action === "incomplete") {
        modRow.completedLessonIds = (modRow.completedLessonIds || []).filter((x) => String(x) !== lidStr);
      }
    }

    recalcStudentCourseProgressEntry(entry, course);
    student.markModified("courseLearningProgress");
    await student.save();
    await syncEnrolledCourseProgress(student._id, course._id, entry);

    const completedLessonIds = [];
    const seen = new Set();
    for (const row of entry.progressByModule || []) {
      for (const lid of row.completedLessonIds || []) {
        const s = String(lid);
        if (!seen.has(s)) {
          seen.add(s);
          completedLessonIds.push(s);
        }
      }
    }

    await logStudentActivity({
      userId,
      studentId: student._id,
      eventType: "course_progress",
      courseId: course._id,
      moduleId,
      lessonId,
      progressPercent: entry.percentComplete,
      metadata: { action },
    });
    return res.json({
      success: true,
      courseId: String(course._id),
      percentComplete: entry.percentComplete,
      totalLessons: entry.totalLessons,
      completedLessonsCount: entry.completedLessonsCount,
      isCompleted: entry.isCompleted,
      completedLessonIds,
      lastAccessedAt: entry.lastAccessedAt,
      lastModuleId: entry.lastModuleId ? String(entry.lastModuleId) : null,
      lastLessonId: entry.lastLessonId ? String(entry.lastLessonId) : null,
    });
  } catch (error) {
    console.error("updateCourseProgress:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update progress",
    });
  }
};

const getCourseProgress = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }
    if (req.user?.role !== "student") {
      return res.status(403).json({ success: false, message: "Only students can view progress" });
    }

    const { courseId } = req.params;
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ success: false, message: "Valid courseId is required" });
    }

    const student = await Student.findOne({ userId }).lean();
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const courseLean = await Course.findById(courseId).select("price").lean();
    if (!courseLean) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    const gate = await getCourseEnrollmentGate(student._id, courseLean);
    if (!gate.allowed) {
      return sendCourseEnrollmentRequired(res, gate.isFreeCourse);
    }

    const course = await Course.findById(courseId).populate({
      path: "modules",
      populate: { path: "lessons" },
    });

    const entry = (student.courseLearningProgress || []).find((e) => String(e.courseId) === String(courseId));
    const totalLessons = countTotalLessonsInCourseDoc(course);

    if (!entry) {
      return res.json({
        success: true,
        courseId: String(course._id),
        percentComplete: 0,
        totalLessons,
        completedLessonsCount: 0,
        isCompleted: false,
        completedLessonIds: [],
        lastAccessedAt: null,
        lastModuleId: null,
        lastLessonId: null,
        progressByModule: [],
      });
    }

    const completedLessonIds = [];
    const seen = new Set();
    for (const row of entry.progressByModule || []) {
      for (const lid of row.completedLessonIds || []) {
        const s = String(lid);
        if (!seen.has(s)) {
          seen.add(s);
          completedLessonIds.push(s);
        }
      }
    }

    return res.json({
      success: true,
      courseId: String(course._id),
      percentComplete: entry.percentComplete ?? 0,
      totalLessons: entry.totalLessons ?? totalLessons,
      completedLessonsCount: entry.completedLessonsCount ?? completedLessonIds.length,
      isCompleted: Boolean(entry.isCompleted),
      completedLessonIds,
      lastAccessedAt: entry.lastAccessedAt || null,
      lastModuleId: entry.lastModuleId ? String(entry.lastModuleId) : null,
      lastLessonId: entry.lastLessonId ? String(entry.lastLessonId) : null,
      progressByModule: entry.progressByModule || [],
    });
  } catch (error) {
    console.error("getCourseProgress:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load progress",
    });
  }
};

/** All saved AI course pieces for this student + course (for hydrating the player without extra LLM calls). */
const getStudentCourseAiContent = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }
    if (req.user?.role !== "student") {
      return res.status(403).json({ success: false, message: "Only students can use this endpoint" });
    }

    const { courseId } = req.params;
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ success: false, message: "Valid courseId is required" });
    }

    const student = await Student.findOne({ userId });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const course = await Course.findById(courseId).select("price").lean();
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    const gate = await getCourseEnrollmentGate(student._id, course);
    if (!gate.allowed) {
      return sendCourseEnrollmentRequired(res, gate.isFreeCourse);
    }

    const fresh = await Student.findById(student._id).select("courseAiGeneratedContent").lean();
    const items = (fresh?.courseAiGeneratedContent || [])
      .filter((e) => String(e.courseId) === String(course._id))
      .map((e) => ({
        mode: e.mode,
        lessonKey: e.lessonKey,
        moduleTitle: e.moduleTitle,
        lessonTitle: e.lessonTitle,
        contentHtml: e.contentHtml,
        updatedAt: e.updatedAt,
      }));

    return res.json({
      success: true,
      courseId: String(course._id),
      items,
    });
  } catch (error) {
    console.error("getStudentCourseAiContent:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load saved course content",
    });
  }
};

/** ₹0 courses: explicit enroll creates EnrolledCourse with paymentStatus completed (same as paid). */
const enrollFreeCourse = async (req, res) => {
  try {
    const { courseId } = req.body || {};
    const userId = req.user?.id || req.user?._id;

    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ success: false, message: "Valid courseId is required" });
    }
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }
    if (req.user?.role !== "student") {
      return res.status(403).json({ success: false, message: "Only students can enroll" });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    if (!coursePriceIsFree(course.price)) {
      return res.status(400).json({
        success: false,
        message: "This course is not free. Complete payment to enroll.",
      });
    }

    const student = await Student.findOne({ userId });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const existing = await EnrolledCourse.findOne({
      studentId: student._id,
      courseId: course._id,
      paymentStatus: "completed",
    });
    if (existing) {
      return res.json({
        success: true,
        message: "You are already enrolled in this course",
        alreadyEnrolled: true,
      });
    }

    const courseIdStr = String(course._id);
    const hasCourse = (student.enrolledCourses || []).some((c) => String(c) === courseIdStr);
    if (!hasCourse) {
      student.enrolledCourses.push(course._id);
      await student.save();
    }

    const userIdStr = String(userId);
    const alreadyOnCourse = (course.enrolledStudents || []).some((u) => String(u) === userIdStr);
    if (!alreadyOnCourse) {
      course.enrolledStudents.push(userId);
      await course.save();
    }

    await EnrolledCourse.create({
      studentId: student._id,
      courseId: course._id,
      paymentStatus: "completed",
    });
    await logStudentActivity({
      userId,
      studentId: student._id,
      eventType: "course_enroll",
      courseId: course._id,
      metadata: { mode: "free" },
    });

    return res.json({
      success: true,
      message: "Successfully enrolled in free course",
      course: { _id: course._id, title: course.title },
    });
  } catch (err) {
    console.error("enrollFreeCourse:", err);
    return res.status(500).json({
      success: false,
      message: "Error enrolling in course",
      error: err.message,
    });
  }
};

const getCourseAccessStatus = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }
    if (req.user?.role !== "student") {
      return res.status(403).json({ success: false, message: "Only students can check access" });
    }

    const { courseId } = req.params;
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ success: false, message: "Valid courseId is required" });
    }

    const student = await Student.findOne({ userId });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const course = await Course.findById(courseId).select("price title").lean();
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    const enrollment = await EnrolledCourse.findOne({
      studentId: student._id,
      courseId: course._id,
      paymentStatus: "completed",
    });

    const isFreeCourse = coursePriceIsFree(course.price);

    return res.json({
      success: true,
      hasAccess: Boolean(enrollment),
      isFreeCourse,
      needsPurchase: !isFreeCourse && !enrollment,
      needsFreeEnroll: isFreeCourse && !enrollment,
    });
  } catch (error) {
    console.error("getCourseAccessStatus:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to check access",
    });
  }
};

/** Full course + modules + lessons for the player — only when enrolled (paid or free enroll). */
const getCoursePlayerData = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }
    if (req.user?.role !== "student") {
      return res.status(403).json({ success: false, message: "Only students can open the course player" });
    }

    const { courseId } = req.params;
    if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ success: false, message: "Valid courseId is required" });
    }

    const student = await Student.findOne({ userId });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    const courseLean = await Course.findById(courseId).select("price").lean();
    if (!courseLean) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    const enrollment = await EnrolledCourse.findOne({
      studentId: student._id,
      courseId: courseLean._id,
      paymentStatus: "completed",
    });

    if (!enrollment) {
      return sendCourseEnrollmentRequired(res, coursePriceIsFree(courseLean.price));
    }

    const course = await Course.findById(courseId).populate({
      path: "modules",
      populate: { path: "lessons" },
    });
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    const modules = (course.modules || []).map((mod) => ({
      _id: mod._id,
      title: mod.title,
      lessons: (mod.lessons || []).map((l) => ({
        _id: l._id,
        title: l.title,
        content: l.content,
        duration: l.duration,
      })),
    }));

    return res.json({
      success: true,
      course: {
        _id: course._id,
        title: course.title,
        category: course.category,
        level: course.level,
        learningOutcomes: course.learningOutcomes || [],
        modules,
      },
    });
  } catch (error) {
    console.error("getCoursePlayerData:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load course",
    });
  }
};


  module.exports = {
    getTests,
    getQuestionBank,
    revealQuestionBankAnswer,
    getCourseById,
    getTestById,
    getEnrolledTests,
    getTestCategories,
    addToCart,
    checkItemInCart,
    getCartTests,
    removeFromCart,
    getQuiz,
    submitQuiz,
    createOrder,
    verifyPayment,
    enrollFreeTest,
    enrollFreeCourse,
    getCourseAccessStatus,
    getCoursePlayerData,
    getCourse,
    getCartCourses,
    getModulesDetails,
    createCourseOrder,
    verifyCoursePayment,
    createCartOrder,
    verifyCartPayment,
    getLatestCoursesAndTests,
    getDashboardOverview,
    submitTest,
    getTestSubmissionHistory,
    getTestSubmissionDetails,
    aiChat,
    generateQuestionExplanation,
    getAICareerRecommendations,
    generateCourseContent,
    generateLessonFromContext,
    getStudentCourseAiContent,
    updateCourseProgress,
    getCourseProgress,
    getLibraryDocumentsForStudent,
    getLibraryDocumentByIdForStudent,
    createLibraryOrder,
    verifyLibraryPayment,
    getPurchasedLibraryDocuments,
    getMyStudentProfile,
    updateMyStudentProfile,
    updateMyStudentEducation,
    updateMyStudentSkills,
  };