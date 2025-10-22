const Lesson = require('../models/Lesson');
const { DeepSeek } = require('deepseek');

class AdaptiveLessonController {
  constructor() {
    this.deepseek = new DeepSeek(process.env.DEEPSEEK_API_KEY);
    this.userSessions = new Map(); // In-memory store for user progress (consider Redis for production)
  }

  async startLessonSession(userId, lessonId) {
    const lesson = await Lesson.findById(lessonId).populate('quiz');
    if (!lesson) throw new Error('Lesson not found');

    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, {});
    }

    this.userSessions.get(userId)[lessonId] = {
      understandingLevel: 1, // 1-5 scale
      chatHistory: [],
      quizPerformance: [],
      currentSection: 'chat', // or 'quiz'
      completed: false
    };

    return {
      welcomeMessage: await this.generateWelcomeMessage(lesson),
      lessonTitle: lesson.title,
      firstContent: await this.adaptContent(lesson.content, 1)
    };
  }

  async generateWelcomeMessage(lesson) {
    const prompt = `Create a welcoming message for a lesson titled "${lesson.title}". 
      The lesson covers: ${lesson.content.substring(0, 200)}...
      Keep it friendly and encouraging, about 2-3 sentences.`;
    
    const response = await this.deepseek.generate(prompt);
    return response.choices[0].message.content;
  }

  async handleUserMessage(userId, lessonId, userMessage) {
    const session = this.getUserSession(userId, lessonId);
    const lesson = await Lesson.findById(lessonId).populate('quiz');

    // Add user message to history
    session.chatHistory.push({ role: 'user', content: userMessage });

    // Generate adaptive response
    const response = await this.generateAdaptiveResponse(lesson, session, userMessage);

    // Add bot response to history
    session.chatHistory.push({ role: 'assistant', content: response });

    // Update understanding level based on interaction
    this.updateUnderstandingLevel(session, userMessage, response);

    // Check if should transition to quiz
    const shouldStartQuiz = this.checkQuizTransition(session);

    return {
      response,
      shouldStartQuiz,
      understandingLevel: session.understandingLevel
    };
  }

  async generateAdaptiveResponse(lesson, session, userMessage) {
    const context = `
      Lesson Title: ${lesson.title}
      Lesson Content: ${lesson.content}
      Practice Questions: ${JSON.stringify(lesson.practiceQuestions)}
      
      Student's current understanding level: ${session.understandingLevel}/5
      Chat history: ${JSON.stringify(session.chatHistory.slice(-3))}
    `;

    const prompt = `
      You are an adaptive learning assistant. Context:
      ${context}
      
      Student's message: "${userMessage}"
      
      Respond to help the student learn, considering:
      1. Their understanding level
      2. The lesson content
      3. Any practice questions that might help explain
      4. Keep responses clear and tailored to their level
    `;

    const response = await this.deepseek.generate({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });

    return response.choices[0].message.content;
  }

  async generateAdaptiveQuiz(userId, lessonId) {
    const session = this.getUserSession(userId, lessonId);
    const lesson = await Lesson.findById(lessonId).populate('quiz');

    // Filter questions based on understanding level
    const questions = lesson.quiz.questions.filter(q => {
      return q.difficulty <= session.understandingLevel + 1;
    }).slice(0, 5); // Limit to 5 questions

    // Add explanations from lesson content
    const enhancedQuestions = await Promise.all(questions.map(async q => {
      const explanationPrompt = `Based on this lesson content: "${lesson.content.substring(0, 500)}", 
        generate a brief explanation (1-2 sentences) for this quiz question: "${q.text}"`;
      
      const explanation = await this.deepseek.generate(explanationPrompt);
      
      return {
        ...q.toObject(),
        explanation: explanation.choices[0].message.content
      };
    }));

    session.currentSection = 'quiz';
    return enhancedQuestions;
  }

  // Helper methods
  getUserSession(userId, lessonId) {
    if (!this.userSessions.get(userId)?.[lessonId]) {
      throw new Error('Session not found - start a lesson first');
    }
    return this.userSessions.get(userId)[lessonId];
  }

  updateUnderstandingLevel(session, userMessage, botResponse) {
    // Simple heuristic - could be enhanced with NLP analysis
    const messageComplexity = userMessage.split(' ').length;
    if (messageComplexity > 20 && session.understandingLevel < 5) {
      session.understandingLevel += 0.5;
    }
  }

  checkQuizTransition(session) {
    // Transition to quiz after 5 meaningful interactions
    return session.chatHistory.length >= 5 && 
           session.currentSection === 'chat' &&
           !session.completed;
  }
}

module.exports = new AdaptiveLessonController();