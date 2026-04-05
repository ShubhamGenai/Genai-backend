// Utility to post-process AI-generated explanations and convert to HTML
// Goal: improve readability, spacing, and format as HTML for frontend rendering

/**
 * Remove "Check your understanding" quiz blocks and LaTeX-style inline answers from rendered HTML.
 */
function postProcessAiHtml(html) {
  if (!html || typeof html !== 'string') return html;
  let s = html;
  const lower = s.toLowerCase();
  const marker = 'check your understanding';
  const cut = lower.indexOf(marker);
  if (cut !== -1 && cut > 100) {
    const blockStart = s.lastIndexOf('<p', cut);
    if (blockStart !== -1 && cut - blockStart < 600) {
      s = s.slice(0, blockStart).trim();
    } else {
      s = s.slice(0, cut).trim();
    }
  }
  s = s.replace(/\$\\?textbf\s*\{\s*Answer\s*\}\$\s*:?/gi, '');
  s = s.replace(/\$\\\s*textbf\s*\{\s*Answer\s*\}\$\s*:?/gi, '');
  s = s.replace(/\$\s*Answer\s*\$\s*:?/gi, '');
  s = s.replace(/\*\*Answer\*\*\s*:?\s*/gi, '');
  s = s.replace(/\\\|/g, '|');
  return s.trim();
}

/**
 * Convert AI explanation text to formatted HTML
 * - Normalizes spacing around LaTeX formulas
 * - Converts newlines to proper HTML paragraphs
 * - Formats numbered lists as HTML lists
 * - Preserves LaTeX formulas for frontend rendering
 */
const formatAiExplanationToHtml = (rawText = '') => {
  if (!rawText || typeof rawText !== 'string') return '';

  let text = rawText.trim();

  try {
    // Add space BEFORE a formula if missing
    text = text.replace(
      /(\S)($[^$]+\$|\\\([^)]*\\\)|\$\$[^$]+\$\$|\\\[[^\]]+\\\])/g,
      '$1 $2'
    );

    // Add space AFTER a formula if missing
    text = text.replace(
      /($[^$]+\$|\\\([^)]*\\\)|\$\$[^$]+\$\$|\\\[[^\]]+\\\])(\S)/g,
      '$1 $2'
    );

    // Normalize excessive blank lines (3+ becomes 2)
    text = text.replace(/\n{3,}/g, '\n\n');

    // Escape HTML special characters to prevent XSS
    text = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Convert numbered lists (1. 2. 3.) to HTML ordered lists
    text = text.replace(/(\d+\.\s+[^\n]+(?:\n(?!\d+\.)[^\n]+)*)/g, (match) => {
      const items = match.split(/\n(?=\d+\.)/);
      if (items.length > 1) {
        const listItems = items.map(item => {
          const cleaned = item.replace(/^\d+\.\s+/, '').trim();
          return `<li>${cleaned}</li>`;
        }).join('');
        return `<ol class="list-decimal list-inside space-y-1 my-2">${listItems}</ol>`;
      }
      return match.replace(/^(\d+\.\s+)(.+)$/m, '<ol class="list-decimal list-inside space-y-1 my-2"><li>$2</li></ol>');
    });

    // Convert bullet points (- or •) to HTML unordered lists
    text = text.replace(/([-•]\s+[^\n]+(?:\n(?![-•])[^\n]+)*)/g, (match) => {
      const items = match.split(/\n(?=[-•])/);
      if (items.length > 1) {
        const listItems = items.map(item => {
          const cleaned = item.replace(/^[-•]\s+/, '').trim();
          return `<li>${cleaned}</li>`;
        }).join('');
        return `<ul class="list-disc list-inside space-y-1 my-2">${listItems}</ul>`;
      }
      return match.replace(/^([-•]\s+)(.+)$/m, '<ul class="list-disc list-inside space-y-1 my-2"><li>$2</li></ul>');
    });

    // Convert double newlines to paragraphs
    const paragraphs = text.split(/\n\n+/);
    const htmlParagraphs = paragraphs.map(para => {
      const trimmed = para.trim();
      if (!trimmed) return '';
      
      // Skip if already wrapped in list tags
      if (trimmed.startsWith('<ol') || trimmed.startsWith('<ul')) {
        return trimmed;
      }
      
      return `<p class="mb-2 leading-relaxed">${trimmed}</p>`;
    }).filter(p => p).join('');

    const out = htmlParagraphs || `<p class="mb-2 leading-relaxed">${text}</p>`;
    return postProcessAiHtml(out);
  } catch (error) {
    // If anything goes wrong, return safe HTML with escaped text
    const escaped = rawText
      .trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    return postProcessAiHtml(`<p class="mb-2 leading-relaxed">${escaped}</p>`);
  }
};

module.exports = {
  formatAiExplanationToHtml,
  postProcessAiHtml,
};

