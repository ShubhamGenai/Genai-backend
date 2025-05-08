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

    getLatestCoursesAndTests
  };