const Course = require("../models/courseModel/courseModel");
const Lesson = require("../models/courseModel/lessons");
const Quiz = require("../models/courseModel/quiz");
const Module = require("../models/courseModel/module");
const Test = require("../models/testModel/testModel");

// const addCourse = async (req, res) => {
//   try {
//     const { title, description, price, category, instructor, imageUrl, level, modules } = req.body;

//     let moduleIds = [];

//     for (const module of modules) {
//       let existingModule = await Module.findOne({ title: module.title });

//       if (!existingModule) {
//         let lessonIds = [];

//         for (const lesson of module.lessons) {
//           let quizIds = [];

//           // ✅ Save multiple quizzes first
//           if (lesson.quiz && Array.isArray(lesson.quiz)) {
//             for (const quiz of lesson.quiz) {
//               const newQuiz = new Quiz(quiz);
//               await newQuiz.save();
//               quizIds.push(newQuiz._id); // Store Quiz ObjectId
//             }
//           }

//           console.log("Quiz IDs for lesson:", lesson.title, quizIds); // 🔍 Debugging

//           // ✅ Save lesson with quiz references
//           const newLesson = new Lesson({
//             title: lesson.title,
//             videoUrl: lesson.videoUrl,
//             duration: lesson.duration,
//             practiceQuestions: lesson.practiceQuestions,
//             quiz: quizIds, // Store Quiz ObjectIds inside the lesson
//           });

//           await newLesson.save();
//           lessonIds.push(newLesson._id); // Store Lesson ObjectId
//         }

//         // ✅ Save the module with Lesson ObjectIds
//         const newModule = new Module({
//           title: module.title,
//           lessons: lessonIds, // Store Lesson ObjectIds
//         });

//         await newModule.save();
//         moduleIds.push(newModule._id); // Store Module ObjectId
//       } else {
//         // ✅ Use existing module if found
//         moduleIds.push(existingModule._id);
//       }
//     }

//     // ✅ Save the course with Module ObjectIds
//     const newCourse = new Course({
//       title,
//       description,
//       price,
//       category,
//       instructor,
//       imageUrl,
//       level,
//       modules: moduleIds, // Store Module ObjectIds
//     });

//     await newCourse.save();

//     res.status(201).json({ message: "Course created successfully", course: newCourse });
//   } catch (error) {
//     console.error("Error adding course:", error.message); // 🔍 Debugging
//     res.status(400).json({ error: error.message });
//   }
// };

const addCourse = async (req, res) => {
  try {
    const {
      title,
      description,
      courseDescription,
      price,
      category,
      instructor,
      imageUrl,
      level,
      duration,
      features,
      learningOutcomes,
      targetAudience,
      requirements,
      certificate,
      modules,
      ratings
    } = req.body;

    const moduleIds = [];

    for (const module of modules) {
      const lessonIds = [];

      for (const lesson of module.lessons) {
        const quizIds = [];

        // Handle quizzes
        if (lesson.quizzes && Array.isArray(lesson.quizzes)) {
          for (const quiz of lesson.quizzes) {
            const newQuiz = new Quiz({
              title: quiz.title,
              duration: quiz.duration,
              questions: quiz.questions
            });

            await newQuiz.save();
            quizIds.push(newQuiz._id);
          }
        }

        // Create lesson
        const newLesson = new Lesson({
          title: lesson.title,
          videoUrl: lesson.videoUrl,
          duration: lesson.duration,
          practiceQuestions: lesson.practiceQuestions,
          quiz: quizIds
        });

        await newLesson.save();
        lessonIds.push(newLesson._id);
      }

      // Create module
      const newModule = new Module({
        title: module.title,
        lessons: lessonIds,
        createdAt: new Date()
      });

      await newModule.save();
      moduleIds.push(newModule._id);
    }

    // Create course
    const newCourse = new Course({
      title,
      description,
      courseDescription,
      price,
      category,
      instructor,
      imageUrl,
      level,
      duration,
      features,
      learningOutcomes,
      targetAudience,
      requirements,
      certificate,
      modules: moduleIds,
      ratings
    });

    await newCourse.save();

    res.status(201).json({
      message: "Course created successfully",
      course: newCourse
    });

  } catch (error) {
    console.error("Error adding course:", error.message);
    res.status(400).json({ error: error.message });
  }
};



