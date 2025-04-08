const Course = require("../models/courseModel/courseModel");
const Lesson = require("../models/courseModel/lessons");
const Quiz = require("../models/courseModel/quiz");
const Module = require("../models/courseModel/module");
const Test = require("../models/testModel/testModel");

const addCourse = async (req, res) => {
  try {
    const { title, description, price, category, instructor, imageUrl, level, modules } = req.body;

    let moduleIds = [];

    for (const module of modules) {
      let existingModule = await Module.findOne({ title: module.title });

      if (!existingModule) {
        let lessonIds = [];

        for (const lesson of module.lessons) {
          let quizIds = [];

          // ✅ Save multiple quizzes first
          if (lesson.quiz && Array.isArray(lesson.quiz)) {
            for (const quiz of lesson.quiz) {
              const newQuiz = new Quiz(quiz);
              await newQuiz.save();
              quizIds.push(newQuiz._id); // Store Quiz ObjectId
            }
          }

          console.log("Quiz IDs for lesson:", lesson.title, quizIds); // 🔍 Debugging

          // ✅ Save lesson with quiz references
          const newLesson = new Lesson({
            title: lesson.title,
            videoUrl: lesson.videoUrl,
            duration: lesson.duration,
            practiceQuestions: lesson.practiceQuestions,
            quiz: quizIds, // Store Quiz ObjectIds inside the lesson
          });

          await newLesson.save();
          lessonIds.push(newLesson._id); // Store Lesson ObjectId
        }

        // ✅ Save the module with Lesson ObjectIds
        const newModule = new Module({
          title: module.title,
          lessons: lessonIds, // Store Lesson ObjectIds
        });

        await newModule.save();
        moduleIds.push(newModule._id); // Store Module ObjectId
      } else {
        // ✅ Use existing module if found
        moduleIds.push(existingModule._id);
      }
    }

    // ✅ Save the course with Module ObjectIds
    const newCourse = new Course({
      title,
      description,
      price,
      category,
      instructor,
      imageUrl,
      level,
      modules: moduleIds, // Store Module ObjectIds
    });

    await newCourse.save();

    res.status(201).json({ message: "Course created successfully", course: newCourse });
  } catch (error) {
    console.error("Error adding course:", error.message); // 🔍 Debugging
    res.status(400).json({ error: error.message });
  }
};



const addLesson = async (req, res) => {
  try {
    const { title, videoUrl, duration, practiceQuestions, quizzes } = req.body;

    // 1️⃣ First, save multiple quizzes
    const quizIds = [];
    for (const quiz of quizzes) {
      const newQuiz = new Quiz(quiz);
      await newQuiz.save();
      quizIds.push(newQuiz._id); // Store each saved quiz's ID
    }

    // 2️⃣ Now, save the lesson with the array of quiz ObjectIds
    const newLesson = new Lesson({
      title,
      videoUrl,
      duration,
      practiceQuestions,
      quizzes: quizIds // Store multiple quiz references
    });

    await newLesson.save();

    res.status(201).json({ message: "Lesson created successfully", lesson: newLesson });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};




const addModule = async (req, res) => {
  try {
    const { title, lessons } = req.body;

    let lessonIds = [];

    for (const lesson of lessons) {
      const newLesson = new Lesson({
        title: lesson.title,
        videoUrl: lesson.videoUrl,
        duration: lesson.duration,
        practiceQuestions: lesson.practiceQuestions
      });

      await newLesson.save();
      lessonIds.push(newLesson._id);
    }

    const newModule = new Module({
      title,
      lessons: lessonIds
    });

    await newModule.save();

    res.status(201).json({ message: "Module created successfully", module: newModule });
  } catch (error) {

    res.status(400).json({ error: error.message });

  }
};

//without ratings and reviews

// const addTest = async (req, res) => {
//   try {
//     const { title, description, price, category, instructor, quizzes, passingScore } = req.body;

//     let quizIds = [];
//     let totalMarks = 0;

//     // ✅ Save multiple quizzes and calculate total marks
//     for (const quizData of quizzes) {
//       const newQuiz = new Quiz(quizData);
//       await newQuiz.save();

//       quizIds.push(newQuiz._id); // Store Quiz ObjectId
//       totalMarks += quizData.questions.length * 10; // Assume each question carries 10 marks
//     }

//     // ✅ Create and save test with calculated totalMarks
//     const newTest = new Test({
//       title,
//       description,
//       price,
//       category,
//       instructor,
//       quizzes: quizIds,
//       passingScore,
//       totalMarks, // Dynamically calculated
//     });

//     await newTest.save();

//     res.status(201).json({ message: "Test created successfully", test: newTest });
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// };

const addTest = async (req, res) => {
  try {
    const {
      title,
      company,
      description,
      duration,
      numberOfQuestions,
      price: { actual, discounted },
      level,
      features,
      skills,
      certificate,
      instructor,
      quizzes,
      passingScore,
      ratings = [] // optional: handle if ratings are not provided
    } = req.body;

    let quizIds = [];
    let totalMarks = 0;

    // Validate required fields
    if (!title || !company || !description || !duration || !numberOfQuestions || !actual || !discounted || !level) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Save multiple quizzes and calculate total marks
    for (const quizData of quizzes) {
      const newQuiz = new Quiz(quizData);
      await newQuiz.save();

      quizIds.push(newQuiz._id);
      totalMarks += quizData.questions.length * 10;
    }

    // Calculate average rating and total reviews
    let averageRating = 0;
    const totalReviews = ratings.length;
    if (totalReviews > 0) {
      const total = ratings.reduce((sum, r) => sum + r.rating, 0);
      averageRating = total / totalReviews;
    }

    // Create and save test
    const newTest = new Test({
      title,
      company,
      description,
      duration,
      numberOfQuestions,
      price: {
        actual,
        discounted
      },
      level,
      features: features || [],
      skills: skills || [],
      certificate: certificate !== undefined ? certificate : true,
      instructor,
      quizzes: quizIds,
      passingScore,
      totalMarks,
      ratings,
      averageRating,
      totalReviews
    });

    await newTest.save();

    res.status(201).json({ 
      message: "Test created successfully", 
      test: newTest 
    });
  } catch (error) {
    console.error("Error creating test:", error);
    res.status(400).json({ 
      error: error.message || "Failed to create test" 
    });
  }
};



const addQuiz = async (req, res) => {
  try {
    const { title, questions } = req.body;

    // ✅ Validate data
    if (!title || !questions || questions.length === 0) {
      return res.status(400).json({ error: "Title and at least one question are required." });
    }

    // ✅ Save the quiz
    const newQuiz = new Quiz({ title, questions });
    await newQuiz.save();

    res.status(201).json({ message: "Quiz added successfully", quiz: newQuiz });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

  


  module.exports = {addCourse,
    addLesson,
    addModule,
    addTest,
    addQuiz,
  }