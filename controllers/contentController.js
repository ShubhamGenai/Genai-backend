const mongoose = require("mongoose");
const Course = require("../models/courseModel/courseModel");
const Lesson = require("../models/courseModel/lessons");
const Quiz = require("../models/courseModel/quiz");
const Module = require("../models/courseModel/module");
const Test = require("../models/testModel/testModel");
const LibraryDocument = require("../models/libraryModel");
const User = require("../models/UserModel");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;

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
  console.log(req.body,"add course body");
  
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

    // Validate instructor ObjectId
    if (!instructor || !mongoose.Types.ObjectId.isValid(instructor)) {
      return res.status(400).json({ error: "Valid instructor ObjectId is required" });
    }

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
        // Note: Lesson schema requires 'content' field (not videoUrl)
        const newLesson = new Lesson({
          title: lesson.title,
          content: lesson.content || lesson.videoUrl || 'No content provided',
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

// Update course
const updateCourse = async (req, res) => {
  console.log(req.body, "update course body");
  console.log(req.params.id, "course id");

  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid course ID" });
    }

    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

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

    // Validate instructor ObjectId if provided
    if (instructor && !mongoose.Types.ObjectId.isValid(instructor)) {
      return res.status(400).json({ error: "Valid instructor ObjectId is required" });
    }

    const moduleIds = [];

    // Process modules
    for (const module of modules) {
      const lessonIds = [];

      for (const lesson of module.lessons) {
        const quizIds = [];

        // Handle quizzes
        if (lesson.quizzes && Array.isArray(lesson.quizzes)) {
          for (const quiz of lesson.quizzes) {
            // If quiz has _id, it's an existing quiz - reuse it
            if (quiz._id && mongoose.Types.ObjectId.isValid(quiz._id)) {
              quizIds.push(quiz._id);
            } else {
              // Create new quiz
              const newQuiz = new Quiz({
                title: quiz.title,
                duration: quiz.duration,
                questions: quiz.questions
              });
              await newQuiz.save();
              quizIds.push(newQuiz._id);
            }
          }
        }

        // If lesson has _id, it's an existing lesson - update it
        if (lesson._id && mongoose.Types.ObjectId.isValid(lesson._id)) {
          await Lesson.findByIdAndUpdate(lesson._id, {
            title: lesson.title,
            content: lesson.content || lesson.videoUrl || 'No content provided',
            duration: lesson.duration,
            practiceQuestions: lesson.practiceQuestions,
            quiz: quizIds
          });
          lessonIds.push(lesson._id);
        } else {
          // Create new lesson
          const newLesson = new Lesson({
            title: lesson.title,
            content: lesson.content || lesson.videoUrl || 'No content provided',
            duration: lesson.duration,
            practiceQuestions: lesson.practiceQuestions,
            quiz: quizIds
          });
          await newLesson.save();
          lessonIds.push(newLesson._id);
        }
      }

      // If module has _id, it's an existing module - update it
      if (module._id && mongoose.Types.ObjectId.isValid(module._id)) {
        await Module.findByIdAndUpdate(module._id, {
          title: module.title,
          lessons: lessonIds
        });
        moduleIds.push(module._id);
      } else {
        // Create new module
        const newModule = new Module({
          title: module.title,
          lessons: lessonIds,
          createdAt: new Date()
        });
        await newModule.save();
        moduleIds.push(newModule._id);
      }
    }

    // Update course
    const updatedCourse = await Course.findByIdAndUpdate(
      id,
      {
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
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      message: "Course updated successfully",
      course: updatedCourse
    });

  } catch (error) {
    console.error("Error updating course:", error.message);
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

// Update lesson
const updateLesson = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, duration, practiceQuestions, quiz } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid lesson ID" });
    }

    const lesson = await Lesson.findById(id);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

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

    // Handle quiz IDs
    const quizIds = [];
    if (quiz && quiz.length > 0) {
      for (const quizData of quiz) {
        if (typeof quizData === 'object' && quizData._id) {
          quizIds.push(quizData._id);
        } else if (mongoose.Types.ObjectId.isValid(quizData)) {
          quizIds.push(quizData);
        } else if (typeof quizData === 'object' && !quizData._id) {
          // Create new quiz if it's a new object
          const newQuiz = new Quiz(quizData);
          await newQuiz.save();
          quizIds.push(newQuiz._id);
        }
      }
    }

    // Update the lesson
    const updatedLesson = await Lesson.findByIdAndUpdate(
      id,
      {
        title: title.trim(),
        content: content.trim(),
        duration: duration ? parseInt(duration) : undefined,
        practiceQuestions: practiceQuestions || [],
        quiz: quizIds
      },
      { new: true, runValidators: true }
    ).populate('quiz');

    res.status(200).json({ 
      message: "Lesson updated successfully", 
      lesson: updatedLesson 
    });
  } catch (error) {
    console.error("Error updating lesson:", error.message);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validationErrors 
      });
    }

    res.status(400).json({ error: error.message });
  }
};