const addLesson = async (req, res) => {
  try {
    const { title, content, duration, practiceQuestions, quiz } = req.body;

    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({ 
        error: "Title and content are required fields" 
      });
    }

    // Validate practice questions structure if provided
    if (practiceQuestions && practiceQuestions.length > 0) {
      for (let i = 0; i < practiceQuestions.length; i++) {
        const question = practiceQuestions[i];
        if (!question.question || question.question.trim() === '') {
          return res.status(400).json({ 
            error: `Practice question ${i + 1} is missing the required 'question' field` 
          });
        }
      }
    }

    // Option 1: If you want to create new quizzes and reference them
    const quizIds = [];
    if (quiz && quiz.length > 0) {
      for (const quizData of quiz) {
        // Only create new quizzes if quizData is an object (not just an ObjectId string)
        if (typeof quizData === 'object' && !quizData._id) {
          const newQuiz = new Quiz(quizData);
          await newQuiz.save();
          quizIds.push(newQuiz._id);
        } else {
          // If it's already an ObjectId or string, just add it
          quizIds.push(quizData);
        }
      }
    }

    // Create the lesson
    const newLesson = new Lesson({
      title: title.trim(),
      content: content.trim(),
      duration: duration ? parseInt(duration) : undefined,
      practiceQuestions: practiceQuestions || [],
      quiz: quizIds // This matches your schema field name 'quiz'
    });

    await newLesson.save();

    // Populate quiz references for the response
    await newLesson.populate('quiz');

    res.status(201).json({ 
      message: "Lesson created successfully", 
      lesson: newLesson 
    });

  } catch (error) {
    console.error('Error creating lesson:', error);
    
    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validationErrors 
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({ 
        error: "A lesson with this title already exists" 
      });
    }

    res.status(500).json({ 
      error: "Internal server error while creating lesson" 
    });
  }
};




const addModule = async (req, res) => {
  try {
    const { title, lessons, lessonIds } = req.body;

    let finalLessonIds = [];

    // If lessons array exists → create lessons
    if (lessons && Array.isArray(lessons)) {
      for (const lesson of lessons) {
        const newLesson = new Lesson({
          title: lesson.title,
          videoUrl: lesson.videoUrl,
          duration: lesson.duration,
          practiceQuestions: lesson.practiceQuestions
        });

        await newLesson.save();
        finalLessonIds.push(newLesson._id);
      }
    }

    // If user provided only lessonIds → reuse them
    if (lessonIds && Array.isArray(lessonIds)) {
      finalLessonIds = [...finalLessonIds, ...lessonIds];
    }

    const newModule = new Module({
      title,
      lessons: finalLessonIds
    });

    await newModule.save();

    res.status(201).json({ message: "Module created successfully", module: newModule });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


const getModules = async (req, res) => {
  try {
    const modules = await Module.find().populate("lessons");
    res.status(200).json({ modules });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Fetch all courses for content manager
const getCourses = async (req, res) => {
  try {
    const courses = await Course.find();
    res.status(200).json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ error: error.message || "Failed to fetch courses" });
  }
};

// GET module by ID
const getModuleById = async (req, res) => {
  try {
    const { id } = req.params;

    const moduleData = await Module.findById(id).populate("lessons");

    if (!moduleData) {
      return res.status(404).json({ error: "Module not found" });
    }

    res.status(200).json({ module: moduleData });
  } catch (error) {
    res.status(500).json({ error: error.message });
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



// Fetch all tests for content manager (independent from student routes)
const getTests = async (req, res) => {
  try {
    const tests = await Test.find();
    console.log(tests);
    
    res.status(200).json(tests);
  } catch (error) {
    console.error("Error fetching tests:", error);
    res.status(500).json({ error: error.message || "Failed to fetch tests" });
  }
};

const addQuiz = async (req, res) => {
  try {
    const { title,duration, questions } = req.body;

    // ✅ Validate data
    if (!title || !questions || questions.length === 0) {
      return res.status(400).json({ error: "Title and at least one question are required." });
    }

    // ✅ Save the quiz
    const newQuiz = new Quiz({ title,duration, questions });
    await newQuiz.save();

    res.status(201).json({ message: "Quiz added successfully", quiz: newQuiz });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


const getQuiz = async (req, res) => {
  try {
    const quizzes = await Quiz.find() // await is needed here
    res.status(200).json(quizzes); // no need to wrap in { quizzes } unless you want it nested
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


    const getLesson = async (req, res) => {
      try {
        const lessons = await Lesson.find()
        res.status(200).json(lessons);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    }


    const getLessonById = async (req, res) => {
     try {
    const { lessonId } = req.params;
    const lesson = await Lesson.findById(lessonId);

    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    res.status(200).json(lesson);
  } catch (error) {
    console.error('Error fetching lesson:', error);
    res.status(500).json({ message: 'Server error while fetching lesson' });
  }
}
  


  module.exports = {addCourse,
    addLesson,
    addModule,
    addTest,
    addQuiz,
    getQuiz,
    getLesson,
    getLessonById,
    getModules,
    getModuleById,
    getTests,
    getCourses
    
  }