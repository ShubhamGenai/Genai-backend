/**
 * Limits and sanitization for student profile APIs (production hardening).
 */

const LIMITS = {
  name: 120,
  bio: 8000,
  urlField: 500,
  line: 200,
  phone: 30,
  educationMax: 40,
  skillsMax: 100,
  achievementsPerEducation: 40,
  achievementItem: 300,
};

function clip(str, max) {
  if (typeof str !== "string") return "";
  return str.trim().slice(0, max);
}

/** Allow empty, same-origin path, or http(s) URLs only (blocks javascript:, data:, etc.). */
function sanitizeOptionalUrl(value, maxLen = LIMITS.urlField) {
  const s = clip(value, maxLen);
  if (!s) return "";
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  try {
    const u = new URL(s);
    if (u.protocol === "https:" || u.protocol === "http:") return s;
  } catch (_) {
    /* ignore */
  }
  return "";
}

function normalizeEducationEntry(e) {
  if (!e || typeof e !== "object") {
    return {
      degree: "",
      institution: "",
      startYear: "",
      endYear: "",
      gpa: "",
      description: "",
      achievements: [],
    };
  }
  let achievements = [];
  if (Array.isArray(e.achievements)) {
    achievements = e.achievements
      .slice(0, LIMITS.achievementsPerEducation)
      .map((a) => clip(String(a), LIMITS.achievementItem))
      .filter(Boolean);
  }
  return {
    degree: clip(String(e.degree ?? ""), LIMITS.line),
    institution: clip(String(e.institution ?? ""), LIMITS.line),
    startYear: clip(String(e.startYear ?? ""), 20),
    endYear: clip(String(e.endYear ?? ""), 20),
    gpa: clip(String(e.gpa ?? ""), 20),
    description: clip(String(e.description ?? ""), LIMITS.bio),
    achievements,
  };
}

function normalizeSkillEntry(s) {
  if (!s || typeof s !== "object") {
    return { name: "", level: "beginner", category: "other", endorsed: 0 };
  }
  const levelRaw = clip(String(s.level ?? "beginner"), 32).toLowerCase();
  const level = ["beginner", "intermediate", "advanced"].includes(levelRaw)
    ? levelRaw
    : "beginner";
  const endorsed = Math.min(1e9, Math.max(0, Math.floor(Number(s.endorsed) || 0)));
  return {
    name: clip(String(s.name ?? ""), LIMITS.line),
    level,
    category: clip(String(s.category ?? "other"), 64),
    endorsed,
  };
}

/** Single atomic upsert — avoids duplicate Student rows under concurrent first requests. */
async function findOrCreateStudent(Student, userId) {
  return Student.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { new: true, upsert: true, runValidators: true }
  );
}

module.exports = {
  LIMITS,
  clip,
  sanitizeOptionalUrl,
  normalizeEducationEntry,
  normalizeSkillEntry,
  findOrCreateStudent,
};
