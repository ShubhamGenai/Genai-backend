const Cart = require("../models/Cart");
const Course = require("../models/courseModel/courseModel");
const Test = require("../models/testModel/testModel");
const Quiz = require("../models/courseModel/quiz");
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
dotenv.config();


const getCourse = async (req, res) => {
    try {
      const courses = await Course.find(); // Populate modules if needed
      res.status(200).json(courses);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  
  // ✅ Fetch all tests
  const getTests = async (req, res) => {
    try {
      const tests = await Test.find() // Populate quizzes if needed
      res.status(200).json(tests);
    } catch (error) {
      res.status(500).json({ error: error.message });
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
  
      res.json({ success: true, message: "Payment verified and student enrolled", payment });
  
    } catch (err) {
      res.status(500).json({ success: false, message: "Error verifying payment", error: err.message });
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

  // Find modules and populate lessons and quizzes inside lessons
  const modules = await Module.find({ _id: { $in: objectIds } })
   
    


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

    res.json({ success: true, message: "Payment verified and student enrolled", payment });

  } catch (err) {
    res.status(500).json({ success: false, message: "Error verifying payment", error: err.message });
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








  
  module.exports = {
   
    getTests,
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
    getTestSubmissionDetails
  };