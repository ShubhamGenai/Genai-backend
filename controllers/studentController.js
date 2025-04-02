const getCourses = async (req, res) => {
    try {
      const courses = await Course.find().populate("modules"); // Populate modules if needed
      res.status(200).json(courses);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  
  // ✅ Fetch all tests
  const getTests = async (req, res) => {
    try {
      const tests = await Test.find().populate("quizzes"); // Populate quizzes if needed
      res.status(200).json(tests);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  
  // ✅ Fetch a single course by ID
  const getCourseById = async (req, res) => {
    try {
      const course = await Course.findById(req.params.id).populate("modules");
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
      const test = await Test.findById(req.params.id).populate("quizzes");
      if (!test) {
        return res.status(404).json({ error: "Test not found" });
      }
      res.status(200).json(test);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  
  module.exports = {
    getCourses,
    getTests,
    getCourseById,
    getTestById,
  };