// Delete lesson
const deleteLesson = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid lesson ID" });
    }

    const lesson = await Lesson.findById(id);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    // Delete associated quizzes if they exist
    if (lesson.quiz && lesson.quiz.length > 0) {
      await Quiz.deleteMany({ _id: { $in: lesson.quiz } });
    }

    // Delete the lesson
    await Lesson.findByIdAndDelete(id);

    res.status(200).json({
      message: "Lesson deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting lesson:", error.message);
    res.status(500).json({ error: error.message });
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

// Update module
const updateModule = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, lessons, lessonIds } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid module ID" });
    }

    const module = await Module.findById(id);
    if (!module) {
      return res.status(404).json({ error: "Module not found" });
    }

    let finalLessonIds = [];

    // If lessons array exists → create or update lessons
    if (lessons && Array.isArray(lessons)) {
      for (const lesson of lessons) {
        // If lesson has _id, it's an existing lesson - update it
        if (lesson._id && mongoose.Types.ObjectId.isValid(lesson._id)) {
          await Lesson.findByIdAndUpdate(lesson._id, {
            title: lesson.title,
            content: lesson.content || lesson.videoUrl || 'No content provided',
            duration: lesson.duration,
            practiceQuestions: lesson.practiceQuestions || []
          });
          finalLessonIds.push(lesson._id);
        } else {
          // Create new lesson
          const newLesson = new Lesson({
            title: lesson.title,
            content: lesson.content || lesson.videoUrl || 'No content provided',
            duration: lesson.duration,
            practiceQuestions: lesson.practiceQuestions || []
          });
          await newLesson.save();
          finalLessonIds.push(newLesson._id);
        }
      }
    }

    // If user provided only lessonIds → reuse them
    if (lessonIds && Array.isArray(lessonIds)) {
      finalLessonIds = [...finalLessonIds, ...lessonIds];
    }

    // If no lessons or lessonIds provided, preserve existing lessons
    if (finalLessonIds.length === 0 && (!lessons || lessons.length === 0) && (!lessonIds || lessonIds.length === 0)) {
      finalLessonIds = module.lessons || [];
    }

    // Update the module
    const updateData = { title };
    if (finalLessonIds.length > 0 || lessons || lessonIds) {
      updateData.lessons = finalLessonIds;
    }

    const updatedModule = await Module.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate("lessons");

    res.status(200).json({ 
      message: "Module updated successfully", 
      module: updatedModule 
    });
  } catch (error) {
    console.error("Error updating module:", error.message);
    res.status(400).json({ error: error.message });
  }
};

