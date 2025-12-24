// Robustly load pdf-parse for CommonJS/ESM builds
const pdfModule = require('pdf-parse');

// pdf-parse v2.x exports an object with PDFParse (capital P) as the function
const pdf = 
  typeof pdfModule === 'function'
    ? pdfModule
    : typeof pdfModule.PDFParse === 'function'
      ? pdfModule.PDFParse
      : typeof pdfModule.default === 'function'
        ? pdfModule.default
        : typeof pdfModule.pdfParse === 'function'
          ? pdfModule.pdfParse
          : null;

if (!pdf || typeof pdf !== 'function') {
  // Log the shape of the module once to help debugging
  console.error('pdf-parse module shape:', {
    type: typeof pdfModule,
    keys: Object.keys(pdfModule || {}),
  });
  throw new Error('Could not resolve pdf-parse function from module');
}

/**
 * Parse PDF and extract structured NEET exam questions
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @returns {Promise<Object>} Parsed questions data
 */
const parsePDF = async (pdfBuffer) => {
  try {
    const data = await pdf(pdfBuffer);
    const text = data.text;
    
    // Extract questions using regex patterns
    const questions = extractQuestions(text);
    
    return {
      success: true,
      totalPages: data.numpages,
      totalQuestions: questions.length,
      questions: questions
    };
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
};

/**
 * Extract questions from PDF text
 * @param {String} text - Full PDF text
 * @returns {Array} Array of question objects
 */
const extractQuestions = (text) => {
  const questions = [];
  
  // Pattern to match question numbers: Q.1, 1., (1), Q1, etc.
  const questionPattern = /(?:Q\.?\s*)?(\d+)[\.\)]\s*(.+?)(?=(?:Q\.?\s*)?\d+[\.\)]|Answer|$)/gis;
  
  // Pattern to match options: (A), (B), (a), (b), A., B., etc.
  const optionPattern = /[\(\)]?\s*([A-Da-d])[\.\)]\s*(.+?)(?=[\(\)]?\s*[A-Da-d][\.\)]|Answer|$)/gi;
  
  // Pattern to match answers: Answer: A, Answer A, etc.
  const answerPattern = /Answer[:\s]+([A-Da-d])/gi;
  
  let questionMatch;
  let questionIndex = 0;
  
  // Extract all questions
  while ((questionMatch = questionPattern.exec(text)) !== null) {
    const questionNumber = questionMatch[1];
    const questionText = questionMatch[2].trim();
    
    // Skip if question text is too short (likely not a real question)
    if (questionText.length < 10) continue;
    
    // Extract options for this question
    const options = extractOptions(questionText);
    
    // Extract answer if present in the text after the question
    const answerMatch = answerPattern.exec(text.substring(questionMatch.index));
    const answer = answerMatch ? answerMatch[1].toUpperCase() : null;
    
    // If we have at least 2 options, consider it a valid question
    if (options.length >= 2) {
      questions.push({
        questionNumber: parseInt(questionNumber),
        questionText: cleanQuestionText(questionText, options),
        options: options.map(opt => opt.text),
        answer: answer || (options.length > 0 ? options[0].option.toUpperCase() : 'A'), // Default to first option if no answer found
        imageUrl: null, // Will be set manually
        marks: 1
      });
    }
  }
  
  return questions;
};

/**
 * Extract options from question text
 * @param {String} questionText - Text containing question and options
 * @returns {Array} Array of option objects
 */
const extractOptions = (questionText) => {
  const options = [];
  const optionPattern = /[\(\)]?\s*([A-Da-d])[\.\)]\s*(.+?)(?=[\(\)]?\s*[A-Da-d][\.\)]|Answer|$)/gi;
  
  let optionMatch;
  while ((optionMatch = optionPattern.exec(questionText)) !== null) {
    const optionLetter = optionMatch[1].toUpperCase();
    const optionText = optionMatch[2].trim();
    
    // Skip if option text is too short
    if (optionText.length < 1) continue;
    
    options.push({
      option: optionLetter,
      text: optionText
    });
  }
  
  // If no options found with pattern, try alternative patterns
  if (options.length === 0) {
    // Try pattern: A) option text B) option text
    const altPattern = /([A-Da-d])\)\s*(.+?)(?=[A-Da-d]\)|$)/gi;
    let altMatch;
    while ((altMatch = altPattern.exec(questionText)) !== null) {
      options.push({
        option: altMatch[1].toUpperCase(),
        text: altMatch[2].trim()
      });
    }
  }
  
  return options;
};

/**
 * Clean question text by removing options
 * @param {String} questionText - Original question text with options
 * @param {Array} options - Extracted options
 * @returns {String} Clean question text without options
 */
const cleanQuestionText = (questionText, options) => {
  let cleaned = questionText;
  
  // Remove options from question text
  options.forEach(opt => {
    // Remove patterns like (A) text, A) text, A. text
    const patterns = [
      new RegExp(`[\(]?${opt.option}[\.\)]\\s*${escapeRegex(opt.text)}`, 'gi'),
      new RegExp(`${opt.option}[\.\)]\\s*${escapeRegex(opt.text)}`, 'gi')
    ];
    
    patterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '').trim();
    });
  });
  
  // Remove "Answer: X" patterns
  cleaned = cleaned.replace(/Answer[:\s]+[A-Da-d]/gi, '').trim();
  
  return cleaned;
};

/**
 * Escape special regex characters
 * @param {String} string - String to escape
 * @returns {String} Escaped string
 */
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Validate parsed questions
 * @param {Array} questions - Parsed questions
 * @returns {Object} Validation result
 */
const validateQuestions = (questions) => {
  const errors = [];
  const warnings = [];
  
  questions.forEach((q, index) => {
    if (!q.questionText || q.questionText.length < 10) {
      errors.push(`Question ${index + 1}: Question text is too short or missing`);
    }
    
    if (!q.options || q.options.length < 2) {
      errors.push(`Question ${index + 1}: Less than 2 options found`);
    }
    
    if (q.options && q.options.length < 4) {
      warnings.push(`Question ${index + 1}: Only ${q.options.length} options found (expected 4)`);
    }
    
    if (!q.answer || !['A', 'B', 'C', 'D'].includes(q.answer.toUpperCase())) {
      warnings.push(`Question ${index + 1}: Answer not found or invalid`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

module.exports = {
  parsePDF,
  extractQuestions,
  validateQuestions
};

