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
dotenv.config();


const getCourses = async (req, res) => {
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
  
  // code to fetch all quizzes inside a tset for test player

  const getQuiz = async (req, res) => {
    console.log("here");
    
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
 const verifyPayement = async (req, res) => {
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
      const payment = await paymentSchema.findByIdAndUpdate(paymentId, {
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        status: "paid",
      }, { new: true });
  
      // Optional: Enroll student to test
      const student = await Student.findById(payment.student);
      if (!student.enrolledTests.includes(payment.test)) {
        student.enrolledTests.push(payment.test);
        await student.save();
      }
  
      res.json({ success: true, message: "Payment verified", payment });
    } catch (err) {
      res.status(500).json({ success: false, message: "Error verifying payment", error: err.message });
    }
  }
  




  
  module.exports = {
    getCourses,
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
    verifyPayement
  };