// Delete module
const deleteModule = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid module ID" });
    }

    const module = await Module.findById(id);
    if (!module) {
      return res.status(404).json({ error: "Module not found" });
    }

    // Delete associated lessons and their quizzes
    if (module.lessons && module.lessons.length > 0) {
      for (const lessonId of module.lessons) {
        const lesson = await Lesson.findById(lessonId);
        if (lesson) {
          // Delete quizzes associated with the lesson
          if (lesson.quiz && lesson.quiz.length > 0) {
            await Quiz.deleteMany({ _id: { $in: lesson.quiz } });
          }
          // Delete the lesson
          await Lesson.findByIdAndDelete(lessonId);
        }
      }
    }

    // Delete the module
    await Module.findByIdAndDelete(id);

    res.status(200).json({
      message: "Module deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting module:", error.message);
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

// Delete course
const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid course ID" });
    }

    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Delete associated modules and their lessons/quizzes
    if (course.modules && course.modules.length > 0) {
      for (const moduleId of course.modules) {
        const module = await Module.findById(moduleId);
        if (module) {
          // Delete lessons and their quizzes
          if (module.lessons && module.lessons.length > 0) {
            for (const lessonId of module.lessons) {
              const lesson = await Lesson.findById(lessonId);
              if (lesson && lesson.quiz && lesson.quiz.length > 0) {
                // Delete quizzes
                await Quiz.deleteMany({ _id: { $in: lesson.quiz } });
              }
              // Delete lesson
              await Lesson.findByIdAndDelete(lessonId);
            }
          }
          // Delete module
          await Module.findByIdAndDelete(moduleId);
        }
      }
    }

    // Delete the course
    await Course.findByIdAndDelete(id);

    res.status(200).json({
      message: "Course deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting course:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// Get course by ID with populated modules, lessons, and quizzes
const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Fetching course with ID:", id);
    
    const course = await Course.findById(id)
      .populate({
        path: 'modules',
        populate: {
          path: 'lessons',
          populate: {
            path: 'quiz',
            model: 'Quiz'
          }
        }
      })
      .populate('instructor', 'name email')
      .exec();

    if (!course) {
      console.log("Course not found for ID:", id);
      return res.status(404).json({ error: "Course not found" });
    }

    console.log("Course found:", course.title);
    console.log("Modules count:", course.modules?.length || 0);
    if (course.modules && course.modules.length > 0) {
      console.log("First module:", course.modules[0].title);
      console.log("First module lessons:", course.modules[0].lessons?.length || 0);
    }

    res.status(200).json({ course });
  } catch (error) {
    console.error("Error fetching course by ID:", error);
    res.status(500).json({ error: error.message || "Failed to fetch course" });
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

// Get test by ID with populated quizzes
const getTestById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Fetching test with ID:", id);
    
    const test = await Test.findById(id)
      .populate({
        path: 'quizzes',
        model: 'Quiz'
      })
      .populate('instructor', 'name email')
      .exec();

    if (!test) {
      console.log("Test not found for ID:", id);
      return res.status(404).json({ error: "Test not found" });
    }

    console.log("Test found:", test.title);
    console.log("Quizzes count:", test.quizzes?.length || 0);
    if (test.quizzes && test.quizzes.length > 0) {
      console.log("First quiz:", test.quizzes[0].title);
      console.log("First quiz questions:", test.quizzes[0].questions?.length || 0);
    }

    res.status(200).json({ test });
  } catch (error) {
    console.error("Error fetching test by ID:", error);
    res.status(500).json({ error: error.message || "Failed to fetch test" });
  }
};

const addQuiz = async (req, res) => {
  try {
    console.log('Add quiz request body:', JSON.stringify(req.body, null, 2));
    const { title, duration, questions } = req.body;

    // ✅ Validate data
    if (!title || title.trim() === '') {
      return res.status(400).json({ error: "Quiz title is required." });
    }

    if (!duration || duration === '' || isNaN(parseInt(duration))) {
      return res.status(400).json({ error: "Valid duration (in minutes) is required." });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: "At least one question is required." });
    }

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText || q.questionText.trim() === '') {
        return res.status(400).json({ error: `Question ${i + 1}: Question text is required.` });
      }
      if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
        return res.status(400).json({ error: `Question ${i + 1}: At least 2 options are required.` });
      }
      // Check if at least 2 options have text
      const validOptions = q.options.filter(opt => opt && opt.trim() !== '');
      if (validOptions.length < 2) {
        return res.status(400).json({ error: `Question ${i + 1}: At least 2 valid options are required.` });
      }
      if (!q.answer || q.answer.trim() === '') {
        return res.status(400).json({ error: `Question ${i + 1}: Correct answer is required.` });
      }
      // Check if answer matches one of the options
      if (!q.options.includes(q.answer)) {
        return res.status(400).json({ error: `Question ${i + 1}: Answer must match one of the options.` });
      }
    }

    // ✅ Save the quiz
    const newQuiz = new Quiz({ 
      title: title.trim(), 
      duration: parseInt(duration), 
      questions: questions.map(q => ({
        questionText: q.questionText.trim(),
        options: q.options.map(opt => opt.trim()).filter(opt => opt !== ''),
        answer: q.answer.trim(),
        imageUrl: q.imageUrl || '',
        marks: q.marks || 1
      }))
    });
    
    await newQuiz.save();

    console.log('Quiz saved successfully:', newQuiz._id);
    res.status(201).json({ message: "Quiz added successfully", quiz: newQuiz });
  } catch (error) {
    console.error('Error adding quiz:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validationErrors 
      });
    }
    
    res.status(400).json({ 
      error: error.message || "Failed to create quiz",
      details: error.toString()
    });
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

