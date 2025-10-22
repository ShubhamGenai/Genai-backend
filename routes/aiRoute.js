const express = require('express');
const router = express.Router();
const adaptiveController = require('../../controllers/aiControllers');      

// Start a lesson session
router.post('/:lessonId/start', async (req, res) => {
  try {
    const { userId } = req.body;
    const { lessonId } = req.params;
    const result = await adaptiveController.startLessonSession(userId, lessonId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Handle chat messages
router.post('/:lessonId/chat', async (req, res) => {
  try {
    const { userId, message } = req.body;
    const { lessonId } = req.params;
    const result = await adaptiveController.handleUserMessage(userId, lessonId, message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get adaptive quiz
router.get('/:lessonId/quiz', async (req, res) => {
  try {
    const { userId } = req.query;
    const { lessonId } = req.params;
    const quiz = await adaptiveController.generateAdaptiveQuiz(userId, lessonId);
    res.json(quiz);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;