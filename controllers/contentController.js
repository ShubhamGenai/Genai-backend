const mongoose = require("mongoose");
const Course = require("../models/courseModel/courseModel");
const Lesson = require("../models/courseModel/lessons");
const Quiz = require("../models/courseModel/quiz");
const Module = require("../models/courseModel/module");
const Test = require("../models/testModel/testModel");
const LibraryDocument = require("../models/libraryModel");
const LibraryCategory = require("../models/libraryCategoryModel");
const LibraryClass = require("../models/libraryClassModel");
const User = require("../models/UserModel");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;
const Anthropic = require("@anthropic-ai/sdk");
const pdfParse = require("pdf-parse");
const { fromBuffer } = require("pdf2pic");

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

// Helper function to robustly parse JSON from Claude responses
const parseClaudeJSON = (claudeResponse) => {
  let jsonText = claudeResponse.trim();
  
  // Remove markdown code blocks if present
  if (jsonText.includes('```json')) {
    const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }
  } else if (jsonText.includes('```')) {
    const codeMatch = jsonText.match(/```\s*([\s\S]*?)\s*```/);
    if (codeMatch) {
      jsonText = codeMatch[1].trim();
    }
  }
  
  // Try to find JSON array in the response (in case there's extra text)
  const jsonArrayMatch = jsonText.match(/\[[\s\S]*\]/);
  if (jsonArrayMatch) {
    jsonText = jsonArrayMatch[0];
  }
  
  // Try to fix common JSON errors
  try {
    // First, try direct parsing
    return JSON.parse(jsonText);
  } catch (firstError) {
    console.log('⚠️ First JSON parse attempt failed, trying to fix common errors...');
    
    // Try to fix common JSON issues
    let fixedJson = jsonText;
    
    // Remove trailing commas before closing brackets/braces
    fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');
    
    // Fix incomplete fields (e.g., "answer": without value)
    // Pattern: field name followed by colon but no value before comma or closing brace
    fixedJson = fixedJson.replace(/("(?:questionText|options|answer|imageUrl|marks)"\s*:\s*)(?=\s*[,}])/g, (match, field) => {
      // If it's answer field, try to infer from context or use empty string
      if (field.includes('answer')) {
        return field + '""';
      }
      // For other fields, provide appropriate defaults
      if (field.includes('options')) {
        return field + '[]';
      }
      if (field.includes('marks')) {
        return field + '1';
      }
      return field + '""';
    });
    
    // Try parsing again
    try {
      return JSON.parse(fixedJson);
    } catch (secondError) {
      console.log('⚠️ Second JSON parse attempt failed, trying to extract valid question objects...');
      
      // Try to extract complete question objects using a more sophisticated approach
      try {
        const questions = [];
        let depth = 0;
        let inString = false;
        let escapeNext = false;
        let currentObj = '';
        let braceCount = 0;
        
        // Find all complete question objects by tracking braces
        for (let i = 0; i < fixedJson.length; i++) {
          const char = fixedJson[i];
          
          if (escapeNext) {
            escapeNext = false;
            currentObj += char;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            currentObj += char;
            continue;
          }
          
          if (char === '"' && !escapeNext) {
            inString = !inString;
            currentObj += char;
            continue;
          }
          
          if (!inString) {
            if (char === '{') {
              if (braceCount === 0) {
                currentObj = '{';
              } else {
                currentObj += char;
              }
              braceCount++;
            } else if (char === '}') {
              currentObj += char;
              braceCount--;
              
              if (braceCount === 0) {
                // We have a complete object, try to parse it
                try {
                  const question = JSON.parse(currentObj);
                  // Validate it has required fields
                  if (question.questionText && Array.isArray(question.options) && question.options.length > 0) {
                    // Ensure answer exists, if not use first option
                    if (!question.answer || question.answer.trim() === '') {
                      question.answer = question.options[0];
                    }
                    // Ensure other fields exist
                    question.imageUrl = question.imageUrl || '';
                    question.marks = question.marks || 1;
                    questions.push(question);
                  }
                } catch (e) {
                  // Skip invalid objects
                }
                currentObj = '';
              }
            } else {
              if (braceCount > 0) {
                currentObj += char;
              }
            }
          } else {
            currentObj += char;
          }
        }
        
        if (questions.length > 0) {
          console.log(`✅ Extracted ${questions.length} valid questions from malformed JSON`);
          return questions;
        }
      } catch (extractError) {
        console.log('⚠️ Object extraction failed:', extractError.message);
      }
      
      // Try to truncate at error position and parse partial JSON
      try {
        const errorPosMatch = firstError.message.match(/position (\d+)/);
        if (errorPosMatch) {
          const errorPos = parseInt(errorPosMatch[1]);
          // Try to find the last complete question object before the error
          // Look backwards from error position to find a complete object
          let truncatePos = errorPos;
          let braceCount = 0;
          let foundStart = false;
          
          // Find the start of the last complete object
          for (let i = errorPos - 1; i >= 0; i--) {
            if (fixedJson[i] === '}') {
              braceCount++;
            } else if (fixedJson[i] === '{') {
              braceCount--;
              if (braceCount === 0) {
                truncatePos = i;
                foundStart = true;
                break;
              }
            }
          }
          
          if (foundStart) {
            // Find the matching closing brace
            braceCount = 1;
            for (let i = truncatePos + 1; i < errorPos; i++) {
              if (fixedJson[i] === '{') braceCount++;
              if (fixedJson[i] === '}') braceCount--;
              if (braceCount === 0) {
                truncatePos = i + 1;
                break;
              }
            }
            
            // Truncate and try to parse
            const truncatedJson = fixedJson.substring(0, truncatePos) + ']';
            try {
              const partialQuestions = JSON.parse(truncatedJson);
              if (Array.isArray(partialQuestions) && partialQuestions.length > 0) {
                console.log(`✅ Parsed ${partialQuestions.length} questions by truncating at error position`);
                return partialQuestions;
              }
            } catch (e) {
              // Continue to next fallback
            }
          }
        }
      } catch (truncateError) {
        // Continue to regex fallback
      }
      
      // Last resort: try to find and parse individual complete objects using regex
      try {
        // Match complete objects that have questionText and options
        const objectPattern = /\{\s*"questionText"\s*:\s*"[^"]*"\s*,\s*"options"\s*:\s*\[[^\]]*\]\s*,\s*"answer"\s*:\s*"[^"]*"[^}]*\}/g;
        const matches = fixedJson.match(objectPattern);
        if (matches && matches.length > 0) {
          const questions = [];
          for (const match of matches) {
            try {
              // Clean up the match - remove incomplete trailing fields
              let cleanMatch = match.replace(/,\s*"[^"]*"\s*:\s*(?=,|\})/g, '');
              cleanMatch = cleanMatch.replace(/,(\s*\})/g, '$1');
              
              const question = JSON.parse(cleanMatch);
              if (question.questionText && Array.isArray(question.options) && question.options.length > 0) {
                if (!question.answer || question.answer.trim() === '') {
                  question.answer = question.options[0];
                }
                question.imageUrl = question.imageUrl || '';
                question.marks = question.marks || 1;
                questions.push(question);
              }
            } catch (e) {
              // Skip invalid objects
            }
          }
          if (questions.length > 0) {
            console.log(`✅ Extracted ${questions.length} valid questions using regex fallback`);
            return questions;
          }
        }
      } catch (regexError) {
        // Continue to final error
      }
      
      // If all else fails, throw the original error with context
      const errorPos = firstError.message.match(/position (\d+)/)?.[1] || 'unknown';
      const contextStart = Math.max(0, parseInt(errorPos) - 100);
      const contextEnd = Math.min(fixedJson.length, parseInt(errorPos) + 100);
      const errorContext = fixedJson.substring(contextStart, contextEnd);
      
      throw new Error(`JSON parsing failed: ${firstError.message}. Position: ${errorPos}. Context: ...${errorContext}...`);
    }
  }
};

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
      price,
      level,
      category,
      features,
      skills,
      certificate,
      quizzes,
      passingScore,
      image, // Test image URL from Cloudinary
      imagePublicId, // Test image public ID from Cloudinary
      ratings = [], // optional: handle if ratings are not provided
      isFree = false
    } = req.body;

    let quizIds = [];
    let totalMarks = 0;

    // Normalize pricing based on isFree flag
    const isTestFree = Boolean(isFree);
    const actual = price?.actual;
    const discounted = price?.discounted;

    // Validate required fields
    if (!title || !company || !description || !duration || !numberOfQuestions || !level) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // For paid tests, ensure both prices are provided and valid
    if (!isTestFree) {
      if (actual === undefined || actual === null || actual === "" || isNaN(Number(actual)) || Number(actual) < 0) {
        return res.status(400).json({ error: "Actual price is required and must be a valid number for paid tests" });
      }
      if (discounted === undefined || discounted === null || discounted === "" || isNaN(Number(discounted)) || Number(discounted) < 0) {
        return res.status(400).json({ error: "Discounted price is required and must be a valid number for paid tests" });
      }
    }

    // Resolve final price values
    const finalActual = isTestFree ? 0 : Number(actual || 0);
    const finalDiscounted = isTestFree ? 0 : Number(discounted || 0);

    if (Number.isNaN(finalActual) || Number.isNaN(finalDiscounted)) {
      return res.status(400).json({ error: "Invalid price values" });
    }

    // Save multiple quizzes and calculate total marks
    for (const quizData of quizzes) {
      // Always strip _id to avoid duplicate key errors if frontend
      // accidentally sends an existing quiz _id for a new quiz
      const { _id, ...quizWithoutId } = quizData || {};
      const newQuiz = new Quiz(quizWithoutId);
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
        actual: finalActual,
        discounted: finalDiscounted
      },
      isFree: isTestFree,
      image: image || undefined, // Use provided image URL or default from schema
      imagePublicId: imagePublicId || undefined, // Store Cloudinary public ID if provided
      category: category || undefined,
      level,
      features: features || [],
      skills: skills || [],
      certificate: certificate !== undefined ? certificate : true,
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