// Update quiz
const updateQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, duration, questions } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid quiz ID" });
    }

    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    // Validate required fields
    if (!title || !questions || questions.length === 0) {
      return res.status(400).json({ 
        error: "Title and at least one question are required" 
      });
    }

    // Update the quiz
    const updatedQuiz = await Quiz.findByIdAndUpdate(
      id,
      {
        title: title.trim(),
        duration: duration ? parseInt(duration) : undefined,
        questions: questions
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({ 
      message: "Quiz updated successfully", 
      quiz: updatedQuiz 
    });
  } catch (error) {
    console.error("Error updating quiz:", error.message);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validationErrors 
      });
    }

    res.status(400).json({ error: error.message });
  }
};

// Delete quiz
const deleteQuiz = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid quiz ID" });
    }

    const quiz = await Quiz.findById(id);
    if (!quiz) {
      return res.status(404).json({ error: "Quiz not found" });
    }

    // Check if quiz is referenced by any lessons
    const lessonsUsingQuiz = await Lesson.find({ quiz: id });
    if (lessonsUsingQuiz.length > 0) {
      return res.status(400).json({ 
        error: `Cannot delete quiz. It is currently used by ${lessonsUsingQuiz.length} lesson(s). Please remove the quiz from those lessons first.` 
      });
    }

    // Delete the quiz
    await Quiz.findByIdAndDelete(id);

    res.status(200).json({
      message: "Quiz deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting quiz:", error.message);
    res.status(500).json({ error: error.message });
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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/library');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Only accept PDF files
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// File filter for images
const imageFilter = (req, file, cb) => {
  // Accept image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// Multer storage for images (memory storage only - no local files saved)
// Images are uploaded directly to Cloudinary, no local storage used
const imageStorage = multer.memoryStorage();
const uploadImage = multer({
  storage: imageStorage, // Memory storage - files are kept in RAM, not saved to disk
  fileFilter: imageFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for images
  }
});

// Configure Cloudinary
const configureCloudinary = () => {
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    console.log('Cloudinary configured successfully');
    return true;
  } else {
    console.warn('Cloudinary not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file');
    return false;
  }
};

// Initialize Cloudinary on module load
configureCloudinary();

// Cloudinary folder structure helper
const CLOUDINARY_FOLDERS = {
  QUIZ_QUESTIONS: 'quiz/question-images',      // Quiz question images/diagrams
  COURSE_THUMBNAILS: 'courses/thumbnails',     // Course thumbnail images
  LESSON_IMAGES: 'lessons/images',              // Lesson images
  TEST_IMAGES: 'tests/images',                 // Test images
  USER_AVATARS: 'users/avatars',               // User profile pictures
  LIBRARY_DOCS: 'library/documents'            // Library document images
};

// Upload library document
const uploadLibraryDocument = async (req, res) => {
  try {
    const { name, priceActual, priceDiscounted, class: documentClass, category } = req.body;
    const file = req.file;

    // Validate required fields
    if (!name || !priceActual || !priceDiscounted || !documentClass || !category) {
      // Delete uploaded file if validation fails
      if (file) {
        fs.unlinkSync(file.path);
      }
      return res.status(400).json({ error: "Name, price (actual and discounted), class, and category are required" });
    }

    if (!file) {
      return res.status(400).json({ error: "PDF file is required" });
    }

    // Construct file URL
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/library/${file.filename}`;

    // Create library document
    const newDocument = new LibraryDocument({
      name: name.trim(),
      price: {
        actual: Number(priceActual),
        discounted: Number(priceDiscounted)
      },
      fileUrl: fileUrl,
      fileName: file.originalname,
      fileSize: file.size,
      class: documentClass.trim(),
      category: category.trim(),
      uploadedBy: req.user?.id || null // If you have auth middleware
    });

    await newDocument.save();

    res.status(201).json({
      message: "Library document uploaded successfully",
      document: newDocument
    });

  } catch (error) {
    console.error("Error uploading library document:", error);
    
    // Delete uploaded file if there's an error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }

    res.status(400).json({
      error: error.message || "Failed to upload library document"
    });
  }
};

// Upload question image/diagram
// IMPORTANT: Images are uploaded directly to Cloudinary - NO local storage
// The Cloudinary URL is returned and stored in the database
const uploadQuestionImage = async (req, res) => {
  try {
    console.log('Upload question image endpoint hit');
    const file = req.file;
    const { questionId } = req.body;
    
    if (!file) {
      return res.status(400).json({ error: "Image file is required" });
    }

    // Check if Cloudinary is configured (REQUIRED - no fallback to local storage)
    const cloudinaryConfigured = 
      process.env.CLOUDINARY_CLOUD_NAME && 
      process.env.CLOUDINARY_API_KEY && 
      process.env.CLOUDINARY_API_SECRET;

    if (!cloudinaryConfigured) {
      console.error('Cloudinary not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.');
      return res.status(500).json({ 
        error: "Cloudinary is not configured. Please set the required environment variables.",
        details: "Images are uploaded directly to Cloudinary. No local storage is used."
      });
    }

    // Upload directly to Cloudinary (NO local file saving)
    try {
      // Convert buffer to base64 data URI for Cloudinary upload
      const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      
      // Upload to Cloudinary with optimized settings
      // Organized folder structure: quiz/question-images
      const uploadResult = await cloudinary.uploader.upload(base64Image, {
        folder: CLOUDINARY_FOLDERS.QUIZ_QUESTIONS, // Organized folder: quiz/question-images
        resource_type: 'image',
        transformation: [
          { quality: 'auto' }, // Automatic quality optimization
          { fetch_format: 'auto' } // Automatic format selection (WebP when supported)
        ],
        overwrite: false, // Don't overwrite existing images
        invalidate: true, // Invalidate CDN cache
        use_filename: true, // Use original filename
        unique_filename: true // Add unique suffix to prevent conflicts
      });
      
      console.log('✅ Image uploaded to Cloudinary successfully');
      console.log('   URL:', uploadResult.secure_url);
      console.log('   Public ID:', uploadResult.public_id);
      console.log('   Size:', uploadResult.bytes, 'bytes');
      
      // Return Cloudinary URL and metadata - these will be stored in the database
      // The imageUrl (Cloudinary secure URL) is what gets stored in the Quiz schema
      res.status(200).json({
        success: true,
        message: "Image uploaded successfully to Cloudinary",
        imageUrl: uploadResult.secure_url, // Cloudinary URL - stored in database
        imagePublicId: uploadResult.public_id, // Optional: for future image management
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        bytes: uploadResult.bytes
      });
    } catch (cloudinaryError) {
      console.error("❌ Cloudinary upload error:", cloudinaryError);
      return res.status(500).json({
        error: "Failed to upload image to Cloudinary",
        details: cloudinaryError.message
      });
    }
    
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(400).json({
      error: error.message || "Failed to upload image"
    });
  }
};

// Get all library documents
const getLibraryDocuments = async (req, res) => {
  try {
    const documents = await LibraryDocument.find()
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 }) // Latest first
      .exec();
    
    res.status(200).json(documents);
  } catch (error) {
    console.error("Error fetching library documents:", error);
    res.status(500).json({ 
      error: error.message || "Failed to fetch library documents" 
    });
  }
};

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    // Get counts for all entities
    const [coursesCount, modulesCount, lessonsCount, quizzesCount, testsCount, studentsCount] = await Promise.all([
      Course.countDocuments(),
      Module.countDocuments(),
      Lesson.countDocuments(),
      Quiz.countDocuments(),
      Test.countDocuments(),
      User.countDocuments({ role: "student" })
    ]);

    res.status(200).json({
      stats: {
        courses: coursesCount,
        modules: modulesCount,
        lessons: lessonsCount,
        quizzes: quizzesCount,
        tests: testsCount,
        students: studentsCount
      }
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ 
      error: error.message || "Failed to fetch dashboard statistics" 
    });
  }
};

// Get recent activities
const getRecentActivities = async (req, res) => {
  try {
    const limit = 5; // Get 5 most recent activities

    // Fetch recent items from each collection
    const [recentCourses, recentModules, recentLessons, recentQuizzes, recentTests] = await Promise.all([
      Course.find().sort({ createdAt: -1 }).limit(limit).select('title createdAt').lean(),
      Module.find().sort({ createdAt: -1 }).limit(limit).select('title createdAt').lean(),
      Lesson.find().sort({ createdAt: -1 }).limit(limit).select('title createdAt').lean(),
      Quiz.find().sort({ createdAt: -1 }).limit(limit).select('title createdAt').lean(),
      Test.find().sort({ createdAt: -1 }).limit(limit).select('title createdAt').lean()
    ]);

    // Transform and combine all activities
    const activities = [
      ...recentCourses.map(item => ({
        id: item._id.toString(),
        action: 'Course added',
        name: item.title,
        time: item.createdAt,
        type: 'course'
      })),
      ...recentModules.map(item => ({
        id: item._id.toString(),
        action: 'Module updated',
        name: item.title,
        time: item.createdAt,
        type: 'module'
      })),
      ...recentLessons.map(item => ({
        id: item._id.toString(),
        action: 'Lesson edited',
        name: item.title,
        time: item.createdAt,
        type: 'lesson'
      })),
      ...recentQuizzes.map(item => ({
        id: item._id.toString(),
        action: 'Quiz published',
        name: item.title,
        time: item.createdAt,
        type: 'quiz'
      })),
      ...recentTests.map(item => ({
        id: item._id.toString(),
        action: 'Test created',
        name: item.title,
        time: item.createdAt,
        type: 'test'
      }))
    ];

    // Sort by time (most recent first) and limit to 5
    const sortedActivities = activities
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, limit)
      .map(activity => {
        // Format time as relative time
        const timeDiff = Date.now() - new Date(activity.time).getTime();
        const minutes = Math.floor(timeDiff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        let timeString;
        if (minutes < 60) {
          timeString = `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
        } else if (hours < 24) {
          timeString = `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
        } else {
          timeString = `${days} ${days === 1 ? 'day' : 'days'} ago`;
        }

        return {
          id: activity.id,
          action: activity.action,
          name: activity.name,
          time: timeString,
          type: activity.type
        };
      });

    res.status(200).json({ activities: sortedActivities });
  } catch (error) {
    console.error("Error fetching recent activities:", error);
    res.status(500).json({ 
      error: error.message || "Failed to fetch recent activities" 
    });
  }
};
  


  module.exports = {
    addCourse,
    addLesson,
    updateLesson,
    deleteLesson,
    addModule,
    updateModule,
    deleteModule,
    addTest,
    addQuiz,
    updateQuiz,
    deleteQuiz,
    getQuiz,
    getLesson,
    getLessonById,
    getModules,
    getModuleById,
    getTests,
    getTestById,
    getCourses,
    getCourseById,
    updateCourse,
    deleteCourse,
    uploadLibraryDocument,
    getLibraryDocuments,
    getDashboardStats,
    getRecentActivities,
    upload, // Export multer upload middleware
    uploadImage, // Export image upload middleware
    uploadQuestionImage
  }