// Update test
const updateTest = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid test ID" });
    }

    const existingTest = await Test.findById(id);
    if (!existingTest) {
      return res.status(404).json({ error: "Test not found" });
    }

    const {
      title,
      company,
      description,
      duration,
      numberOfQuestions,
      price,
      level,
      category,
      features,
      skills,
      certificate,
      quizzes,
      passingScore,
      image,
      imagePublicId,
      isFree = false
    } = req.body;

    let quizIds = [];
    let totalMarks = 0;

    // Normalize pricing based on isFree flag
    const isTestFree = Boolean(isFree);
    const actual = price?.actual;
    const discounted = price?.discounted;

    // Validate required fields
    if (!title || !company || !description || !duration || !numberOfQuestions || !level) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // For paid tests, ensure both prices are provided and valid
    if (!isTestFree) {
      if (actual === undefined || actual === null || actual === "" || isNaN(Number(actual)) || Number(actual) < 0) {
        return res.status(400).json({ error: "Actual price is required and must be a valid number for paid tests" });
      }
      if (discounted === undefined || discounted === null || discounted === "" || isNaN(Number(discounted)) || Number(discounted) < 0) {
        return res.status(400).json({ error: "Discounted price is required and must be a valid number for paid tests" });
      }
    }

    // Resolve final price values
    const finalActual = isTestFree ? 0 : Number(actual || 0);
    const finalDiscounted = isTestFree ? 0 : Number(discounted || 0);

    if (Number.isNaN(finalActual) || Number.isNaN(finalDiscounted)) {
      return res.status(400).json({ error: "Invalid price values" });
    }

    // Handle quizzes - create new ones or update existing
    if (quizzes && Array.isArray(quizzes)) {
      for (const quizData of quizzes) {
        // If quiz has _id, it's an existing quiz - update it
        if (quizData._id && mongoose.Types.ObjectId.isValid(quizData._id)) {
          const existingQuiz = await Quiz.findById(quizData._id);
          if (existingQuiz) {
            // Update existing quiz
            existingQuiz.title = quizData.title || existingQuiz.title;
            existingQuiz.duration = quizData.duration || existingQuiz.duration;
            existingQuiz.questions = quizData.questions || existingQuiz.questions;
            await existingQuiz.save();
            quizIds.push(existingQuiz._id);
            totalMarks += (quizData.questions?.length || existingQuiz.questions?.length || 0) * 10;
          }
        } else {
          // New quiz - create it (strip any _id to avoid duplicate key errors)
          const { _id, ...quizWithoutId } = quizData || {};
          const newQuiz = new Quiz(quizWithoutId);
          await newQuiz.save();
          quizIds.push(newQuiz._id);
          totalMarks += (quizData.questions?.length || 0) * 10;
        }
      }
    } else {
      // If no quizzes provided, keep existing ones
      quizIds = existingTest.quizzes || [];
      totalMarks = existingTest.totalMarks || 0;
    }

    // Preserve ratings and reviews
    const ratings = existingTest.ratings || [];
    let averageRating = existingTest.averageRating || 0;
    const totalReviews = ratings.length;
    if (totalReviews > 0) {
      const total = ratings.reduce((sum, r) => sum + r.rating, 0);
      averageRating = total / totalReviews;
    }

    // Update the test
    const updatedTest = await Test.findByIdAndUpdate(
      id,
      {
        title,
        company,
        description,
        duration: Number(duration),
        numberOfQuestions: Number(numberOfQuestions),
        price: {
          actual: finalActual,
          discounted: finalDiscounted
        },
        isFree: isTestFree,
        image: image !== undefined ? image : existingTest.image,
        imagePublicId: imagePublicId !== undefined ? imagePublicId : existingTest.imagePublicId,
        category: category !== undefined ? category : existingTest.category,
        level,
        features: features || [],
        skills: skills || [],
        certificate: certificate !== undefined ? certificate : existingTest.certificate,
        quizzes: quizIds,
        passingScore: passingScore !== undefined ? Number(passingScore) : existingTest.passingScore,
        totalMarks,
        ratings,
        averageRating,
        totalReviews
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({ 
      message: "Test updated successfully", 
      test: updatedTest 
    });
  } catch (error) {
    console.error("Error updating test:", error);
    res.status(400).json({ 
      error: error.message || "Failed to update test" 
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

// Delete test by ID
const deleteTest = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid test ID" });
    }

    const test = await Test.findById(id);
    if (!test) {
      return res.status(404).json({ error: "Test not found" });
    }

    // Delete associated quizzes
    if (test.quizzes && test.quizzes.length > 0) {
      for (const quizId of test.quizzes) {
        await Quiz.findByIdAndDelete(quizId);
      }
    }

    // Delete the test
    await Test.findByIdAndDelete(id);

    res.status(200).json({ 
      message: "Test deleted successfully",
      deletedTestId: id 
    });
  } catch (error) {
    console.error("Error deleting test:", error);
    res.status(500).json({ error: error.message || "Failed to delete test" });
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
      if (!q.options || !Array.isArray(q.options)) {
        return res.status(400).json({ error: `Question ${i + 1}: Options must be an array.` });
      }
      
      // Filter and trim options first (same logic as when saving)
      const validOptions = q.options
        .map(opt => String(opt).trim())
        .filter(opt => opt !== '');
      
      if (validOptions.length < 2) {
        return res.status(400).json({ error: `Question ${i + 1}: At least 2 valid options are required.` });
      }
      
      if (!q.answer || String(q.answer).trim() === '') {
        return res.status(400).json({ error: `Question ${i + 1}: Correct answer is required.` });
      }
      
      // Trim answer and check if it matches one of the valid (filtered) options
      const trimmedAnswer = String(q.answer).trim();
      if (!validOptions.includes(trimmedAnswer)) {
        return res.status(400).json({ 
          error: `Question ${i + 1}: Answer "${trimmedAnswer}" must match one of the options: ${validOptions.join(', ')}` 
        });
      }
    }

    // ✅ Save the quiz
    const newQuiz = new Quiz({ 
      title: title.trim(), 
      duration: parseInt(duration), 
      questions: questions.map(q => {
        // Use the same filtering logic as validation
        const validOptions = q.options
          .map(opt => String(opt).trim())
          .filter(opt => opt !== '');
        
        return {
          questionText: String(q.questionText).trim(),
          passage: (q.passage !== null && q.passage !== undefined) ? String(q.passage) : '', // Preserve passage formatting (line breaks, paragraphs) - don't trim to maintain formatting
          options: validOptions,
          answer: String(q.answer).trim(),
          imageUrl: (q.imageUrl && String(q.imageUrl).trim()) ? String(q.imageUrl).trim() : '',
          marks: q.marks && !isNaN(parseInt(q.marks)) ? parseInt(q.marks) : 1
        };
      })
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
// For library documents: Use memory storage (for Cloudinary upload)
// Files are uploaded directly to Cloudinary, no local storage needed
const libraryStorage = multer.memoryStorage();

// Legacy disk storage (kept for backward compatibility if needed)
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

// Multer for library documents - uses memory storage for Cloudinary upload
const upload = multer({
  storage: libraryStorage, // Memory storage - files are kept in RAM for Cloudinary upload
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Legacy disk storage multer (kept for backward compatibility if needed)
const uploadDisk = multer({
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

// Multer storage for PDF parsing (memory storage - files kept in RAM for processing)
const pdfMemoryStorage = multer.memoryStorage();
const pdfUpload = multer({
  storage: pdfMemoryStorage, // Memory storage - files are kept in RAM, not saved to disk
  fileFilter: fileFilter, // Use the same PDF file filter
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for PDFs
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

// Upload library document - Uploads PDF to Cloudinary and saves link to database
const uploadLibraryDocument = async (req, res) => {
  try {
    const { 
      name, 
      priceActual, 
      priceDiscounted, 
      class: documentClass, 
      category,
      description,
      whatsIncluded,
      bestFor,
      prerequisites,
      support,
      icon,
      format
    } = req.body;
    const file = req.file;

    // Validate required fields
    if (!name || !priceActual || !priceDiscounted || !documentClass || !category) {
      return res.status(400).json({ error: "Name, price (actual and discounted), class, and category are required" });
    }

    if (!file) {
      return res.status(400).json({ error: "PDF file is required" });
    }

    // Parse whatsIncluded if it's a JSON string
    let whatsIncludedArray = [];
    if (whatsIncluded) {
      try {
        whatsIncludedArray = typeof whatsIncluded === 'string' 
          ? JSON.parse(whatsIncluded) 
          : Array.isArray(whatsIncluded) 
            ? whatsIncluded 
            : [];
      } catch (e) {
        // If parsing fails, try splitting by newline
        whatsIncludedArray = whatsIncluded.split('\n').filter(item => item.trim());
      }
    }

    // Check if Cloudinary is configured
    const cloudinaryConfigured = 
      process.env.CLOUDINARY_CLOUD_NAME && 
      process.env.CLOUDINARY_API_KEY && 
      process.env.CLOUDINARY_API_SECRET;

    if (!cloudinaryConfigured) {
      console.error('Cloudinary not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.');
      return res.status(500).json({ 
        error: "Cloudinary is not configured. Please set the required environment variables.",
        details: "PDFs are uploaded directly to Cloudinary. No local storage is used."
      });
    }

    // Upload PDF directly to Cloudinary (NO local file saving)
    try {
      // Convert buffer to base64 data URI for Cloudinary upload
      const base64Pdf = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      
      // Upload to Cloudinary with organized folder structure: library/documents
      const uploadResult = await cloudinary.uploader.upload(base64Pdf, {
        folder: CLOUDINARY_FOLDERS.LIBRARY_DOCS, // Organized folder: library/documents
        resource_type: 'raw', // PDF files use 'raw' resource type
        overwrite: false, // Don't overwrite existing files
        invalidate: true, // Invalidate CDN cache
        use_filename: true, // Use original filename
        unique_filename: true // Add unique suffix to prevent conflicts
      });
      
      console.log('✅ PDF uploaded to Cloudinary successfully');
      console.log('   URL:', uploadResult.secure_url);
      console.log('   Public ID:', uploadResult.public_id);
      console.log('   Size:', uploadResult.bytes, 'bytes');

      // Create library document with Cloudinary URL
      const newDocument = new LibraryDocument({
        name: name.trim(),
        price: {
          actual: Number(priceActual),
          discounted: Number(priceDiscounted)
        },
        fileUrl: uploadResult.secure_url, // Cloudinary URL - stored in database
        fileName: file.originalname,
        fileSize: uploadResult.bytes || file.size,
        class: documentClass.trim(),
        category: category.trim(),
        uploadedBy: req.user?.id || null,
        description: description ? description.trim() : "",
        whatsIncluded: whatsIncludedArray,
        additionalInfo: {
          bestFor: bestFor ? bestFor.trim() : "",
          prerequisites: prerequisites ? prerequisites.trim() : "",
          support: support ? support.trim() : ""
        },
        icon: icon ? icon.trim() : "FileText",
        format: format ? format.trim() : "PDF"
      });

      await newDocument.save();

      res.status(201).json({
        success: true,
        message: "Library document uploaded successfully to Cloudinary",
        document: newDocument
      });

    } catch (cloudinaryError) {
      console.error("❌ Cloudinary upload error:", cloudinaryError);
      return res.status(500).json({
        error: "Failed to upload PDF to Cloudinary",
        details: cloudinaryError.message
      });
    }

  } catch (error) {
    console.error("Error uploading library document:", error);
    res.status(400).json({
      error: error.message || "Failed to upload library document"
    });
  }
};

// Add library category
const addLibraryCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Category name is required" });
    }

    const categoryName = name.trim();
    const categoryNameLower = categoryName.toLowerCase();

    // Check if category already exists (case-insensitive)
    const existingCategory = await LibraryCategory.findOne({ name: categoryNameLower });
    if (existingCategory) {
      return res.status(400).json({ error: "Category already exists" });
    }

    // Create new category
    const newCategory = new LibraryCategory({
      name: categoryNameLower,
      displayName: categoryName, // Store original case for display
      createdBy: req.user?.id || null
    });

    await newCategory.save();

    res.status(201).json({
      success: true,
      message: "Category added successfully",
      category: {
        _id: newCategory._id,
        name: newCategory.displayName, // Return display name
        createdAt: newCategory.createdAt
      }
    });

  } catch (error) {
    console.error("Error adding library category:", error);
    res.status(400).json({
      error: error.message || "Failed to add category"
    });
  }
};

// Get all library categories
const getLibraryCategories = async (req, res) => {
  try {
    const categories = await LibraryCategory.find({ isActive: true })
      .sort({ displayName: 1 }) // Sort alphabetically by display name
      .select('_id name displayName createdAt')
      .lean();

    // Return display names for frontend
    const formattedCategories = categories.map(cat => ({
      _id: cat._id,
      name: cat.displayName, // Return display name
      createdAt: cat.createdAt
    }));

    res.status(200).json({
      success: true,
      categories: formattedCategories
    });

  } catch (error) {
    console.error("Error fetching library categories:", error);
    res.status(500).json({
      error: error.message || "Failed to fetch categories"
    });
  }
};

// Add library class (e.g. "Class 11", "Class 12", "Common")
const addLibraryClass = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Class name is required" });
    }

    const className = name.trim();
    const classNameLower = className.toLowerCase();

    // Check if class already exists (case-insensitive)
    const existingClass = await LibraryClass.findOne({ name: classNameLower });
    if (existingClass) {
      return res.status(400).json({ error: "Class already exists" });
    }

    // Create new class
    const newClass = new LibraryClass({
      name: classNameLower,
      displayName: className,
      createdBy: req.user?.id || null
    });

    await newClass.save();

    res.status(201).json({
      success: true,
      message: "Class added successfully",
      classItem: {
        _id: newClass._id,
        name: newClass.displayName,
        createdAt: newClass.createdAt
      }
    });
  } catch (error) {
    console.error("Error adding library class:", error);
    res.status(400).json({
      error: error.message || "Failed to add class"
    });
  }
};

// Get all library classes
const getLibraryClasses = async (req, res) => {
  try {
    const classes = await LibraryClass.find({ isActive: true })
      .sort({ displayName: 1 })
      .select("_id name displayName createdAt")
      .lean();

    const formattedClasses = classes.map((cls) => ({
      _id: cls._id,
      name: cls.displayName,
      createdAt: cls.createdAt
    }));

    res.status(200).json({
      success: true,
      classes: formattedClasses
    });
  } catch (error) {
    console.error("Error fetching library classes:", error);
    res.status(500).json({
      error: error.message || "Failed to fetch classes"
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

// Get existing test images (for re-use in test creation)
// Returns recent distinct test images with basic metadata
const getTestImages = async (req, res) => {
  try {
    // Find tests that have an image set
    const testsWithImages = await Test.find(
      { image: { $exists: true, $ne: null } },
      { image: 1, imagePublicId: 1, title: 1, createdAt: 1 }
    )
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    // Map to a simple image list and de-duplicate by URL
    const seen = new Set();
    const images = [];

    for (const t of testsWithImages) {
      if (!t.image || seen.has(t.image)) continue;
      seen.add(t.image);
      images.push({
        imageUrl: t.image,
        imagePublicId: t.imagePublicId || null,
        title: t.title || "Test image",
        createdAt: t.createdAt,
      });
    }

    return res.status(200).json({
      success: true,
      images,
      count: images.length,
    });
  } catch (error) {
    console.error("Error fetching test images:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch test images",
    });
  }
};

// Upload test image/diagram
// IMPORTANT: Images are uploaded directly to Cloudinary - NO local storage
// The Cloudinary URL is returned and stored in the database
const uploadTestImage = async (req, res) => {
  try {
    console.log('Upload test image endpoint hit');
    const file = req.file;
    const { testId } = req.body;
    
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
      // Organized folder structure: tests/images
      const uploadResult = await cloudinary.uploader.upload(base64Image, {
        folder: CLOUDINARY_FOLDERS.TEST_IMAGES, // Organized folder: tests/images
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
      
      console.log('✅ Test image uploaded to Cloudinary successfully');
      console.log('   URL:', uploadResult.secure_url);
      console.log('   Public ID:', uploadResult.public_id);
      console.log('   Size:', uploadResult.bytes, 'bytes');
      
      // Return Cloudinary URL and metadata - these will be stored in the database
      // The imageUrl (Cloudinary secure URL) is what gets stored in the Test schema
      res.status(200).json({
        success: true,
        message: "Test image uploaded successfully to Cloudinary",
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
    console.error("Error uploading test image:", error);
    res.status(400).json({
      error: error.message || "Failed to upload test image"
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

// Initialize Anthropic (Claude) client
let anthropic = null;
const DEFAULT_CLAUDE_MODEL = process.env.CLAUDE_MODEL_NAME || "claude-3-sonnet-20240229";

if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  console.log('✅ Anthropic (Claude) API initialized');
  console.log(`   Default model: ${DEFAULT_CLAUDE_MODEL}`);
} else {
  console.warn('⚠️ ANTHROPIC_API_KEY not found. PDF parsing with Claude will not work.');
}

// Parse PDF and generate quiz questions using Claude API
const parsePdf = async (req, res) => {
  try {
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: "PDF file is required" });
    }

    if (!anthropic) {
      return res.status(500).json({ 
        error: "Claude API is not configured. Please set ANTHROPIC_API_KEY in environment variables." 
      });
    }

    console.log('📄 Starting PDF parsing...');
    console.log('   File:', file.originalname);
    console.log('   Size:', file.size, 'bytes');

    // Extract text from PDF
    let pdfText = '';
    try {
      // Check if buffer exists (should exist with memoryStorage)
      if (!file || !file.buffer) {
        throw new Error('PDF file buffer is missing. Make sure the file was uploaded correctly.');
      }
      
      if (file.buffer.length === 0) {
        throw new Error('PDF file buffer is empty');
      }
      
      console.log('📄 Parsing PDF buffer...');
      console.log('   Buffer type:', file.buffer.constructor.name);
      console.log('   Buffer length:', file.buffer.length, 'bytes');
      console.log('   File mimetype:', file.mimetype);
      
      // pdf-parse v1.1.1 accepts Buffer directly, but let's ensure it's valid
      // If it's already a Buffer, use it directly; otherwise convert
      let pdfBuffer = file.buffer;
      
      // Ensure it's a Buffer (multer memoryStorage provides Buffer)
      if (!Buffer.isBuffer(pdfBuffer)) {
        // If not a Buffer, try to convert
        if (pdfBuffer instanceof Uint8Array) {
          pdfBuffer = Buffer.from(pdfBuffer);
        } else {
          pdfBuffer = Buffer.from(pdfBuffer);
        }
      }
      
      // pdf-parse should accept Buffer directly
      // Try with different options to extract text more aggressively
      let pdfData;
      try {
        // First try with default options
        pdfData = await pdfParse(pdfBuffer);
      } catch (firstError) {
        console.warn('⚠️ First parse attempt failed, trying with options:', firstError.message);
        // Try with explicit options
        pdfData = await pdfParse(pdfBuffer, {
          max: 0, // Parse all pages
        });
      }
      
      pdfText = pdfData.text || '';
      
      console.log('✅ PDF parsed successfully');
      console.log('   Pages:', pdfData.numpages);
      console.log('   Text length:', pdfText.length, 'characters');
      console.log('   Text preview (first 500 chars):', pdfText.substring(0, 500));
      console.log('   Has text:', pdfText.trim().length > 0);
      
      // Check if text extraction was successful
      if (!pdfText || pdfText.trim().length === 0) {
        console.warn('⚠️ PDF text extraction returned empty text');
        console.warn('   This might be an image-based PDF (scanned document)');
        console.warn('   PDF info:', {
          numpages: pdfData.numpages,
          info: pdfData.info,
          metadata: pdfData.metadata
        });
        
        // For image-based PDFs, convert pages to images and use Claude Vision API
        console.log('📸 PDF appears to be image-based (scanned document)');
        console.log('   Converting PDF pages to images and using Claude Vision API for OCR...');
        
        try {
          // Create temporary directory for images
          const tempDir = path.join(__dirname, '../temp/pdf-images');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          // Save PDF buffer to temp file (for pdf2pic)
          const tempPdfPath = path.join(tempDir, `temp_${Date.now()}.pdf`);
          fs.writeFileSync(tempPdfPath, pdfBuffer);
          
          // Convert PDF to images using pdf2pic
          const convert = fromBuffer(pdfBuffer, {
            density: 300,           // Higher DPI for better OCR accuracy
            saveFilename: "page",
            savePath: tempDir,
            format: "png",
            width: 2000,            // High resolution for better text recognition
            height: 2000
          });
          
          const totalPages = pdfData.numpages || 1;
          const extractedTexts = [];
          
          console.log(`   Processing ${totalPages} page(s)...`);
          
          // Process each page (limit to first 10 pages to avoid timeout)
          const maxPages = Math.min(totalPages, 10);
          for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
            try {
              console.log(`   Processing page ${pageNum}/${maxPages}...`);
              
              // Convert page to image
              let imageBase64 = null;
              
              try {
                const imageResult = await convert(pageNum, { responseType: "base64" });
                if (imageResult && imageResult.base64) {
                  imageBase64 = imageResult.base64;
                }
              } catch (convertError) {
                console.warn(`   ⚠️ Base64 conversion failed, trying file read:`, convertError.message);
              }
              
              // Fallback: read from saved file
              if (!imageBase64) {
                const imagePath = path.join(tempDir, `page.${pageNum}.png`);
                if (fs.existsSync(imagePath)) {
                  const imageBuffer = fs.readFileSync(imagePath);
                  imageBase64 = imageBuffer.toString('base64');
                } else {
                  console.warn(`   ⚠️ Failed to convert page ${pageNum} to image`);
                  continue;
                }
              }
              
              if (!imageBase64) {
                console.warn(`   ⚠️ No image data for page ${pageNum}`);
                continue;
              }
              
              // Use Claude Vision API to extract text from the image
              // Try different models in order of preference
              // Start with the configured model, then fallback to others
              const visionModels = [
                DEFAULT_CLAUDE_MODEL,        // User-configured or default
                "claude-3-sonnet-20240229",  // Standard Sonnet 3
                "claude-3-opus-20240229",    // Most capable
                "claude-3-haiku-20240307"   // Fastest
              ];
              
              let visionMessage = null;
              let visionError = null;
              
              for (const visionModel of visionModels) {
                try {
                  console.log(`   Trying vision model: ${visionModel}`);
                  visionMessage = await anthropic.messages.create({
                    model: visionModel,
                    max_tokens: 4096,
                    messages: [{
                      role: "user",
                      content: [
                        {
                          type: "text",
                          text: `Extract ALL text from this image. This is page ${pageNum} of a NEET question paper containing questions in both Hindi and English languages.

Extract:
1. All question text (preserve both Hindi and English text exactly as shown)
2. All options for each question (A, B, C, D, etc.)
3. Any formulas or mathematical expressions
4. All visible text content

Return the extracted text exactly as it appears in the image. Preserve the structure and formatting.`
                        },
                        {
                          type: "image",
                          source: {
                            type: "base64",
                            media_type: "image/png",
                            data: imageBase64
                          }
                        }
                      ]
                    }]
                  });
                  console.log(`   ✅ Vision model ${visionModel} succeeded`);
                  break; // Success, exit loop
                } catch (err) {
                  visionError = err;
                  console.warn(`   ⚠️ Vision model ${visionModel} failed:`, err.message);
                  // Continue to next model
                }
              }
              
              if (!visionMessage) {
                throw new Error(`All vision models failed. Last error: ${visionError?.message || 'Unknown error'}`);
              }
              
              const pageText = visionMessage.content[0].text;
              
              // Check if we got valid text
              if (!pageText || pageText.trim().length === 0) {
                console.warn(`   ⚠️ Page ${pageNum}: Claude Vision returned empty text`);
                // Still add it to the array so we know the page was processed
                extractedTexts.push(`\n\n--- Page ${pageNum} ---\n\n[No text extracted from this page]`);
              } else {
                extractedTexts.push(`\n\n--- Page ${pageNum} ---\n\n${pageText}`);
                console.log(`   ✅ Page ${pageNum} processed: ${pageText.length} characters extracted`);
              }
              
              // Clean up the image file if it exists
              const imagePath = path.join(tempDir, `page.${pageNum}.png`);
              if (fs.existsSync(imagePath)) {
                try {
                  fs.unlinkSync(imagePath);
                } catch (unlinkError) {
                  // Ignore cleanup errors
                }
              }
              
            } catch (pageError) {
              console.error(`   ❌ Error processing page ${pageNum}:`, pageError.message);
              console.error(`   Error details:`, pageError.stack);
              // Continue with next page - don't fail completely if one page fails
              // Add a placeholder so we know this page failed
              extractedTexts.push(`\n\n--- Page ${pageNum} (FAILED) ---\n\n[Error: ${pageError.message}]`);
            }
          }
          
          // Combine all extracted text
          pdfText = extractedTexts.join('\n');
          
          // Clean up temp directory and files
          try {
            // Remove temp PDF file
            if (fs.existsSync(tempPdfPath)) {
              fs.unlinkSync(tempPdfPath);
            }
            
            // Remove image files
            const files = fs.readdirSync(tempDir);
            files.forEach(file => {
              const filePath = path.join(tempDir, file);
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
              }
            });
          } catch (cleanupError) {
            console.warn('   ⚠️ Error cleaning up temp files:', cleanupError.message);
          }
          
          // Check if we successfully extracted any text
          if (extractedTexts.length === 0) {
            throw new Error('No pages were successfully processed. All pages failed during OCR extraction. Check the logs above for specific errors.');
          }
          
          // Filter out placeholder text to check if we have real content
          const realText = pdfText.replace(/\[No text extracted from this page\]/g, '').replace(/\[Error:.*?\]/g, '').trim();
          
          if (realText.length === 0) {
            console.error('   ⚠️ Extracted text is empty after processing');
            console.error(`   Processed ${extractedTexts.length} page(s), but no real text was extracted`);
            console.error(`   Raw text length: ${pdfText.length} characters`);
            console.error(`   Sample of extracted text:`, pdfText.substring(0, 200));
            throw new Error(`Failed to extract text from PDF pages. Processed ${extractedTexts.length} page(s) but Claude Vision API returned empty or invalid responses. This might indicate: 1) The images are not readable, 2) Claude Vision API is not working correctly, or 3) The PDF pages are blank. Check the console logs above for detailed error messages.`);
          }
          
          console.log('✅ Successfully extracted text from image-based PDF using Claude Vision API');
          console.log(`   Total extracted text: ${pdfText.length} characters`);
          console.log(`   Real text content: ${realText.length} characters`);
          console.log(`   Processed ${extractedTexts.length} page(s) out of ${maxPages} attempted`);
          
        } catch (ocrError) {
          console.error('❌ Error processing image-based PDF:', ocrError);
          return res.status(400).json({ 
            error: "Failed to extract text from image-based PDF",
            details: ocrError.message,
            hint: "The PDF appears to be image-based (scanned). OCR processing failed.",
            totalPages: pdfData.numpages
          });
        }
      }
    } catch (pdfError) {
      console.error('❌ Error parsing PDF:', pdfError);
      console.error('   Error details:', pdfError.message);
      console.error('   File object:', file ? { 
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype,
        bufferType: file.buffer ? file.buffer.constructor.name : 'null',
        bufferLength: file.buffer ? file.buffer.length : 0
      } : 'null');
      return res.status(400).json({ 
        error: "Failed to extract text from PDF", 
        details: pdfError.message,
        hint: "If this is a scanned PDF, it may need OCR (Optical Character Recognition) to extract text."
      });
    }

    // Additional check after extraction
    if (!pdfText || pdfText.trim().length === 0) {
      console.warn('⚠️ PDF text is empty after extraction');
      return res.status(400).json({ 
        error: "PDF appears to be empty or contains no extractable text",
        hint: "This PDF might be image-based (scanned). Please ensure the PDF contains selectable text, or use OCR to convert scanned images to text."
      });
    }

    // Limit PDF text to avoid token limits (Claude has context window limits)
    // For claude-3-5-sonnet, max context is 200k tokens, so we limit to ~150k chars to be safe
    const maxTextLength = 150000;
    const truncatedText = pdfText.length > maxTextLength 
      ? pdfText.substring(0, maxTextLength) + '\n\n[Content truncated due to length...]'
      : pdfText;

    // Prepare prompt for Claude to generate quiz questions
    const prompt = `You are an expert quiz generator and educational content analyzer. Analyze the following PDF content and extract/create quiz questions.

CRITICAL INSTRUCTIONS:
1. Extract ALL questions from the PDF content - look for question numbers, question marks, and question patterns
2. For each question, you MUST identify:
   - The complete question text (preserve any LaTeX formulas using $formula$ for inline math and $$formula$$ for block/display math)
   - ALL options (typically A, B, C, D, but could be more)
   - The correct answer (must EXACTLY match one of the options - check carefully)
   - Any diagrams/images mentioned (describe in imageUrl field)
3. Preserve ALL mathematical and chemical formulas in LaTeX format:
   - Inline: $H_2O$, $x^2$, $\\frac{a}{b}$
   - Block: $$\\int_0^1 x dx$$, $$\\sum_{i=1}^{n} i$$
4. If questions reference diagrams, figures, or images, note them in the imageUrl field
5. Return ONLY valid JSON - no markdown, no explanations, just the JSON array

OUTPUT FORMAT - Return ONLY this JSON structure (no other text):
[
  {
    "questionText": "Question text here. Use $formula$ for inline math and $$formula$$ for block math",
    "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
    "answer": "Option A text",
    "imageUrl": "",
    "marks": 1
  }
]

PDF Content:
${truncatedText}

Now extract and generate all quiz questions from the above content. Return ONLY the JSON array.`;

    console.log('🤖 Sending request to Claude API...');
    
    // Try different model names in order of preference
    // Start with the configured model, then fallback to others
    const modelNames = [
      DEFAULT_CLAUDE_MODEL,         // User-configured or default
      "claude-3-sonnet-20240229",   // Standard Sonnet 3
      "claude-3-opus-20240229",     // Most capable (fallback)
      "claude-3-haiku-20240307"     // Fastest (last resort)
    ];
    
    let message = null;
    let lastError = null;
    
    // Try each model until one works
    for (const modelName of modelNames) {
      try {
        console.log(`   Trying model: ${modelName}`);
        message = await anthropic.messages.create({
          model: modelName,
          max_tokens: 8192, // Increased to handle more questions
          temperature: 0.3, // Lower temperature for more consistent, accurate extraction
          messages: [{
            role: "user",
            content: prompt
          }]
        });
        console.log(`   ✅ Successfully used model: ${modelName}`);
        break; // Success, exit loop
      } catch (modelError) {
        lastError = modelError;
        console.warn(`   ⚠️ Model ${modelName} failed:`, modelError.message);
        // Continue to next model
      }
    }
    
    if (!message) {
      throw new Error(`All Claude models failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    const claudeResponse = message.content[0].text;
    console.log('✅ Received response from Claude');
    console.log('   Response length:', claudeResponse.length, 'characters');

    // Parse Claude's JSON response
    let questions = [];
    try {
      questions = parseClaudeJSON(claudeResponse);
      
      if (!Array.isArray(questions)) {
        throw new Error('Response is not an array');
      }
      
      if (questions.length === 0) {
        console.warn('⚠️ Claude returned empty array - no questions found');
      }
      
      console.log('✅ Parsed', questions.length, 'questions from Claude response');
    } catch (parseError) {
      console.error('❌ Error parsing Claude response:', parseError);
      console.error('   Response preview:', claudeResponse.substring(0, 1000));
      console.error('   Full response length:', claudeResponse.length);
      
      // Try to provide helpful error message
      let errorDetails = parseError.message;
      if (claudeResponse.includes('I cannot') || claudeResponse.includes('I\'m unable')) {
        errorDetails = 'Claude was unable to extract questions. The PDF might not contain questions or the format is unclear.';
      }
      
      return res.status(500).json({ 
        error: "Failed to parse quiz questions from Claude response",
        details: errorDetails,
        hint: "Make sure the PDF contains clear questions with options and answers",
        rawResponsePreview: claudeResponse.substring(0, 2000) // Include first 2000 chars for debugging
      });
    }

    // Validate and clean questions
    const validatedQuestions = questions
      .map((q, index) => {
        // Ensure required fields
        if (!q.questionText || typeof q.questionText !== 'string') {
          console.warn(`⚠️ Question ${index + 1}: Missing or invalid questionText`);
          return null;
        }
        
        if (!Array.isArray(q.options) || q.options.length < 2) {
          console.warn(`⚠️ Question ${index + 1}: Invalid options`);
          return null;
        }
        
        if (!q.answer || typeof q.answer !== 'string') {
          console.warn(`⚠️ Question ${index + 1}: Missing answer`);
          return null;
        }
        
        // Ensure answer matches one of the options
        const answerMatches = q.options.some(opt => 
          opt.trim() === q.answer.trim() || 
          opt.toString().trim() === q.answer.toString().trim()
        );
        
        if (!answerMatches) {
          console.warn(`⚠️ Question ${index + 1}: Answer doesn't match any option`);
          // Try to fix by finding closest match
          const matchingOption = q.options.find(opt => 
            opt.toString().toLowerCase().includes(q.answer.toString().toLowerCase()) ||
            q.answer.toString().toLowerCase().includes(opt.toString().toLowerCase())
          );
          if (matchingOption) {
            q.answer = matchingOption;
          } else {
            return null;
          }
        }
        
        return {
          questionText: q.questionText.trim(),
          options: q.options.map(opt => opt.toString().trim()).filter(opt => opt !== ''),
          answer: q.answer.trim(),
          imageUrl: (q.imageUrl && q.imageUrl.trim()) ? q.imageUrl.trim() : '',
          marks: q.marks || 1
        };
      })
      .filter(q => q !== null);

    console.log('✅ Validated', validatedQuestions.length, 'questions');

    // Return parsed questions
    res.status(200).json({
      success: true,
      data: {
        totalQuestions: validatedQuestions.length,
        questions: validatedQuestions,
        totalPages: pdfText.split('\f').length || 1,
        validation: {
          warnings: validatedQuestions.length < questions.length 
            ? [`${questions.length - validatedQuestions.length} questions were filtered due to validation errors`]
            : []
        }
      }
    });

  } catch (error) {
    console.error('❌ Error parsing PDF:', error);
    res.status(500).json({ 
      error: error.message || "Failed to parse PDF and generate quiz questions",
      details: error.stack
    });
  }
};

// Generate quiz questions using Claude AI based on test name, subject, and number of questions
const generateQuizQuestions = async (req, res) => {
  try {
    const { testName, subject, numberOfQuestions, mustContainFormulas } = req.body;

    if (!testName || !subject || !numberOfQuestions) {
      return res.status(400).json({ 
        error: "testName, subject, and numberOfQuestions are required" 
      });
    }

    if (!anthropic) {
      return res.status(500).json({ 
        error: "Claude API is not configured. Please set ANTHROPIC_API_KEY in environment variables." 
      });
    }

    const numQuestions = parseInt(numberOfQuestions);
    if (isNaN(numQuestions) || numQuestions <= 0 || numQuestions > 50) {
      return res.status(400).json({ 
        error: "numberOfQuestions must be a number between 1 and 50" 
      });
    }

    console.log('🤖 Generating quiz questions with Claude AI...');
    console.log(`   Test: ${testName}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Number of questions: ${numQuestions}`);
    console.log(`   Must contain formulas: ${mustContainFormulas ? 'Yes' : 'No'}`);

    const formulaRequirement = mustContainFormulas 
      ? `\nIMPORTANT: ALL questions MUST contain mathematical or chemical formulas. Use LaTeX format for formulas:
   - Inline: $H_2O$, $x^2$, $\\frac{a}{b}$
   - Block: $$\\int_0^1 x dx$$, $$\\sum_{i=1}^{n} i$$
   - Include formulas in both question text and options where appropriate`
      : `\nFor mathematical or chemical formulas (if applicable), use LaTeX format:
   - Inline: $H_2O$, $x^2$, $\\frac{a}{b}$
   - Block: $$\\int_0^1 x dx$$, $$\\sum_{i=1}^{n} i$$`;

    const prompt = `You are an expert quiz generator for educational content. Generate ${numQuestions} high-quality multiple-choice quiz questions for the following specifications:

TEST: ${testName}
SUBJECT: ${subject}
NUMBER OF QUESTIONS: ${numQuestions}
${mustContainFormulas ? 'REQUIREMENT: ALL questions MUST contain formulas' : ''}

CRITICAL INSTRUCTIONS:
1. Generate exactly ${numQuestions} questions relevant to the test and subject
2. Each question should be:
   - Clear and well-formulated
   - Appropriate for the test level (${testName})
   - Covering important topics in ${subject}
   - With 4 options (A, B, C, D)
   - One correct answer that exactly matches one of the options
${formulaRequirement}
4. Questions should vary in difficulty and cover different aspects of ${subject}
5. Make questions realistic and educational
6. Return ONLY valid JSON - no markdown, no explanations, just the JSON array

OUTPUT FORMAT - Return ONLY this JSON structure (no other text):
[
  {
    "questionText": "Question text here. Use $formula$ for inline math and $$formula$$ for block math",
    "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
    "answer": "Option A text",
    "imageUrl": "",
    "marks": 1
  }
]

Generate ${numQuestions} questions now. Return ONLY the JSON array.`;

    console.log('🤖 Sending request to Claude API...');
    
    // Try different model names in order of preference
    const modelNames = [
      DEFAULT_CLAUDE_MODEL,
      "claude-3-sonnet-20240229",
      "claude-3-opus-20240229",
      "claude-3-haiku-20240307"
    ];
    
    let message = null;
    let lastError = null;
    
    // Try each model until one works
    for (const modelName of modelNames) {
      try {
        console.log(`   Trying model: ${modelName}`);
        message = await anthropic.messages.create({
          model: modelName,
          max_tokens: 2048,
          temperature: 0.7, // Slightly higher for more creative questions
          messages: [{
            role: "user",
            content: prompt
          }]
        });
        console.log(`   ✅ Successfully used model: ${modelName}`);
        break;
      } catch (modelError) {
        lastError = modelError;
        console.warn(`   ⚠️ Model ${modelName} failed:`, modelError.message);
      }
    }
    
    if (!message) {
      throw new Error(`All Claude models failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    const claudeResponse = message.content[0].text;
    console.log('✅ Received response from Claude');
    console.log('   Response length:', claudeResponse.length, 'characters');

    // Parse Claude's JSON response
    let questions = [];
    try {
      questions = parseClaudeJSON(claudeResponse);
      
      if (!Array.isArray(questions)) {
        throw new Error('Response is not an array');
      }
    } catch (parseError) {
      console.error('❌ Error parsing Claude response:', parseError);
      console.error('   Response preview:', claudeResponse.substring(0, 500));
      console.error('   Error position info:', parseError.message);
      return res.status(500).json({ 
        error: "Failed to parse AI response. Please try again.",
        details: parseError.message
      });
    }

    // Validate and clean questions
    const validatedQuestions = questions
      .map((q, index) => {
        if (!q.questionText || typeof q.questionText !== 'string') {
          console.warn(`⚠️ Question ${index + 1}: Missing or invalid questionText`);
          return null;
        }
        
        if (!Array.isArray(q.options) || q.options.length < 2) {
          console.warn(`⚠️ Question ${index + 1}: Invalid options`);
          return null;
        }
        
        if (!q.answer || typeof q.answer !== 'string') {
          console.warn(`⚠️ Question ${index + 1}: Missing answer`);
          return null;
        }
        
        // Ensure answer matches one of the options
        const answerMatches = q.options.some(opt => 
          opt.trim() === q.answer.trim() || 
          opt.toString().trim() === q.answer.toString().trim()
        );
        
        if (!answerMatches) {
          console.warn(`⚠️ Question ${index + 1}: Answer doesn't match any option`);
          // Try to fix by finding closest match
          const matchingOption = q.options.find(opt => 
            opt.toString().toLowerCase().includes(q.answer.toString().toLowerCase()) ||
            q.answer.toString().toLowerCase().includes(opt.toString().toLowerCase())
          );
          if (matchingOption) {
            q.answer = matchingOption;
          } else {
            return null;
          }
        }
        
        return {
          questionText: q.questionText.trim(),
          options: q.options.map(opt => opt.toString().trim()).filter(opt => opt !== ''),
          answer: q.answer.trim(),
          imageUrl: (q.imageUrl && q.imageUrl.trim()) ? q.imageUrl.trim() : '',
          marks: q.marks || 1
        };
      })
      .filter(q => q !== null);

    console.log('✅ Validated', validatedQuestions.length, 'questions');

    if (validatedQuestions.length === 0) {
      return res.status(500).json({ 
        error: "No valid questions were generated. Please try again with different parameters."
      });
    }

    // Return generated questions
    res.status(200).json({
      success: true,
      data: {
        totalQuestions: validatedQuestions.length,
        questions: validatedQuestions,
        testName,
        subject
      }
    });

  } catch (error) {
    console.error('❌ Error generating quiz questions:', error);
    res.status(500).json({ 
      error: error.message || "Failed to generate quiz questions",
      details: error.stack
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
    updateTest,
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
    deleteTest,
    getCourses,
    getCourseById,
    updateCourse,
    deleteCourse,
    uploadLibraryDocument,
    getLibraryDocuments,
    addLibraryCategory,
    getLibraryCategories,
    addLibraryClass,
    getLibraryClasses,
    getDashboardStats,
    getRecentActivities,
    upload, // Export multer upload middleware (library PDFs - memory storage)
    uploadImage, // Export image upload middleware
    pdfUpload, // Export PDF upload middleware (for parsing)
    uploadQuestionImage,
    uploadTestImage,
    getTestImages,
    parsePdf,
    generateQuizQuestions
  }