import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getAllTOEICWords, TOEIC_LESSONS } from "./data/toeicVocab";
import { exportData, importData, exportToCSV, autoBackup, getAvailableBackups, restoreBackup } from "./utils/dataManager";

// ═══════════════════════════════════════════════════════════════
// 🧠 VOCABMASTER PRO — Ultimate English Learning App
// ═══════════════════════════════════════════════════════════════
// Methods: SM-2 SRS, Active Recall, Leitner Box, Interleaving,
//          Retrieval Practice, Dual Coding, Context Learning
// ═══════════════════════════════════════════════════════════════

// ── CONSTANTS & THEME ──────────────────────────────────────────
const THEME = {
  bg: "#0a0a0f",
  surface: "#12121a",
  card: "#1a1a28",
  cardHover: "#222236",
  accent: "#6c5ce7",
  accentLight: "#a29bfe",
  accentGlow: "rgba(108,92,231,0.3)",
  success: "#00b894",
  successGlow: "rgba(0,184,148,0.3)",
  danger: "#e17055",
  dangerGlow: "rgba(225,112,85,0.3)",
  warning: "#fdcb6e",
  warningGlow: "rgba(253,203,110,0.3)",
  info: "#74b9ff",
  text: "#e8e8f0",
  textSecondary: "#8888a8",
  textMuted: "#555570",
  border: "#2a2a40",
  gradient1: "linear-gradient(135deg, #6c5ce7, #a29bfe)",
  gradient2: "linear-gradient(135deg, #00b894, #55efc4)",
  gradient3: "linear-gradient(135deg, #e17055, #fab1a0)",
  gradient4: "linear-gradient(135deg, #fdcb6e, #ffeaa7)",
};

const MASTERY = [
  { level: 0, name: "New", color: "#636e72", icon: "🌱", minReviews: 0 },
  { level: 1, name: "Learning", color: "#e17055", icon: "📖", minReviews: 1 },
  { level: 2, name: "Familiar", color: "#fdcb6e", icon: "💡", minReviews: 3 },
  { level: 3, name: "Known", color: "#74b9ff", icon: "🎯", minReviews: 6 },
  { level: 4, name: "Mastered", color: "#00b894", icon: "👑", minReviews: 10 },
];

const CATEGORIES = [
  { id: "toeic", name: "TOEIC", icon: "📋", color: "#6c5ce7" },
  { id: "ielts", name: "IELTS", icon: "🎓", color: "#00b894" },
  { id: "business", name: "Business", icon: "💼", color: "#e17055" },
  { id: "tech", name: "Technology", icon: "💻", color: "#74b9ff" },
  { id: "daily", name: "Daily Life", icon: "🏠", color: "#fdcb6e" },
  { id: "academic", name: "Academic", icon: "📚", color: "#a29bfe" },
  { id: "travel", name: "Travel", icon: "✈️", color: "#55efc4" },
  { id: "custom", name: "Custom", icon: "⭐", color: "#fd79a8" },
];

const ACHIEVEMENTS = [
  { id: "first_word", name: "First Step", desc: "Learn your first word", icon: "🌟", condition: (s) => s.totalWords >= 1 },
  { id: "ten_streak", name: "On Fire", desc: "10-day streak", icon: "🔥", condition: (s) => s.streak >= 10 },
  { id: "hundred_words", name: "Centurion", desc: "Learn 100 words", icon: "💯", condition: (s) => s.totalWords >= 100 },
  { id: "quiz_master", name: "Quiz Master", desc: "Complete 50 quizzes", icon: "🏆", condition: (s) => s.totalQuizzes >= 50 },
  { id: "perfect_score", name: "Perfectionist", desc: "100% in a quiz", icon: "✨", condition: (s) => s.perfectQuizzes >= 1 },
  { id: "night_owl", name: "Night Owl", desc: "Study after midnight", icon: "🦉", condition: (s) => s.nightStudy },
  { id: "speed_demon", name: "Speed Demon", desc: "Review 20 words in 2min", icon: "⚡", condition: (s) => s.speedReview },
  { id: "polyglot", name: "Word Collector", desc: "Learn 500 words", icon: "📖", condition: (s) => s.totalWords >= 500 },
];

// ── SM-2 SPACED REPETITION ENGINE ─────────────────────────────
const SRSEngine = {
  // Optimized intervals for language learning: 1d → 3d → 7d → 14d → 30d → 60d
  INTERVALS: [1, 3, 7, 14, 30, 60],

  processReview(word, quality) {
    // quality: 0-5 (0=blackout, 5=perfect)
    let { easeFactor = 2.5, interval = 0, repetitions = 0 } = word.srs || {};

    if (quality >= 3) {
      // Correct answer - advance to next interval
      if (repetitions < SRSEngine.INTERVALS.length) {
        interval = SRSEngine.INTERVALS[repetitions];
      } else {
        // After all intervals, word is mastered (stay at 60 days)
        interval = 60;
      }
      repetitions++;
    } else {
      // Wrong answer - reset to beginning
      repetitions = 0;
      interval = 1;
    }

    // Adjust ease factor based on quality (SM-2 algorithm)
    easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    // Mark as mastered if reached final interval
    const mastered = repetitions >= SRSEngine.INTERVALS.length;

    // Track correct/wrong reviews for weak areas analysis
    const isCorrect = quality >= 3;
    const correctReviews = (word.srs?.correctReviews || 0) + (isCorrect ? 1 : 0);
    const wrongReviews = (word.srs?.wrongReviews || 0) + (isCorrect ? 0 : 1);

    return {
      ...word.srs,
      easeFactor,
      interval,
      repetitions,
      nextReview: nextReview.toISOString(),
      lastReview: new Date().toISOString(),
      totalReviews: (word.srs?.totalReviews || 0) + 1,
      correctReviews,
      wrongReviews,
      mastered,
    };
  },

  getLeitnerBox(word) {
    const reps = word.srs?.repetitions || 0;
    if (reps === 0) return 0;
    if (reps <= 2) return 1;
    if (reps <= 5) return 2;
    if (reps <= 9) return 3;
    return 4;
  },

  getMasteryLevel(word) {
    const reviews = word.srs?.totalReviews || 0;
    for (let i = MASTERY.length - 1; i >= 0; i--) {
      if (reviews >= MASTERY[i].minReviews) return i;
    }
    return 0;
  },

  isDueForReview(word) {
    // Mastered words don't need review
    if (word.srs?.mastered) return false;
    if (!word.srs?.nextReview) return true;
    return new Date(word.srs.nextReview) <= new Date();
  },

  // Get predicted next interval based on current progress
  getNextInterval(word, quality) {
    const reps = word.srs?.repetitions || 0;
    if (quality < 3) return 1; // Reset
    if (reps >= SRSEngine.INTERVALS.length) return 60; // Already mastered
    return SRSEngine.INTERVALS[reps];
  },

  qualityFromRating(rating) {
    switch (rating) {
      case "again": return 1;
      case "hard": return 3;
      case "good": return 4;
      case "easy": return 5;
      default: return 3;
    }
  },
};

// ── SAMPLE VOCABULARY DATA ────────────────────────────────────
const SAMPLE_WORDS = [
  { id: "w1", term: "ubiquitous", definition: "Present, appearing, or found everywhere", phonetic: "/juːˈbɪkwɪtəs/", partOfSpeech: "adj", examples: ["Smartphones are ubiquitous in modern society", "Coffee shops have become ubiquitous in urban areas"], synonyms: ["omnipresent", "pervasive", "universal"], category: "academic", srs: {} },
  { id: "w2", term: "resilience", definition: "The capacity to recover quickly from difficulties", phonetic: "/rɪˈzɪliəns/", partOfSpeech: "n", examples: ["The team showed great resilience after the setback", "Building resilience is key to mental health"], synonyms: ["toughness", "adaptability", "grit"], category: "business", srs: {} },
  { id: "w3", term: "elaborate", definition: "To develop or present in detail; involving many carefully arranged parts", phonetic: "/ɪˈlæbərət/", partOfSpeech: "v/adj", examples: ["Could you elaborate on your proposal?", "They prepared an elaborate dinner for the guests"], synonyms: ["detailed", "intricate", "expand"], category: "ielts", srs: {} },
  { id: "w4", term: "mitigate", definition: "To make something less severe, serious, or painful", phonetic: "/ˈmɪtɪɡeɪt/", partOfSpeech: "v", examples: ["We need to mitigate the risks of the project", "Trees help mitigate the effects of air pollution"], synonyms: ["alleviate", "reduce", "lessen"], category: "toeic", srs: {} },
  { id: "w5", term: "scalability", definition: "The ability of a system to handle growing amounts of work", phonetic: "/ˌskeɪləˈbɪlɪti/", partOfSpeech: "n", examples: ["Cloud computing offers excellent scalability", "We must ensure scalability before launch"], synonyms: ["expandability", "flexibility"], category: "tech", srs: {} },
  { id: "w6", term: "ambiguous", definition: "Open to more than one interpretation; not clear", phonetic: "/æmˈbɪɡjuəs/", partOfSpeech: "adj", examples: ["The contract language was ambiguous", "His response was deliberately ambiguous"], synonyms: ["vague", "unclear", "equivocal"], category: "ielts", srs: {} },
  { id: "w7", term: "leverage", definition: "To use something to maximum advantage", phonetic: "/ˈlevərɪdʒ/", partOfSpeech: "v/n", examples: ["We should leverage our existing partnerships", "Use your experience as leverage in negotiations"], synonyms: ["utilize", "exploit", "capitalize"], category: "business", srs: {} },
  { id: "w8", term: "consensus", definition: "A general agreement among a group", phonetic: "/kənˈsensəs/", partOfSpeech: "n", examples: ["The committee reached a consensus on the budget", "Building consensus takes time and patience"], synonyms: ["agreement", "accord", "unanimity"], category: "toeic", srs: {} },
  { id: "w9", term: "latency", definition: "The delay before a transfer of data begins", phonetic: "/ˈleɪtənsi/", partOfSpeech: "n", examples: ["Low latency is crucial for real-time applications", "We reduced latency by 50% with the new CDN"], synonyms: ["delay", "lag", "response time"], category: "tech", srs: {} },
  { id: "w10", term: "pragmatic", definition: "Dealing with things in a practical rather than theoretical way", phonetic: "/præɡˈmætɪk/", partOfSpeech: "adj", examples: ["She took a pragmatic approach to problem-solving", "We need pragmatic solutions, not idealistic ones"], synonyms: ["practical", "realistic", "sensible"], category: "academic", srs: {} },
  { id: "w11", term: "itinerary", definition: "A planned route or journey; a travel schedule", phonetic: "/aɪˈtɪnəreri/", partOfSpeech: "n", examples: ["Please check the itinerary for tomorrow's trip", "I'll send you the detailed itinerary by email"], synonyms: ["schedule", "plan", "route"], category: "travel", srs: {} },
  { id: "w12", term: "concurrent", definition: "Existing, happening, or done at the same time", phonetic: "/kənˈkʌrənt/", partOfSpeech: "adj", examples: ["The system handles concurrent requests efficiently", "She managed concurrent projects successfully"], synonyms: ["simultaneous", "parallel", "synchronous"], category: "tech", srs: {} },
  { id: "w13", term: "deteriorate", definition: "To become progressively worse", phonetic: "/dɪˈtɪəriəreɪt/", partOfSpeech: "v", examples: ["The building's condition continued to deteriorate", "Relations between the two countries deteriorated"], synonyms: ["decline", "worsen", "degrade"], category: "ielts", srs: {} },
  { id: "w14", term: "provisional", definition: "Arranged or existing for the present, possibly to be changed later", phonetic: "/prəˈvɪʒənəl/", partOfSpeech: "adj", examples: ["They reached a provisional agreement", "This is a provisional schedule, subject to change"], synonyms: ["temporary", "interim", "tentative"], category: "business", srs: {} },
  { id: "w15", term: "commute", definition: "To travel regularly between home and work", phonetic: "/kəˈmjuːt/", partOfSpeech: "v/n", examples: ["I commute 45 minutes to work every day", "The long commute was exhausting"], synonyms: ["travel", "journey"], category: "daily", srs: {} },
  { id: "w16", term: "throughput", definition: "The amount of material or items passing through a system", phonetic: "/ˈθruːpʊt/", partOfSpeech: "n", examples: ["We need to increase server throughput", "Factory throughput doubled after automation"], synonyms: ["output", "productivity", "capacity"], category: "tech", srs: {} },
  { id: "w17", term: "feasible", definition: "Possible and practical to do or achieve", phonetic: "/ˈfiːzəbəl/", partOfSpeech: "adj", examples: ["Is this plan feasible within our budget?", "We conducted a feasible study before starting"], synonyms: ["achievable", "viable", "doable"], category: "toeic", srs: {} },
  { id: "w18", term: "meticulous", definition: "Showing great attention to detail; very careful", phonetic: "/mɪˈtɪkjələs/", partOfSpeech: "adj", examples: ["She is meticulous in her research methodology", "The meticulous planning paid off"], synonyms: ["thorough", "precise", "diligent"], category: "academic", srs: {} },
  { id: "w19", term: "accommodate", definition: "To provide lodging or room for; to adjust to", phonetic: "/əˈkɒmədeɪt/", partOfSpeech: "v", examples: ["The hotel can accommodate 200 guests", "We'll accommodate your schedule"], synonyms: ["house", "adapt", "adjust"], category: "travel", srs: {} },
  { id: "w20", term: "benchmark", definition: "A standard or point of reference for evaluation", phonetic: "/ˈbentʃmɑːrk/", partOfSpeech: "n/v", examples: ["Industry benchmarks show we're above average", "We need to benchmark our performance"], synonyms: ["standard", "reference", "criterion"], category: "business", srs: {} },
];

// ── HELPER FUNCTIONS ──────────────────────────────────────────
const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const getFailureRate = (word) => {
  const totalReviews = word.srs?.totalReviews || 0;
  const wrongReviews = word.srs?.wrongReviews || 0;
  return totalReviews > 0 ? wrongReviews / totalReviews : 0;
};

const isWeakWord = (word) => {
  const totalReviews = word.srs?.totalReviews || 0;
  if (totalReviews < 3) return false;
  return getFailureRate(word) >= 0.3;
};

const getReviewPriority = (word, isDue = false) => {
  const reps = word.srs?.repetitions || 0;
  const interval = word.srs?.interval || 0;
  const failureRate = getFailureRate(word);

  let overdueDays = 0;
  if (word.srs?.nextReview) {
    const diffMs = Date.now() - new Date(word.srs.nextReview).getTime();
    overdueDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  return (
    (isDue ? 1000 : 0) +
    failureRate * 250 +
    Math.max(0, 5 - reps) * 12 +
    Math.max(0, 2 - interval) * 8 +
    overdueDays * 2
  );
};

const interleaveByLesson = (words, limit) => {
  const buckets = new Map();
  words.forEach((word) => {
    const key = word.lesson || "general";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(word);
  });

  const groups = [...buckets.values()];
  const result = [];

  while (result.length < limit && groups.some((group) => group.length > 0)) {
    groups.forEach((group) => {
      if (group.length > 0 && result.length < limit) {
        result.push(group.shift());
      }
    });
  }

  return result;
};

// Smart word selection: prioritize due + weak words, then interleave lessons
const selectWordsForReview = (allWords, dueWords, limit) => {
  const dueIds = new Set(dueWords.map((w) => w.id));

  const prioritizedDue = [...dueWords]
    .sort((a, b) => getReviewPriority(b, true) - getReviewPriority(a, true));

  if (prioritizedDue.length >= limit) {
    return interleaveByLesson(prioritizedDue, limit);
  }

  const selected = interleaveByLesson(prioritizedDue, prioritizedDue.length);
  const remaining = limit - selected.length;

  if (remaining > 0) {
    const notDue = allWords
      .filter((w) => !dueIds.has(w.id) && !w.srs?.mastered)
      .sort((a, b) => getReviewPriority(b, false) - getReviewPriority(a, false));

    selected.push(...interleaveByLesson(notDue, remaining));
  }

  return selected;
};

const speak = (text, rate = 0.85) => {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    // Remove Vietnamese translation (everything from '(' onwards)
    const englishOnly = text.split('(')[0].trim();
    const u = new SpeechSynthesisUtterance(englishOnly);
    u.lang = "en-US";
    u.rate = rate;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
  }
};

const formatDate = (iso) => {
  if (!iso) return "Never";
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((d - now) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return "Overdue";
  return `In ${diff} days`;
};

const VIETMIX_ARTICLES_KEY = "vm_vietmix_articles";
const getVietMixArticlesStorageKey = (userId) => (userId ? `${VIETMIX_ARTICLES_KEY}_${userId}` : VIETMIX_ARTICLES_KEY);

const normalizeTerm = (value) => `${value || ""}`.toLowerCase().replace(/\s+/g, " ").trim();

const getMeaningGloss = (word) => {
  const raw = `${word?.definition || ""}`.replace(/\s+/g, " ").trim();
  if (!raw) return "chua co nghia";

  const firstChunk = raw.split(/[;,]/)[0].trim();
  const gloss = firstChunk || raw;
  return gloss.length > 46 ? `${gloss.slice(0, 46)}...` : gloss;
};

const buildVietMixPassageFromWords = (words, title = "TOEIC Mixed Reading") => {
  const sequence = (words || []).filter(Boolean).slice(0, 5);
  if (sequence.length === 0) return null;
  while (sequence.length < 5) sequence.push(sequence[0]);

  const [w1, w2, w3, w4, w5] = sequence;
  const token = (w) => `${w.term} (${getMeaningGloss(w)})`;

  const lines = [
    `Sang nay toi vao van phong va thay tu ${token(w1)} xuat hien ngay tren email dau tien.`,
    `Trong buoi hop, quan ly nhac ca nhom can ${token(w2)} de xu ly cong viec dung ke hoach.`,
    `Khi lam bao cao, toi co gang ${token(w3)} va luon kiem tra ky tung chi tiet.`,
    `Den chieu, toi ghi chu them ${token(w4)} de nho tu vung TOEIC nhanh hon.`,
    `Truoc khi ket thuc ngay, toi on lai ${token(w5)} va dat muc tieu dung dung trong giao tiep.`,
  ];

  return {
    title: title || "TOEIC Mixed Reading",
    lines,
    focusWords: [w1, w2, w3, w4, w5],
    source: "auto",
  };
};

// ── CSS STYLES (injected) ─────────────────────────────────────
const injectStyles = () => {
  if (document.getElementById("vm-styles")) return;
  const style = document.createElement("style");
  style.id = "vm-styles";
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    @keyframes vmFadeIn { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
    @keyframes vmSlideUp { from { opacity:0; transform:translateY(40px) } to { opacity:1; transform:translateY(0) } }
    @keyframes vmScaleIn { from { opacity:0; transform:scale(0.9) } to { opacity:1; transform:scale(1) } }
    @keyframes vmPulse { 0%,100% { transform:scale(1) } 50% { transform:scale(1.05) } }
    @keyframes vmShake { 0%,100% { transform:translateX(0) } 25% { transform:translateX(-8px) } 75% { transform:translateX(8px) } }
    @keyframes vmGlow { 0%,100% { box-shadow:0 0 20px rgba(108,92,231,0.2) } 50% { box-shadow:0 0 40px rgba(108,92,231,0.4) } }
    @keyframes vmFloat { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-6px) } }
    @keyframes vmConfetti { 0% { transform:translateY(0) rotate(0deg); opacity:1 } 100% { transform:translateY(-200px) rotate(720deg); opacity:0 } }
    @keyframes vmFlip { 0% { transform:rotateY(0deg) } 50% { transform:rotateY(90deg) } 100% { transform:rotateY(0deg) } }
    @keyframes vmProgress { from { width:0 } }
    @keyframes vmStreakFire { 0%,100% { transform:scale(1) rotate(-3deg) } 50% { transform:scale(1.2) rotate(3deg) } }
    @keyframes vmRipple { to { transform:scale(4); opacity:0 } }
    @keyframes vmGradientShift { 0% { background-position:0% 50% } 50% { background-position:100% 50% } 100% { background-position:0% 50% } }
    @keyframes vmBounceIn { 0% { transform:scale(0.3); opacity:0 } 50% { transform:scale(1.05) } 70% { transform:scale(0.95) } 100% { transform:scale(1); opacity:1 } }
    
    .vm-app {
      font-family: 'Outfit', sans-serif;
      background: ${THEME.bg};
      color: ${THEME.text};
      min-height: 100vh;
      overflow-x: hidden;
    }
    
    .vm-app::-webkit-scrollbar { width: 6px; }
    .vm-app::-webkit-scrollbar-track { background: transparent; }
    .vm-app::-webkit-scrollbar-thumb { background: ${THEME.border}; border-radius: 3px; }
    
    .vm-mono { font-family: 'JetBrains Mono', monospace; }
    
    .vm-glass {
      background: rgba(26,26,40,0.7);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.06);
    }
    
    .vm-btn {
      cursor: pointer;
      border: none;
      font-family: 'Outfit', sans-serif;
      font-weight: 600;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
    }
    .vm-btn:active { transform: scale(0.96); }
    
    .vm-card {
      background: ${THEME.card};
      border: 1px solid ${THEME.border};
      border-radius: 16px;
      transition: all 0.3s ease;
    }
    .vm-card:hover { border-color: rgba(108,92,231,0.3); }
    
    .vm-input {
      font-family: 'Outfit', sans-serif;
      background: ${THEME.surface};
      border: 1.5px solid ${THEME.border};
      color: ${THEME.text};
      border-radius: 12px;
      padding: 12px 16px;
      font-size: 15px;
      width: 100%;
      transition: all 0.2s ease;
      outline: none;
    }
    .vm-input:focus { border-color: ${THEME.accent}; box-shadow: 0 0 0 3px ${THEME.accentGlow}; }
    .vm-input::placeholder { color: ${THEME.textMuted}; }
    
    .vm-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    
    .vm-tooltip { position: relative; }
    .vm-tooltip::after {
      content: attr(data-tip);
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%) translateY(-4px);
      background: ${THEME.card};
      border: 1px solid ${THEME.border};
      color: ${THEME.text};
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s;
    }
    .vm-tooltip:hover::after { opacity: 1; }
    
    .vm-nav-item {
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 8px 12px;
      border-radius: 12px;
      transition: all 0.2s ease;
      font-size: 11px;
      font-weight: 500;
      color: ${THEME.textMuted};
      min-width: 64px;
      flex-shrink: 0;
    }
    .vm-nav-item:hover { color: ${THEME.textSecondary}; }
    .vm-nav-item.active { color: ${THEME.accent}; background: rgba(108,92,231,0.1); }
    .vm-nav-item .nav-icon { font-size: 22px; }

    /* Mobile optimization - hide labels on small screens */
    @media (max-width: 480px) {
      .vm-nav-item {
        min-width: 48px;
        padding: 6px 8px;
        gap: 2px;
      }
      .vm-nav-item .nav-label {
        display: none;
      }
      .vm-nav-item .nav-icon {
        font-size: 24px;
      }
    }
    
    .vm-streak-badge {
      animation: vmStreakFire 1.5s ease-in-out infinite;
      display: inline-block;
    }
    
    .vm-progress-ring {
      transform: rotate(-90deg);
    }
    
    .vm-flashcard {
      perspective: 1000px;
      cursor: pointer;
    }
    .vm-flashcard-inner {
      transition: transform 0.6s ease;
      transform-style: preserve-3d;
    }
    .vm-flashcard-inner.flipped { transform: rotateY(180deg); }
    .vm-flashcard-front, .vm-flashcard-back {
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
    }
    .vm-flashcard-back { transform: rotateY(180deg); }
  `;
  document.head.appendChild(style);
};

// ── REUSABLE COMPONENTS ───────────────────────────────────────
const ProgressRing = ({ progress, size = 60, stroke = 5, color = THEME.accent }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(progress, 1) * c);
  return (
    <svg width={size} height={size} className="vm-progress-ring">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={THEME.border} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.8s ease" }} />
    </svg>
  );
};

const StatCard = ({ icon, label, value, color = THEME.accent, sub }) => (
  <div className="vm-card" style={{ padding: "16px", display: "flex", alignItems: "center", gap: 14 }}>
    <div style={{
      width: 44, height: 44, borderRadius: 12,
      background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 22, flexShrink: 0
    }}>{icon}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: THEME.textSecondary, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: THEME.textMuted }}>{sub}</div>}
    </div>
  </div>
);

const RatingButtons = ({ onRate, showEasy = true, word = null }) => {
  // Calculate actual next intervals based on word's current progress
  const getIntervalLabel = (rating) => {
    if (!word) return { again: "< 1d", hard: "1d", good: "3d", easy: "7d" }[rating];

    const quality = SRSEngine.qualityFromRating(rating);
    const nextInterval = SRSEngine.getNextInterval(word, quality);

    if (rating === "again") return "< 1d";
    if (nextInterval >= 60) return "60d (Mastered!)";
    return `${nextInterval}d`;
  };

  // Check if this is a new word (never reviewed before)
  const isNewWord = !word?.srs?.repetitions || word.srs.repetitions === 0;

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {[
        { key: "again", label: "Again", icon: "✕", color: THEME.danger, bg: THEME.dangerGlow },
        { key: "hard", label: "Hard", icon: "⚡", color: THEME.warning, bg: THEME.warningGlow },
        // Hide Good and Easy for new words (force 1-day review first)
        ...(!isNewWord ? [{ key: "good", label: "Good", icon: "✓", color: THEME.success, bg: THEME.successGlow }] : []),
        ...(!isNewWord && showEasy ? [{ key: "easy", label: "Easy", icon: "★", color: THEME.info, bg: "rgba(116,185,255,0.3)" }] : []),
      ].map(({ key, label, icon, color, bg }) => (
        <button key={key} className="vm-btn" onClick={() => onRate(key)} style={{
          flex: 1, minWidth: 70, padding: "14px 8px", borderRadius: 14,
          background: bg, color, fontSize: 14, display: "flex", flexDirection: "column",
          alignItems: "center", gap: 4, border: `1.5px solid ${color}30`,
        }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span style={{ fontWeight: 700 }}>{label}</span>
          <span style={{ fontSize: 10, opacity: 0.7 }}>{getIntervalLabel(key)}</span>
        </button>
      ))}
    </div>
  );
};

const WordCard = ({ word, showDef, onFlip, compact }) => {
  const mastery = SRSEngine.getMasteryLevel(word);
  const m = MASTERY[mastery];
  return (
    <div className="vm-card" onClick={onFlip} style={{
      padding: compact ? 16 : 28, cursor: onFlip ? "pointer" : "default",
      position: "relative", overflow: "hidden",
      animation: "vmScaleIn 0.3s ease",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: m.color, opacity: 0.6,
      }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span className="vm-tag" style={{ background: `${m.color}20`, color: m.color }}>
          {m.icon} {m.name}
        </span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span className="vm-tag" style={{ background: `${THEME.accent}15`, color: THEME.accentLight, fontSize: 11 }}>
            {word.partOfSpeech}
          </span>
          <button className="vm-btn" onClick={(e) => { e.stopPropagation(); speak(word.term); }}
            style={{ background: "none", color: THEME.accentLight, fontSize: 18, padding: 4 }}>
            🔊
          </button>
        </div>
      </div>
      
      <div style={{ fontSize: compact ? 24 : 32, fontWeight: 800, marginBottom: 4, letterSpacing: "-0.5px" }}>
        {word.term}
      </div>
      <div className="vm-mono" style={{ fontSize: 13, color: THEME.textMuted, marginBottom: showDef ? 16 : 0 }}>
        {word.phonetic}
      </div>
      
      {showDef && (
        <div style={{ animation: "vmFadeIn 0.4s ease" }}>
          <div style={{
            padding: 16, borderRadius: 12, background: `${THEME.accent}08`,
            border: `1px solid ${THEME.accent}15`, marginBottom: 14,
          }}>
            <div style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.5 }}>{word.definition}</div>
          </div>
          
          {word.examples?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                Examples
              </div>
              {word.examples.map((ex, i) => (
                <div key={i} style={{
                  padding: "10px 14px", borderRadius: 10, marginBottom: 6,
                  background: THEME.surface, borderLeft: `3px solid ${THEME.accent}40`,
                  fontSize: 14, color: THEME.textSecondary, lineHeight: 1.5, fontStyle: "italic",
                  display: "flex", alignItems: "center", gap: 8
                }}>
                  <div style={{ flex: 1 }}>"{ex}"</div>
                  <button
                    className="vm-btn"
                    onClick={(e) => { e.stopPropagation(); speak(ex); }}
                    style={{
                      background: "none",
                      color: THEME.accent,
                      fontSize: 18,
                      padding: 4,
                      flexShrink: 0
                    }}
                    title="Listen to example"
                  >
                    🔊
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {word.synonyms?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <span style={{ fontSize: 11, color: THEME.textMuted, fontWeight: 600 }}>≈</span>
              {word.synonyms.map((s, i) => (
                <span key={i} className="vm-tag" style={{ background: `${THEME.success}12`, color: THEME.success }}>
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      
      {!showDef && onFlip && (
        <div style={{ marginTop: 20, textAlign: "center", color: THEME.textMuted, fontSize: 13 }}>
          Tap to reveal definition
        </div>
      )}
    </div>
  );
};

// ── MAIN APP ──────────────────────────────────────────────────
export default function VocabMasterPro({
  userId = null,
  userEmail = null,
  userPhoto = null,
  onSignOut = null,
  firestoreService = null
} = {}) {
  // Ref to prevent save loop when syncing from Firestore
  const isSyncingFromFirestore = useRef(false);
  // Ref to pause Firestore updates during learning session
  const isInLearningSession = useRef(false);
  // Ref to store pending review updates (deferred to avoid parent re-render during review)
  const pendingReviewUpdate = useRef(null);
  // Ref to accumulate learn session data across batches (deferred to avoid parent re-render)
  const pendingLearnUpdates = useRef({ reviews: [], queueWords: [] });

  // State
  const [words, setWords] = useState(() => {
    // If using Firestore, start with empty array (will load from Firestore)
    if (firestoreService) return [];

    // Fallback to localStorage
    try {
      const saved = localStorage?.getItem?.("vm_words");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.length > 0 ? parsed : getAllTOEICWords();
      }
      return getAllTOEICWords();
    } catch {
      return getAllTOEICWords();
    }
  });

  const [screen, setScreen] = useState("home");
  const [selectedLesson, setSelectedLesson] = useState(null); // null = all lessons
  const [reviewFocusModePref, setReviewFocusModePref] = useState(false);

  const [stats, setStats] = useState(() => {
    // If using Firestore, start with empty stats (will load from Firestore)
    if (firestoreService) {
      return {
        streak: 0, lastStudyDate: null, totalReviews: 0, totalQuizzes: 0,
        perfectQuizzes: 0, nightStudy: false, speedReview: false, todayReviews: 0,
        todayDate: new Date().toDateString(), xp: 0, dailyGoal: 20,
      };
    }

    // Fallback to localStorage
    try {
      const saved = localStorage?.getItem?.("vm_stats");
      return saved ? { dailyGoal: 20, ...JSON.parse(saved) } : {
        streak: 0, lastStudyDate: null, totalReviews: 0, totalQuizzes: 0,
        perfectQuizzes: 0, nightStudy: false, speedReview: false, todayReviews: 0,
        todayDate: new Date().toDateString(), xp: 0, dailyGoal: 20,
      };
    } catch {
      return { streak: 0, lastStudyDate: null, totalReviews: 0, totalQuizzes: 0, perfectQuizzes: 0, nightStudy: false, speedReview: false, todayReviews: 0, todayDate: new Date().toDateString(), xp: 0, dailyGoal: 20 };
    }
  });

  const [toast, setToast] = useState(null);
  // Track whether initial Firestore data has loaded (prevents flicker on login)
  const [dataReady, setDataReady] = useState(!firestoreService);
  const firestoreInitRef = useRef({ words: false, stats: false });

  // Firestore realtime sync
  useEffect(() => {
    if (!firestoreService || !userId) return;

    console.log('🔄 Setting up Firestore realtime sync...');
    firestoreInitRef.current = { words: false, stats: false };

    let pendingWords = null;
    let pendingStats = null;

    const tryFinishInit = () => {
      if (firestoreInitRef.current.words && firestoreInitRef.current.stats) {
        // Both arrived - batch into single render
        isSyncingFromFirestore.current = true;
        if (pendingWords !== null) setWords(pendingWords);
        if (pendingStats !== null) setStats(pendingStats);
        setDataReady(true);
        setTimeout(() => { isSyncingFromFirestore.current = false; }, 100);
      }
    };

    // Subscribe to words
    const unsubscribeWords = firestoreService.subscribeToWords((firestoreWords) => {
      // Skip updates during learning session to prevent re-renders
      if (isInLearningSession.current) {
        console.log('⏸️ Skipping Firestore sync (learning session in progress)');
        return;
      }

      if (!firestoreInitRef.current.words) {
        // Initial load - batch with stats
        console.log(`✅ Initial sync: ${firestoreWords.length} words from Firestore`);
        pendingWords = firestoreWords.length > 0 ? firestoreWords : [];
        firestoreInitRef.current.words = true;
        tryFinishInit();
        return;
      }

      // Subsequent updates - apply directly
      isSyncingFromFirestore.current = true;
      if (firestoreWords.length > 0) {
        console.log(`✅ Synced ${firestoreWords.length} words from Firestore`);
        setWords(firestoreWords);
      } else {
        setWords([]);
      }
      setTimeout(() => { isSyncingFromFirestore.current = false; }, 100);
    });

    // Subscribe to stats
    const unsubscribeStats = firestoreService.subscribeToStats((firestoreStats) => {
      // Skip updates during learning session to prevent re-renders
      if (isInLearningSession.current) {
        console.log('⏸️ Skipping stats sync (learning session in progress)');
        return;
      }

      if (!firestoreInitRef.current.stats) {
        // Initial load - batch with words
        console.log('✅ Initial sync: stats from Firestore');
        pendingStats = Object.keys(firestoreStats).length > 0 ? firestoreStats : null;
        firestoreInitRef.current.stats = true;
        tryFinishInit();
        return;
      }

      // Subsequent updates - apply directly
      if (Object.keys(firestoreStats).length > 0) {
        isSyncingFromFirestore.current = true;
        console.log('✅ Synced stats from Firestore');
        setStats(firestoreStats);
        setTimeout(() => { isSyncingFromFirestore.current = false; }, 100);
      }
    });

    // Safety timeout - if one subscription is slow, don't block forever
    const safetyTimeout = setTimeout(() => {
      if (!firestoreInitRef.current.words) firestoreInitRef.current.words = true;
      if (!firestoreInitRef.current.stats) firestoreInitRef.current.stats = true;
      tryFinishInit();
    }, 5000);

    return () => {
      unsubscribeWords();
      unsubscribeStats();
      clearTimeout(safetyTimeout);
    };
  }, [firestoreService, userId]);

  // Persist to Firestore or localStorage
  useEffect(() => {
    if (firestoreService && userId) {
      // Skip if currently syncing from Firestore (prevent loop)
      if (isSyncingFromFirestore.current) {
        console.log('⏭️ Skipping save - syncing from Firestore');
        return;
      }

      // Save stats to Firestore (debounced)
      // Words are saved individually in updateWordSRS
      const timeoutId = setTimeout(() => {
        console.log('💾 Saving stats to Firestore...');
        firestoreService.saveStats(stats);
      }, 2000); // Debounce 2s

      return () => clearTimeout(timeoutId);
    }
  }, [stats, firestoreService, userId]);

  // Separate localStorage backup (only when NOT using Firestore)
  useEffect(() => {
    if (!firestoreService || !userId) {
      // Fallback to localStorage
      try {
        localStorage?.setItem?.("vm_words", JSON.stringify(words));
        localStorage?.setItem?.("vm_stats", JSON.stringify(stats));
        autoBackup(words, stats);
      } catch {}
    }
  }, [words, stats, firestoreService, userId]);
  
  // Inject styles on mount
  useEffect(() => { injectStyles(); }, []);
  
  // Toast system
  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);
  
  // Update streak
  const updateStreak = useCallback(() => {
    setStats(prev => {
      const today = new Date().toDateString();
      if (prev.lastStudyDate === today) return { ...prev, todayReviews: prev.todayReviews + 1 };
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const isConsecutive = prev.lastStudyDate === yesterday.toDateString();
      
      const hour = new Date().getHours();
      return {
        ...prev,
        streak: isConsecutive ? prev.streak + 1 : 1,
        lastStudyDate: today,
        todayReviews: prev.todayDate === today ? prev.todayReviews + 1 : 1,
        todayDate: today,
        nightStudy: prev.nightStudy || (hour >= 0 && hour < 5),
      };
    });
  }, []);
  
  // Update word after review (full update - use outside of learning sessions)
  const updateWordSRS = useCallback((wordId, rating) => {
    const quality = SRSEngine.qualityFromRating(rating);
    setWords(prev => prev.map(w => {
      if (w.id !== wordId) return w;
      const updated = { ...w, srs: SRSEngine.processReview(w, quality) };

      // Save to Firestore if available
      if (firestoreService && userId) {
        firestoreService.saveWord(updated);
      }

      return updated;
    }));
    updateStreak();
    setStats(prev => {
      const newTodayReviews = (prev.todayDate === new Date().toDateString() ? prev.todayReviews : 0) + 1;
      const dailyGoal = prev.dailyGoal || 20;

      // Check if goal just reached
      if (newTodayReviews === dailyGoal) {
        setTimeout(() => showToast(`🎉 Daily goal reached! ${dailyGoal} reviews completed!`, "success"), 300);
      }

      return {
        ...prev,
        totalReviews: prev.totalReviews + 1,
        xp: prev.xp + (quality >= 4 ? 15 : quality >= 3 ? 10 : 5),
      };
    });
  }, [updateStreak, firestoreService, userId, showToast]);

  // Update word during learning session (NO Firestore, NO parent state - pure calculation only!)
  const updateWordSRSInSession = useCallback((word, rating) => {
    const quality = SRSEngine.qualityFromRating(rating);
    const updated = { ...word, srs: SRSEngine.processReview(word, quality) };

    // ⚠️ DO NOT save to Firestore here!
    // Firestore subscription would trigger re-render and reset LearnScreen
    // Will batch save all updates when session ends

    return { updated, quality };
  }, []);
  
  // Computed
  // Filter words by selected lesson (null = all lessons)
  const filteredWords = useMemo(() => {
    if (!selectedLesson) return words;
    return words.filter(w => w.lesson === selectedLesson);
  }, [words, selectedLesson]);

  const dueWords = useMemo(() => filteredWords.filter(w => SRSEngine.isDueForReview(w)), [filteredWords]);
  const allDueWords = useMemo(() => words.filter(w => SRSEngine.isDueForReview(w)), [words]);
  const weakWords = useMemo(() => words.filter((w) => isWeakWord(w)), [words]);
  const lessonInsights = useMemo(() => {
    return TOEIC_LESSONS.map((lesson) => {
      const lessonWords = words.filter((w) => w.lesson === lesson.id);
      const total = lessonWords.length;
      if (total === 0) {
        return {
          id: lesson.id,
          title: lesson.title,
          total: 0,
          due: 0,
          weak: 0,
          mastered: 0,
          progress: 0,
          priority: 0,
        };
      }

      const due = lessonWords.filter((w) => SRSEngine.isDueForReview(w)).length;
      const weak = lessonWords.filter((w) => isWeakWord(w)).length;
      const mastered = lessonWords.filter((w) => w.srs?.mastered).length;
      const progress = mastered / total;

      return {
        id: lesson.id,
        title: lesson.title,
        total,
        due,
        weak,
        mastered,
        progress,
        priority: due * 3 + weak * 4 + (1 - progress) * 2,
      };
    })
      .filter((lesson) => lesson.total > 0)
      .sort((a, b) => b.priority - a.priority || a.progress - b.progress);
  }, [words]);
  const recommendedLesson = lessonInsights[0] || null;
  const todayPlan = useMemo(() => {
    const dailyGoal = stats.dailyGoal || 20;
    const dueCount = allDueWords.length;
    const weakCount = weakWords.length;
    const catchupBoost = Math.min(15, dueCount);
    const weakBoost = Math.min(10, weakCount);
    const suggestedReviews = Math.max(dailyGoal, catchupBoost + weakBoost);

    return {
      dueCount,
      weakCount,
      suggestedReviews,
      recommendedLessonTitle: recommendedLesson?.title || "No recommendation",
      recommendedLessonId: recommendedLesson?.id || null,
    };
  }, [stats.dailyGoal, allDueWords.length, weakWords.length, recommendedLesson]);
  const masteryDist = useMemo(() => {
    const dist = [0, 0, 0, 0, 0];
    words.forEach(w => dist[SRSEngine.getMasteryLevel(w)]++);
    return dist;
  }, [words]);
  const todayProgress = Math.min(1, (stats.todayReviews || 0) / (stats.dailyGoal || 20));
  const unlockedAchievements = useMemo(() =>
    ACHIEVEMENTS.filter(a => a.condition({ ...stats, totalWords: words.length })),
    [stats, words.length]
  );

  // ── SCREENS ─────────────────────────────────────────────────
  
  // HOME SCREEN
  const HomeScreen = () => (
    <div style={{ padding: "20px 16px 100px", maxWidth: 480, margin: "0 auto", animation: "vmFadeIn 0.4s ease" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 14, color: THEME.textMuted, fontWeight: 500 }}>Welcome back</div>
          <div style={{ fontSize: 28, fontWeight: 800, background: THEME.gradient1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            VocabMaster
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {stats.streak > 0 && (
            <div className="vm-streak-badge" style={{
              background: `${THEME.danger}20`, padding: "8px 14px", borderRadius: 20,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ fontSize: 20 }}>🔥</span>
              <span style={{ fontWeight: 800, color: THEME.danger, fontSize: 18 }}>{stats.streak}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Today's Progress */}
      <div className="vm-card" style={{ padding: 20, marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: 0, left: 0, width: `${todayProgress * 100}%`,
          height: "100%", background: `${THEME.accent}08`,
          transition: "width 0.8s ease",
        }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16 }}>
          <ProgressRing progress={todayProgress} size={64} stroke={5} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: THEME.textSecondary, fontWeight: 500 }}>Today's Goal</div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>
              {stats.todayReviews || 0}<span style={{ fontSize: 14, color: THEME.textMuted }}> / {stats.dailyGoal || 20} reviews</span>
            </div>
            <div style={{ fontSize: 12, color: THEME.accent, fontWeight: 600 }}>
              {stats.xp} XP earned
            </div>
          </div>
        </div>
      </div>

      {/* TOEIC Smart Plan */}
      <div className="vm-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>TOEIC Smart Plan</div>
          <div style={{ fontSize: 11, color: THEME.textSecondary }}>Adaptive daily target</div>
        </div>

        <div style={{ fontSize: 13, color: THEME.textSecondary, marginBottom: 12 }}>
          Recommended lesson: <strong style={{ color: THEME.text }}>{todayPlan.recommendedLessonTitle}</strong>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          <div style={{ padding: 10, borderRadius: 10, background: `${THEME.danger}10`, border: `1px solid ${THEME.danger}25` }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: THEME.danger }}>{todayPlan.dueCount}</div>
            <div style={{ fontSize: 10, color: THEME.textMuted }}>Due today</div>
          </div>
          <div style={{ padding: 10, borderRadius: 10, background: `${THEME.warning}12`, border: `1px solid ${THEME.warning}25` }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: THEME.warning }}>{todayPlan.weakCount}</div>
            <div style={{ fontSize: 10, color: THEME.textMuted }}>Weak words</div>
          </div>
          <div style={{ padding: 10, borderRadius: 10, background: `${THEME.accent}10`, border: `1px solid ${THEME.accent}25` }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: THEME.accent }}>{todayPlan.suggestedReviews}</div>
            <div style={{ fontSize: 10, color: THEME.textMuted }}>Target reviews</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="vm-btn"
            onClick={() => {
              if (todayPlan.recommendedLessonId) {
                setSelectedLesson(todayPlan.recommendedLessonId);
              }
              setScreen("learn");
            }}
            style={{
              flex: 1, padding: "10px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700,
              background: `${THEME.accent}20`, color: THEME.accent, border: `1px solid ${THEME.accent}35`,
            }}
          >
            Learn Suggested
          </button>
          <button
            className="vm-btn"
            onClick={() => {
              setReviewFocusModePref(true);
              setScreen("review");
            }}
            style={{
              flex: 1, padding: "10px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700,
              background: `${THEME.warning}20`, color: THEME.warning, border: `1px solid ${THEME.warning}40`,
            }}
          >
            Priority Review
          </button>
        </div>
      </div>
      
      {/* Quick Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        <button className="vm-btn" onClick={() => setScreen("learn")} style={{
          padding: 20, borderRadius: 16, background: THEME.gradient1, color: "#fff",
          display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8,
        }}>
          <span style={{ fontSize: 28 }}>🧠</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Learn</span>
          <span style={{ fontSize: 12, opacity: 0.8 }}>Active Recall</span>
        </button>
        
        <button className="vm-btn" onClick={() => { setReviewFocusModePref(false); setScreen("review"); }} style={{
          padding: 20, borderRadius: 16, background: THEME.gradient2, color: "#fff",
          display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8,
          position: "relative",
        }}>
          <span style={{ fontSize: 28 }}>🔄</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Review</span>
          <span style={{ fontSize: 12, opacity: 0.8 }}>{allDueWords.length} due</span>
          {allDueWords.length > 0 && (
            <div style={{
              position: "absolute", top: 12, right: 12,
              background: "#fff", color: "#222", borderRadius: 20,
              padding: "2px 8px", fontSize: 12, fontWeight: 800,
            }}>{allDueWords.length}</div>
          )}
        </button>
        
        <button className="vm-btn" onClick={() => setScreen("quiz")} style={{
          padding: 20, borderRadius: 16, background: THEME.gradient3, color: "#fff",
          display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8,
        }}>
          <span style={{ fontSize: 28 }}>❓</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Quiz</span>
          <span style={{ fontSize: 12, opacity: 0.8 }}>6 modes</span>
        </button>
        
        <button className="vm-btn" onClick={() => setScreen("words")} style={{
          padding: 20, borderRadius: 16, background: THEME.gradient4, color: "#333",
          display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8,
        }}>
          <span style={{ fontSize: 28 }}>📚</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Words</span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>{words.length} total</span>
        </button>
      </div>
      
      {/* Mastery Distribution */}
      <div className="vm-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Mastery Progress</div>
        <div style={{ display: "flex", gap: 4, height: 32, borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
          {masteryDist.map((count, i) => (
            <div key={i} style={{
              flex: count || 0.3, background: MASTERY[i].color,
              transition: "flex 0.5s ease", opacity: count ? 1 : 0.15,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "#fff",
              minWidth: count ? 28 : 4,
            }}>
              {count > 0 && count}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {MASTERY.map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: THEME.textSecondary }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: m.color }} />
              {m.icon} {m.name} ({masteryDist[i]})
            </div>
          ))}
        </div>
      </div>
      
      {/* Leitner Boxes */}
      <div className="vm-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>📦 Leitner Boxes</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[0,1,2,3,4].map(box => {
            const count = words.filter(w => SRSEngine.getLeitnerBox(w) === box).length;
            const labels = ["New", "1d", "3d", "7d", "30d+"];
            const colors = ["#636e72", "#e17055", "#fdcb6e", "#74b9ff", "#00b894"];
            return (
              <div key={box} style={{
                flex: 1, textAlign: "center", padding: "12px 4px", borderRadius: 12,
                background: `${colors[box]}12`, border: `1.5px solid ${colors[box]}25`,
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: colors[box] }}>{count}</div>
                <div style={{ fontSize: 10, color: THEME.textMuted, fontWeight: 600 }}>Box {box+1}</div>
                <div style={{ fontSize: 9, color: THEME.textMuted }}>{labels[box]}</div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Achievements */}
      <div className="vm-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>
          🏆 Achievements ({unlockedAchievements.length}/{ACHIEVEMENTS.length})
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {ACHIEVEMENTS.map(a => {
            const unlocked = a.condition({ ...stats, totalWords: words.length });
            return (
              <div key={a.id} style={{
                textAlign: "center", padding: 10, borderRadius: 12,
                background: unlocked ? `${THEME.accent}12` : THEME.surface,
                opacity: unlocked ? 1 : 0.35, transition: "all 0.3s",
              }}>
                <div style={{ fontSize: 24 }}>{a.icon}</div>
                <div style={{ fontSize: 9, fontWeight: 600, marginTop: 4, color: unlocked ? THEME.text : THEME.textMuted }}>
                  {a.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ── LEARN SCREEN (Active Recall) ────────────────────────────
  const LearnScreen = () => {
    const [mode, setMode] = useState(null);
    const [queue, setQueue] = useState([]);
    const [idx, setIdx] = useState(0);
    const [phase, setPhase] = useState("think");
    const [typedAnswer, setTypedAnswer] = useState("");
    const [isCorrect, setIsCorrect] = useState(null);
    const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0 });
    const [sessionHistory, setSessionHistory] = useState([]);
    const inputRef = useRef(null);
    // Track session reviews for batch stats update at end (use ref to avoid re-renders)
    const sessionReviewsRef = useRef([]);
    // Batch learning - track all available words and current batch
    const [allAvailableWords, setAllAvailableWords] = useState([]);
    const [batchSize, setBatchSize] = useState(20);
    const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
    // Sentence Builder state
    const [sentenceWords, setSentenceWords] = useState([]);
    const [userSentence, setUserSentence] = useState([]);
    const [correctSentence, setCorrectSentence] = useState([]);
    // Flashcard state
    const [isFlipped, setIsFlipped] = useState(false);

    // Progressive Hints state
    const [hintsUsed, setHintsUsed] = useState(0);
    const [currentHintLevel, setCurrentHintLevel] = useState(0);
    const [shownHints, setShownHints] = useState([]);
    const [selectedMCOption, setSelectedMCOption] = useState(null);
    const [mcChoices, setMcChoices] = useState([]);
    const [showVietMixEditor, setShowVietMixEditor] = useState(false);
    const [editingVietMixArticleId, setEditingVietMixArticleId] = useState(null);
    const [isSavingVietMixArticle, setIsSavingVietMixArticle] = useState(false);
    const [vietMixDraft, setVietMixDraft] = useState({
      title: "",
      lessonId: "",
      content: "",
      focusTerms: "",
    });
    const [vietMixArticles, setVietMixArticles] = useState([]);
    const [selectedVietMixArticleId, setSelectedVietMixArticleId] = useState("");
    const [vietMixArticlesReady, setVietMixArticlesReady] = useState(false);
    const vietMixStorageKey = useMemo(() => getVietMixArticlesStorageKey(userId), [userId]);

    const normalizeVietMixArticle = useCallback((article, fallbackIndex = 0) => {
      const createdAtRaw = article?.createdAt;
      const createdAt = typeof createdAtRaw === "string"
        ? createdAtRaw
        : createdAtRaw?.toDate
          ? createdAtRaw.toDate().toISOString()
          : new Date(Date.now() - fallbackIndex).toISOString();

      const updatedAtRaw = article?.updatedAt;
      const updatedAt = typeof updatedAtRaw === "string"
        ? updatedAtRaw
        : updatedAtRaw?.toDate
          ? updatedAtRaw.toDate().toISOString()
          : createdAt;

      return {
        id: article?.id || `vm_article_${Date.now()}_${fallbackIndex}`,
        title: `${article?.title || ""}`.trim() || `Bai viet ${fallbackIndex + 1}`,
        lessonId: `${article?.lessonId || ""}`.trim(),
        content: `${article?.content || ""}`.trim(),
        focusTerms: Array.isArray(article?.focusTerms)
          ? article.focusTerms.map((term) => `${term || ""}`.trim()).filter(Boolean)
          : [],
        createdAt,
        updatedAt,
      };
    }, []);

    const sortVietMixArticlesByDate = useCallback((articles) => {
      return [...articles].sort((a, b) => {
        const dateA = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    }, []);

    const upsertVietMixArticleState = useCallback((article) => {
      setVietMixArticles((prev) => {
        const exists = prev.some((item) => item.id === article.id);
        const next = exists
          ? prev.map((item) => (item.id === article.id ? article : item))
          : [article, ...prev];
        return sortVietMixArticlesByDate(next);
      });
    }, [sortVietMixArticlesByDate]);

    useEffect(() => {
      setVietMixArticlesReady(false);

      if (firestoreService?.subscribeToVietMixArticles && userId) {
        const unsubscribe = firestoreService.subscribeToVietMixArticles((articles = []) => {
          const normalized = sortVietMixArticlesByDate(
            (Array.isArray(articles) ? articles : []).map((article, index) => normalizeVietMixArticle(article, index))
          );
          setVietMixArticles(normalized);
          setVietMixArticlesReady(true);
        });
        return () => {
          if (typeof unsubscribe === "function") unsubscribe();
        };
      }

      try {
        const saved = localStorage?.getItem?.(vietMixStorageKey);
        const legacySaved = localStorage?.getItem?.(VIETMIX_ARTICLES_KEY);
        const parsed = saved ? JSON.parse(saved) : legacySaved ? JSON.parse(legacySaved) : [];
        const normalized = sortVietMixArticlesByDate(
          (Array.isArray(parsed) ? parsed : []).map((article, index) => normalizeVietMixArticle(article, index))
        );
        setVietMixArticles(normalized);
      } catch {
        setVietMixArticles([]);
      } finally {
        setVietMixArticlesReady(true);
      }
    }, [
      firestoreService,
      userId,
      vietMixStorageKey,
      normalizeVietMixArticle,
      sortVietMixArticlesByDate,
    ]);

    useEffect(() => {
      if (!vietMixArticlesReady) return;
      if (firestoreService?.subscribeToVietMixArticles && userId) return;

      try {
        localStorage?.setItem?.(vietMixStorageKey, JSON.stringify(vietMixArticles));
      } catch {}
    }, [vietMixArticles, vietMixStorageKey, firestoreService, userId, vietMixArticlesReady]);

    const resetVietMixEditor = useCallback(() => {
      setEditingVietMixArticleId(null);
      setVietMixDraft({
        title: "",
        lessonId: selectedLesson || "",
        content: "",
        focusTerms: "",
      });
      setShowVietMixEditor(false);
    }, [selectedLesson]);
    const notifyLearnScreen = useCallback((msg, type = "warning") => {
      // Avoid parent-level toast updates while learning session is active,
      // because they can reset nested LearnScreen local state.
      if (mode === "vietmix") {
        console.log(`[VietMix] ${msg}`);
        return;
      }
      showToast(msg, type);
    }, [mode, showToast]);

    const handleSaveVietMixArticle = async () => {
      if (isSavingVietMixArticle) return;
      if (!vietMixDraft.content.trim()) {
        notifyLearnScreen("Please add article content first", "warning");
        return;
      }

      const now = new Date().toISOString();
      const articleId = editingVietMixArticleId || `vm_article_${Date.now()}`;
      const existedArticle = vietMixArticles.find((article) => article.id === articleId);
      const article = {
        id: articleId,
        title: vietMixDraft.title.trim() || `Bai viet ${vietMixArticles.length + 1}`,
        lessonId: vietMixDraft.lessonId || currentLessonIdForVietMix || selectedLesson || "",
        content: vietMixDraft.content.trim(),
        focusTerms: vietMixDraft.focusTerms
          .split(",")
          .map((term) => term.trim())
          .filter(Boolean),
        createdAt: existedArticle?.createdAt || now,
        updatedAt: now,
      };

      try {
        setIsSavingVietMixArticle(true);

        if (firestoreService?.saveVietMixArticle && userId) {
          const result = await firestoreService.saveVietMixArticle(article);
          if (!result?.success) throw result?.error || new Error("Save article failed");
        }

        upsertVietMixArticleState(article);
        setSelectedVietMixArticleId(article.id);
        resetVietMixEditor();
        notifyLearnScreen(editingVietMixArticleId ? "Updated VietMix article" : "Saved VietMix article", "success");
      } catch (error) {
        console.error("Failed to save VietMix article:", error);
        const isPermissionError = `${error?.code || ""}`.includes("permission-denied");
        notifyLearnScreen(
          isPermissionError
            ? "Firebase rules do not allow vietmixArticles yet"
            : "Could not save article. Please try again.",
          "warning"
        );
      } finally {
        setIsSavingVietMixArticle(false);
      }
    };

    const handleEditVietMixArticle = (article) => {
      if (!article) return;
      setEditingVietMixArticleId(article.id);
      setVietMixDraft({
        title: article.title || "",
        lessonId: article.lessonId || selectedLesson || "",
        content: article.content || "",
        focusTerms: Array.isArray(article.focusTerms) ? article.focusTerms.join(", ") : "",
      });
      setShowVietMixEditor(true);
    };

    const handleDeleteVietMixArticle = async (articleId) => {
      if (!articleId) return;

      try {
        if (firestoreService?.deleteVietMixArticle && userId) {
          const result = await firestoreService.deleteVietMixArticle(articleId);
          if (!result?.success) throw result?.error || new Error("Delete article failed");
        }

        setVietMixArticles((prev) => prev.filter((article) => article.id !== articleId));
        if (selectedVietMixArticleId === articleId) {
          setSelectedVietMixArticleId("");
        }
        if (editingVietMixArticleId === articleId) {
          resetVietMixEditor();
        }
        notifyLearnScreen("Deleted article", "warning");
      } catch (error) {
        console.error("Failed to delete VietMix article:", error);
        const isPermissionError = `${error?.code || ""}`.includes("permission-denied");
        notifyLearnScreen(
          isPermissionError
            ? "Firebase rules do not allow vietmixArticles yet"
            : "Could not delete article. Please try again.",
          "warning"
        );
      }
    };

    const handleDeleteAllVietMixArticles = async () => {
      if (vietMixArticles.length === 0) {
        notifyLearnScreen("No articles to delete", "warning");
        return;
      }

      const confirmed = window.confirm(`Delete all ${vietMixArticles.length} VietMix articles?`);
      if (!confirmed) return;

      try {
        if (firestoreService?.deleteVietMixArticle && userId) {
          const results = await Promise.all(
            vietMixArticles.map((article) => firestoreService.deleteVietMixArticle(article.id))
          );
          const failed = results.some((result) => !result?.success);
          if (failed) {
            throw new Error("Delete all articles failed");
          }
        }

        setVietMixArticles([]);
        setSelectedVietMixArticleId("");
        resetVietMixEditor();
        try {
          localStorage?.removeItem?.(vietMixStorageKey);
          localStorage?.removeItem?.(VIETMIX_ARTICLES_KEY);
        } catch {}
        notifyLearnScreen("All VietMix articles deleted", "warning");
      } catch (error) {
        console.error("Failed to delete all VietMix articles:", error);
        const isPermissionError = `${error?.code || ""}`.includes("permission-denied");
        notifyLearnScreen(
          isPermissionError
            ? "Firebase rules do not allow vietmixArticles yet"
            : "Failed to delete all articles. Try again.",
          "warning"
        );
      }
    };

    const startSession = (selectedMode, batchIndex = 0) => {
      // Pause Firestore updates during session to prevent re-renders
      isInLearningSession.current = true;
      setShowVietMixEditor(false);
      setEditingVietMixArticleId(null);
      if (selectedMode === "vietmix" && batchIndex === 0) {
        setSelectedVietMixArticleId("");
      }

      // Reset accumulated data for fresh session (not for continue batch)
      if (batchIndex === 0) {
        pendingLearnUpdates.current = { reviews: [], queueWords: [] };
      }

      setMode(selectedMode);

      // Get all available words for review (no limit)
      const allWords = selectWordsForReview(filteredWords, dueWords, 1000);
      setAllAvailableWords(allWords);
      setCurrentBatchIndex(batchIndex);

      // Load only current batch (20 words)
      const startIdx = batchIndex * batchSize;
      const endIdx = startIdx + batchSize;
      const batchWords = allWords.slice(startIdx, endIdx);

      setQueue(batchWords);
      setIdx(0);
      setPhase(selectedMode === "vietmix" ? "reveal" : "think");
      setSessionStats({ correct: 0, incorrect: 0 });
      setSessionHistory([]); // Reset session history for new batch
      sessionReviewsRef.current = []; // Reset session reviews
      setTypedAnswer("");
      setIsCorrect(null);
      setUserSentence([]);
    };

    // Continue to next batch
    const continueNextBatch = () => {
      const nextBatchIndex = currentBatchIndex + 1;
      const startIdx = nextBatchIndex * batchSize;

      if (startIdx < allAvailableWords.length) {
        startSession(mode, nextBatchIndex);
      }
    };

    // Reset flashcard flip state when word changes
    useEffect(() => {
      setIsFlipped(false);
    }, [idx]);

    const generateSentence = (word) => {
      // Generate simple sentence templates
      const templates = [
        `The ${word.term} is very important`,
        `I need to ${word.term} this task`,
        `This is a good ${word.term}`,
        `We should ${word.term} carefully`,
        `The ${word.term} was successful`,
      ];

      // Use first example if available, otherwise use template
      let sentence = word.examples?.[0] || templates[Math.floor(Math.random() * templates.length)];

      // Split into words
      const words = sentence.replace(/[.,!?]/g, '').split(' ');

      // Shuffle words
      const shuffled = [...words].sort(() => Math.random() - 0.5);

      return { correct: words, shuffled };
    };

    const currentWord = queue[idx];
    const progress = queue.length > 0 ? (idx / queue.length) : 0;
    const currentPassageIndex = Math.floor(idx / 5);
    const currentPassageStart = currentPassageIndex * 5;
    const currentPassageWords = useMemo(
      () => queue.slice(currentPassageStart, currentPassageStart + 5),
      [queue, currentPassageStart]
    );
    const currentLessonIdForVietMix = selectedLesson || currentPassageWords[0]?.lesson || "";
    const activeVietMixArticleId = selectedVietMixArticleId || vietMixArticles[0]?.id || "";

    useEffect(() => {
      if (!selectedVietMixArticleId) return;
      const selectedStillExists = vietMixArticles.some((article) => article.id === selectedVietMixArticleId);
      if (!selectedStillExists) {
        setSelectedVietMixArticleId("");
      }
    }, [selectedVietMixArticleId, vietMixArticles]);

    const vietMixPassage = useMemo(() => {
      if (mode !== "vietmix" || currentPassageWords.length === 0) return null;

      const wordMap = new Map(words.map((word) => [normalizeTerm(word.term), word]));
      const selectedManual = selectedVietMixArticleId
        ? vietMixArticles.find((article) => article.id === selectedVietMixArticleId)
        : null;
      const manualArticle = selectedManual || vietMixArticles[0] || null;

      if (manualArticle) {
        const requestedWords = (manualArticle.focusTerms || [])
          .map((term) => wordMap.get(normalizeTerm(term)))
          .filter(Boolean);

        const focusWords = [];
        const seen = new Set();
        [...requestedWords, ...currentPassageWords].forEach((word) => {
          if (!word || seen.has(word.id) || focusWords.length >= 5) return;
          seen.add(word.id);
          focusWords.push(word);
        });

        const lines = `${manualArticle.content || ""}`
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);

        return {
          title: manualArticle.title || currentPassageWords[0]?.lessonTitle || "VietMix Reading",
          lines: lines.length > 0 ? lines : ["No content yet."],
          focusWords: focusWords.length > 0 ? focusWords : currentPassageWords,
          source: "manual",
        };
      }

      return null;
    }, [
      mode,
      currentPassageWords,
      currentPassageIndex,
      currentLessonIdForVietMix,
      words,
      selectedVietMixArticleId,
      vietMixArticles,
    ]);
    const currentVietMixFocusWord = useMemo(() => {
      if (mode !== "vietmix") return null;
      const focusWords = vietMixPassage?.focusWords || [];
      if (focusWords.length === 0) return null;
      return focusWords[idx % focusWords.length] || focusWords[0];
    }, [mode, vietMixPassage, idx]);
    const activeSessionWord = mode === "vietmix" ? (currentVietMixFocusWord || currentWord) : currentWord;

    // Reset hints and flashcard flip when word changes
    useEffect(() => {
      setHintsUsed(0);
      setCurrentHintLevel(0);
      setShownHints([]);
      setSelectedMCOption(null);
      setMcChoices([]);
      setIsFlipped(false); // Reset flip state
    }, [idx]);

    const handleRate = (rating) => {
      if (!activeSessionWord) return;

      // For Type mode with hints, adjust quality based on hints used
      let adjustedRating = rating;
      let adjustedQuality;

      if (mode === "type" && hintsUsed > 0 && isCorrect) {
        // Override quality based on hints for correct answers
        adjustedQuality = getQualityFromHints(isCorrect, hintsUsed);
        // Map quality back to rating for consistency
        if (adjustedQuality === 5) adjustedRating = "easy";
        else if (adjustedQuality === 4) adjustedRating = "good";
        else if (adjustedQuality === 3) adjustedRating = "hard";
        else adjustedRating = "again";
      }

      // Save to Firestore only (no parent state updates to prevent re-render)
      const { updated, quality: originalQuality } = updateWordSRSInSession(activeSessionWord, adjustedRating);
      const finalQuality = adjustedQuality || originalQuality;

      // Track review for batch stats update at end (with hint-adjusted quality for Type mode)
      sessionReviewsRef.current.push({
        quality: finalQuality,
        rating: adjustedRating,
        hintsUsed: mode === "type" ? hintsUsed : 0,
      });

      // Update the word in queue for immediate UI feedback
      setQueue(prev => prev.map(w => w.id === activeSessionWord.id ? updated : w));

      // Update session stats (local state, safe)
      const isGood = adjustedRating === "good" || adjustedRating === "easy";
      setSessionStats(p => ({
        correct: p.correct + (isGood ? 1 : 0),
        incorrect: p.incorrect + (isGood ? 0 : 1),
      }));

      // Track word in session history for review display
      setSessionHistory(prev => [...prev, {
        word: activeSessionWord,
        rating: adjustedRating,
        isGood,
        hintsUsed: mode === "type" ? hintsUsed : 0,
      }]);

      if (idx + 1 >= queue.length) {
        // End of batch - accumulate in ref (DON'T call batchUpdateStats to avoid parent re-render)
        pendingLearnUpdates.current.reviews.push(...sessionReviewsRef.current);
        pendingLearnUpdates.current.queueWords.push(...queue.map(w => {
          // Include current word's updated SRS from this batch
          const qw = w.id === activeSessionWord.id ? updated : w;
          return qw;
        }));
        sessionReviewsRef.current = [];

        // Save to Firestore async (non-blocking, no parent state change)
        if (firestoreService && userId) {
          const wordsToSave = queue.map(w => w.id === activeSessionWord.id ? updated : w);
          setTimeout(async () => {
            try {
              await firestoreService.saveWords(wordsToSave);
              console.log(`✅ Learn batch saved: ${wordsToSave.length} words`);
            } catch (error) {
              console.error('❌ Learn batch save error:', error);
            }
          }, 100);
        }

        setPhase("done");
      } else {
        // Move to next word
        setIdx(i => i + 1);
        setPhase(mode === "vietmix" ? "reveal" : "think");
        setTypedAnswer("");
        setIsCorrect(null);
      }
    };

    const checkTyped = () => {
      if (!currentWord) return;
      const correct = typedAnswer.trim().toLowerCase() === currentWord.term.toLowerCase();
      setIsCorrect(correct);
      setPhase("reveal");
    };

    // Progressive Hints functions
    const generateMCChoices = (correctWord) => {
      // Generate 3 distractors based on similar words from the queue
      const otherWords = queue
        .filter(w => w.id !== correctWord.id && w.term !== correctWord.term)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(w => w.term);

      // If not enough words in queue, add generic distractors
      const genericDistractors = ["expand", "continue", "reduce", "increase", "decrease", "maintain"];
      while (otherWords.length < 3) {
        const distractor = genericDistractors[Math.floor(Math.random() * genericDistractors.length)];
        if (!otherWords.includes(distractor) && distractor !== correctWord.term) {
          otherWords.push(distractor);
        }
      }

      // Shuffle choices with correct answer
      const choices = [correctWord.term, ...otherWords.slice(0, 3)].sort(() => Math.random() - 0.5);
      return choices;
    };

    const showNextHint = () => {
      if (!currentWord) return;
      const nextLevel = currentHintLevel + 1;

      if (nextLevel === 1) {
        // Hint 1: Pronunciation
        setShownHints(prev => [...prev, {
          level: 1,
          type: "pronunciation",
          content: currentWord.phonetic || `/${currentWord.term}/`,
        }]);
        setCurrentHintLevel(1);
        setHintsUsed(1);
      } else if (nextLevel === 2) {
        // Hint 2: Full example (already shown, just mark it)
        setShownHints(prev => [...prev, {
          level: 2,
          type: "example",
          content: currentWord.examples?.[0] || "Example not available",
        }]);
        setCurrentHintLevel(2);
        setHintsUsed(2);
      } else if (nextLevel === 3) {
        // Hint 3: First letter
        setShownHints(prev => [...prev, {
          level: 3,
          type: "firstLetter",
          content: `Starts with "${currentWord.term[0].toUpperCase()}..." (${currentWord.term.length} letters)`,
        }]);
        setCurrentHintLevel(3);
        setHintsUsed(3);
        // Pre-fill first letter
        setTypedAnswer(currentWord.term[0]);
      } else if (nextLevel === 4) {
        // Hint 4: Multiple choice
        const choices = generateMCChoices(currentWord);
        setMcChoices(choices);
        setShownHints(prev => [...prev, {
          level: 4,
          type: "multipleChoice",
          content: "Choose the correct word",
        }]);
        setCurrentHintLevel(4);
        setHintsUsed(4);
      }
    };

    const selectMCOption = (option) => {
      setSelectedMCOption(option);
      setTypedAnswer(option);
      // Auto-focus input to confirm
      setTimeout(() => inputRef.current?.focus(), 100);
    };

    // Calculate quality based on hints used
    const getQualityFromHints = (isCorrect, hintsUsed) => {
      if (!isCorrect) return 1; // Wrong answer = quality 1
      if (hintsUsed === 0) return 5; // Perfect
      if (hintsUsed === 1) return 4; // Good
      if (hintsUsed === 2) return 3; // Hard
      return 2; // 3+ hints = Again with partial credit
    };

    // Calculate XP based on hints used
    const getXPFromHints = (isCorrect, hintsUsed) => {
      if (!isCorrect) return 5; // Wrong answer = minimal XP
      if (hintsUsed === 0) return 15; // Perfect
      if (hintsUsed === 1) return 10; // Excellent
      if (hintsUsed === 2) return 5;  // Good
      if (hintsUsed === 3) return 0;  // Fair
      return -5; // 4 hints = needs practice
    };

    // Exit session handler - apply all deferred updates NOW
    const exitSession = () => {
      // Combine any remaining current-batch reviews with accumulated ones
      const allReviews = [...pendingLearnUpdates.current.reviews, ...sessionReviewsRef.current];
      const allQueueWords = [...pendingLearnUpdates.current.queueWords];

      // Also include current queue if not already saved (e.g. user exits mid-batch)
      if (sessionReviewsRef.current.length > 0) {
        allQueueWords.push(...queue);
      }

      // Apply stats update (parent state - OK because we're leaving the session)
      if (allReviews.length > 0) {
        updateStreak();
        setStats(prev => {
          const totalXP = allReviews.reduce((sum, review) => {
            const { quality, hintsUsed: reviewHintsUsed = 0 } = review;
            if (reviewHintsUsed > 0) {
              const isCorrect = quality >= 3;
              return sum + getXPFromHints(isCorrect, reviewHintsUsed);
            }
            return sum + (quality >= 4 ? 15 : quality >= 3 ? 10 : 5);
          }, 0);

          const newTodayReviews = (prev.todayDate === new Date().toDateString() ? prev.todayReviews : 0) + allReviews.length;
          const dailyGoal = prev.dailyGoal || 20;

          if (newTodayReviews >= dailyGoal && (prev.todayReviews < dailyGoal)) {
            setTimeout(() => showToast(`🎉 Daily goal reached! ${dailyGoal} reviews completed!`, "success"), 300);
          }

          return {
            ...prev,
            totalReviews: prev.totalReviews + allReviews.length,
            todayReviews: newTodayReviews,
            todayDate: new Date().toDateString(),
            xp: prev.xp + totalXP,
          };
        });
      }

      // Sync all updated queue words to parent words state
      if (allQueueWords.length > 0) {
        setWords(prev => prev.map(w => {
          const queueWord = allQueueWords.find(q => q.id === w.id);
          return queueWord || w;
        }));
      }

      // Reset pending data
      pendingLearnUpdates.current = { reviews: [], queueWords: [] };

      // Resume Firestore updates after exiting
      isInLearningSession.current = false;

      setMode(null);
    };

    // Empty state - no words available
    if (words.length === 0) {
      return (
        <div style={{ padding: "40px 16px 100px", maxWidth: 480, margin: "0 auto", textAlign: "center", animation: "vmFadeIn 0.4s ease" }}>
          <button className="vm-btn" onClick={() => setScreen("home")} style={{ position: "absolute", top: 20, left: 16, background: "none", color: THEME.textSecondary, fontSize: 22, padding: 4 }}>←</button>
          <div style={{ fontSize: 64, marginBottom: 24 }}>📚</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>No Vocabulary Yet</div>
          <div style={{ fontSize: 15, color: THEME.textSecondary, marginBottom: 32, lineHeight: 1.6 }}>
            You haven't added any words yet.<br/>
            Go to <strong style={{ color: THEME.accent }}>Words</strong> tab to import or add vocabulary.
          </div>
          <button className="vm-btn" onClick={() => setScreen("words")} style={{
            padding: "14px 32px", borderRadius: 14, background: THEME.gradient1, color: "#fff", fontSize: 15
          }}>
            ➕ Add Words
          </button>
        </div>
      );
    }

    // Mode Select
    if (!mode) {
      const availableWords = selectWordsForReview(filteredWords || [], dueWords || [], 1000);
      const totalAvailable = availableWords?.length || 0;
      const totalBatches = batchSize > 0 ? Math.ceil(totalAvailable / batchSize) : 0;

      return (
        <div style={{ padding: "20px 16px 100px", maxWidth: 480, margin: "0 auto", animation: "vmFadeIn 0.4s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <button className="vm-btn" onClick={() => setScreen("home")} style={{ background: "none", color: THEME.textSecondary, fontSize: 22, padding: 4 }}>←</button>
            <div style={{ fontSize: 22, fontWeight: 800 }}>Choose Learning Mode</div>
          </div>

          {/* Lesson Selector */}
          <div className="vm-card" style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: THEME.textMuted, marginBottom: 10 }}>📚 SELECT LESSON</div>
            <select
              className="vm-btn"
              value={selectedLesson || ""}
              onChange={(e) => setSelectedLesson(e.target.value || null)}
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 12,
                background: THEME.card,
                border: `1px solid ${THEME.border}`,
                color: THEME.text,
                cursor: "pointer",
              }}
            >
              <option value="">All Lessons ({words.length} words)</option>
              {TOEIC_LESSONS.map(lesson => {
                const lessonWordCount = words.filter(w => w.lesson === lesson.id).length;
                return (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.title} ({lessonWordCount} words)
                  </option>
                );
              })}
            </select>
            {selectedLesson && (
              <div style={{ marginTop: 8, fontSize: 12, color: THEME.textSecondary }}>
                {TOEIC_LESSONS.find(l => l.id === selectedLesson)?.description}
              </div>
            )}
            {recommendedLesson && (
              <div style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 10,
                background: `${THEME.warning}12`,
                border: `1px solid ${THEME.warning}30`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}>
                <div style={{ fontSize: 11, color: THEME.textSecondary }}>
                  Suggested now: <strong style={{ color: THEME.text }}>{recommendedLesson.title}</strong>
                </div>
                <button
                  className="vm-btn"
                  onClick={() => setSelectedLesson(recommendedLesson.id)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    background: `${THEME.warning}20`,
                    color: THEME.warning,
                    border: `1px solid ${THEME.warning}40`,
                    flexShrink: 0,
                  }}
                >
                  Use
                </button>
              </div>
            )}
          </div>

          {/* Word count info */}
          <div className="vm-card" style={{ padding: 16, marginBottom: 24, background: `${THEME.accent}08` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 36 }}>📚</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: THEME.accent }}>{totalAvailable}</div>
                <div style={{ fontSize: 13, color: THEME.textSecondary }}>
                  {totalAvailable === 0 ? "No words to review" :
                   totalAvailable <= batchSize ? "words ready to learn" :
                   `words ready (${totalBatches} batches of ${batchSize})`}
                </div>
              </div>
            </div>
          </div>

          {totalAvailable === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>All caught up!</div>
              <div style={{ fontSize: 14, color: THEME.textSecondary }}>No words due for review right now.</div>
            </div>
          ) : (
            <>
              {[
                { id: "flashcard", icon: "📇", name: "Learn Flashcard", desc: "Passive learning → Read word + meaning → Build recognition", rec: true, color: THEME.info, new: true },
                { id: "type", icon: "⌨️", name: "Type Answer", desc: "Active recall → Type the word from definition", color: THEME.success },
                { id: "recall", icon: "🧠", name: "Active Recall", desc: "See word → Think → Reveal → Rate", color: THEME.accent },
                { id: "sentence", icon: "📝", name: "Sentence Builder", desc: "Build sentences using vocabulary words", color: THEME.warning },
                { id: "listen", icon: "👂", name: "Listening", desc: "Hear pronunciation → Recall meaning → Rate", color: THEME.info },
                { id: "vietmix", icon: "📰", name: "VietMix Reading", desc: "Doc tieng Viet chen tu tieng Anh (kem nghia)", color: THEME.accentLight, new: true },
              ].map(m => (
          <button key={m.id} className="vm-btn vm-card" onClick={() => startSession(m.id)} style={{
            width: "100%", padding: 20, marginBottom: 12, textAlign: "left",
            display: "flex", alignItems: "center", gap: 16,
            border: m.rec ? `2px solid ${m.color}40` : undefined,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, background: `${m.color}15`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0,
            }}>{m.icon}</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: THEME.text }}>{m.name}</span>
                {m.rec && <span className="vm-tag" style={{ background: `${THEME.accent}20`, color: THEME.accent, fontSize: 10 }}>Recommended</span>}
                {m.new && <span className="vm-tag" style={{ background: `${THEME.success}20`, color: THEME.success, fontSize: 10 }}>✨ New</span>}
              </div>
              <div style={{ fontSize: 13, color: THEME.textSecondary, marginTop: 4 }}>{m.desc}</div>
            </div>
          </button>
        ))}
        
        <div className="vm-card" style={{ padding: 16, marginTop: 16, background: `${THEME.accent}08` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: THEME.accent, marginBottom: 6 }}>💡 Why Active Recall?</div>
          <div style={{ fontSize: 13, color: THEME.textSecondary, lineHeight: 1.6 }}>
            Actively trying to remember <strong style={{ color: THEME.text }}>before</strong> seeing the answer
            increases retention by <strong style={{ color: THEME.success }}>3x</strong> compared to passive reading.
            Combined with Spaced Repetition (SM-2), this is the most scientifically proven method for long-term memory.
          </div>
        </div>
              </>
            )}
          </div>
        );
    }

    // Session Complete
    if (phase === "done") {
      const total = sessionStats.correct + sessionStats.incorrect;
      const accuracy = total > 0 ? Math.round((sessionStats.correct / total) * 100) : 0;

      // Check if there are more batches
      const totalBatches = Math.ceil(allAvailableWords.length / batchSize);
      const currentBatchNum = currentBatchIndex + 1;
      const hasMoreBatches = (currentBatchIndex + 1) * batchSize < allAvailableWords.length;

      return (
        <div style={{ padding: "40px 16px 100px", maxWidth: 480, margin: "0 auto", textAlign: "center", animation: "vmBounceIn 0.5s ease" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>{accuracy >= 80 ? "🎉" : accuracy >= 50 ? "👍" : "💪"}</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Batch Complete!</div>
          <div style={{ fontSize: 15, color: THEME.textSecondary, marginBottom: 8 }}>
            {accuracy >= 80 ? "Excellent work!" : accuracy >= 50 ? "Good progress!" : "Keep practicing!"}
          </div>

          {/* Batch progress */}
          {allAvailableWords.length > batchSize && (
            <div style={{ fontSize: 13, color: THEME.textSecondary, marginBottom: 24 }}>
              Batch {currentBatchNum} of {totalBatches} completed
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
            <div className="vm-card" style={{ padding: 16 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: THEME.accent }}>{total}</div>
              <div style={{ fontSize: 11, color: THEME.textMuted }}>Words</div>
            </div>
            <div className="vm-card" style={{ padding: 16 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: THEME.success }}>{accuracy}%</div>
              <div style={{ fontSize: 11, color: THEME.textMuted }}>Accuracy</div>
            </div>
            <div className="vm-card" style={{ padding: 16 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: THEME.warning }}>+{total * 10}</div>
              <div style={{ fontSize: 11, color: THEME.textMuted }}>XP</div>
            </div>
          </div>

          {/* Reviewed Words List */}
          {sessionHistory.length > 0 && (
            <div className="vm-card" style={{ padding: 16, marginBottom: 24, textAlign: "left", maxHeight: 300, overflowY: "auto" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, textAlign: "center", color: THEME.text }}>
                📝 Words Reviewed
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sessionHistory.map((item, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "8px 12px",
                    background: item.isGood ? `${THEME.success}08` : `${THEME.warning}08`,
                    borderRadius: 8, border: `1px solid ${item.isGood ? `${THEME.success}20` : `${THEME.warning}20`}`,
                  }}>
                    <div style={{ fontSize: 18 }}>{item.isGood ? "✓" : "✗"}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: THEME.text }}>{item.word.term}</div>
                      <div style={{ fontSize: 12, color: THEME.textSecondary }}>{item.word.definition}</div>
                    </div>
                    <div style={{
                      fontSize: 10, fontWeight: 700, padding: "4px 8px", borderRadius: 6,
                      background: item.rating === "easy" ? `${THEME.success}20` :
                                 item.rating === "good" ? `${THEME.info}20` :
                                 item.rating === "hard" ? `${THEME.warning}20` :
                                 `${THEME.danger}20`,
                      color: item.rating === "easy" ? THEME.success :
                            item.rating === "good" ? THEME.info :
                            item.rating === "hard" ? THEME.warning :
                            THEME.danger,
                    }}>
                      {item.rating.toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            {hasMoreBatches ? (
              <>
                <button className="vm-btn" onClick={continueNextBatch} style={{
                  flex: 1, padding: 16, borderRadius: 14, background: THEME.gradient1, color: "#fff", fontSize: 15,
                }}>
                  Continue Next Batch →
                </button>
                <button className="vm-btn" onClick={exitSession} style={{
                  flex: 1, padding: 16, borderRadius: 14, background: THEME.card, color: THEME.text, fontSize: 15, border: `1px solid ${THEME.border}`,
                }}>
                  Finish
                </button>
              </>
            ) : (
              <button className="vm-btn" onClick={exitSession} style={{
                width: "100%", padding: 16, borderRadius: 14, background: THEME.gradient1, color: "#fff", fontSize: 15,
              }}>
                Finish
              </button>
            )}
          </div>
        </div>
      );
    }

    if (!currentWord) return null;

    // Learn Flashcard Mode (Passive Learning)
    if (mode === "flashcard") {
      // Text-to-Speech function
      const speakWord = () => {
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(currentWord.term);
          utterance.lang = 'en-US';
          utterance.rate = 0.9; // Slightly slower for clarity
          window.speechSynthesis.cancel(); // Cancel any ongoing speech
          window.speechSynthesis.speak(utterance);
        } else {
          showToast("Text-to-speech not supported in this browser", "danger");
        }
      };

      return (
        <div style={{ padding: "20px 16px 100px", maxWidth: 480, margin: "0 auto", animation: "vmFadeIn 0.3s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <button className="vm-btn" onClick={exitSession} style={{ background: "none", color: THEME.textSecondary, fontSize: 22, padding: 4 }}>←</button>
            <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textSecondary }}>{idx + 1} / {queue.length}</div>
            <div className="vm-mono" style={{ fontSize: 12, color: THEME.info }}>📇 Learn Flashcard</div>
          </div>

          <div style={{ height: 4, borderRadius: 2, background: THEME.border, marginBottom: 24, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${((idx + (isFlipped ? 1 : 0.5)) / queue.length) * 100}%`, background: THEME.gradient3, transition: "width 0.4s ease", borderRadius: 2 }} />
          </div>

          {/* Flashcard with Flip Animation */}
          <div
            className="vm-card"
            onClick={() => setIsFlipped(!isFlipped)}
            style={{
              padding: 24,
              marginBottom: 20,
              minHeight: 320,
              cursor: "pointer",
              position: "relative",
              transition: "transform 0.3s ease",
              transform: isFlipped ? "rotateY(0deg)" : "rotateY(0deg)"
            }}
          >
            {/* FRONT SIDE - Term only */}
            {!isFlipped && (
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 280,
                textAlign: "center",
                animation: "vmFadeIn 0.3s ease"
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
                  ENGLISH WORD
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 48, fontWeight: 900, color: THEME.accent, lineHeight: 1.2 }}>
                    {currentWord.term}
                  </div>
                  <button
                    className="vm-btn"
                    onClick={(e) => { e.stopPropagation(); speakWord(); }}
                    style={{
                      background: `${THEME.info}15`,
                      color: THEME.info,
                      fontSize: 24,
                      padding: "8px 12px",
                      borderRadius: 12,
                      border: `2px solid ${THEME.info}30`,
                      cursor: "pointer"
                    }}
                    title="Listen to pronunciation"
                  >
                    🔊
                  </button>
                </div>
                {currentWord.phonetic && (
                  <div style={{ fontSize: 18, color: THEME.textSecondary, fontStyle: "italic", marginBottom: 16 }}>
                    {currentWord.phonetic}
                  </div>
                )}
                {currentWord.partOfSpeech && (
                  <div className="vm-tag" style={{
                    background: `${THEME.info}15`,
                    color: THEME.info,
                    fontSize: 13,
                    padding: "6px 16px"
                  }}>
                    {currentWord.partOfSpeech}
                  </div>
                )}
                <div style={{
                  marginTop: 40,
                  padding: "12px 24px",
                  borderRadius: 12,
                  background: `${THEME.info}08`,
                  fontSize: 13,
                  color: THEME.textSecondary
                }}>
                  👆 Tap to see meaning
                </div>
              </div>
            )}

            {/* BACK SIDE - Definition + Examples + Synonyms */}
            {isFlipped && (
              <div style={{ animation: "vmFadeIn 0.3s ease" }}>
                {/* Term (smaller) */}
                <div style={{ marginBottom: 20, textAlign: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 4 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: THEME.accent }}>
                      {currentWord.term}
                    </div>
                    <button
                      className="vm-btn"
                      onClick={(e) => { e.stopPropagation(); speakWord(); }}
                      style={{
                        background: `${THEME.info}15`,
                        color: THEME.info,
                        fontSize: 18,
                        padding: "6px 10px",
                        borderRadius: 10,
                        border: `2px solid ${THEME.info}30`,
                        cursor: "pointer"
                      }}
                      title="Listen to pronunciation"
                    >
                      🔊
                    </button>
                  </div>
                  {currentWord.phonetic && (
                    <div style={{ fontSize: 14, color: THEME.textSecondary, fontStyle: "italic" }}>
                      {currentWord.phonetic}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div style={{
                  height: 1,
                  background: `linear-gradient(90deg, transparent, ${THEME.border}, transparent)`,
                  margin: "16px 0"
                }} />

                {/* Definition */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                    MEANING
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.6 }}>
                    {currentWord.definition}
                  </div>
                </div>

                {/* Examples */}
                {currentWord.examples && currentWord.examples.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textMuted, marginBottom: 8 }}>
                      💡 EXAMPLES
                    </div>
                    {currentWord.examples.slice(0, 2).map((ex, i) => (
                      <div key={i} style={{
                        padding: 10,
                        borderRadius: 8,
                        background: THEME.surface,
                        borderLeft: `3px solid ${THEME.success}40`,
                        fontSize: 13,
                        color: THEME.textSecondary,
                        fontStyle: "italic",
                        marginBottom: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 8
                      }}>
                        <div style={{ flex: 1 }}>"{ex}"</div>
                        <button
                          className="vm-btn"
                          onClick={(e) => { e.stopPropagation(); speak(ex); }}
                          style={{
                            background: "none",
                            color: THEME.accent,
                            fontSize: 18,
                            padding: 4,
                            flexShrink: 0
                          }}
                          title="Listen to example"
                        >
                          🔊
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Synonyms */}
                {currentWord.synonyms && currentWord.synonyms.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textMuted, marginBottom: 8 }}>
                      📚 SYNONYMS
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {currentWord.synonyms.map((syn, i) => (
                        <span key={i} className="vm-tag" style={{
                          background: `${THEME.accent}10`,
                          color: THEME.accent,
                          fontSize: 12
                        }}>
                          {syn}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{
                  marginTop: 16,
                  padding: "10px",
                  borderRadius: 10,
                  background: `${THEME.info}08`,
                  fontSize: 12,
                  color: THEME.textSecondary,
                  textAlign: "center"
                }}>
                  👆 Tap again to flip back
                </div>
              </div>
            )}
          </div>

          {/* Recognition Assessment - Only show after flipping */}
          {phase === "think" && isFlipped && (
            <div style={{ animation: "vmFadeIn 0.3s ease" }}>
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                color: THEME.textSecondary,
                marginBottom: 12,
                textAlign: "center"
              }}>
                How well do you recognize this word?
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <button
                  className="vm-btn"
                  onClick={(e) => { e.stopPropagation(); handleRate("again"); setIsFlipped(false); }}
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    background: `${THEME.danger}15`,
                    color: THEME.danger,
                    fontSize: 15,
                    border: `1.5px solid ${THEME.danger}30`,
                  }}
                >
                  ❌ New to me
                </button>
                <button
                  className="vm-btn"
                  onClick={(e) => { e.stopPropagation(); handleRate("hard"); setIsFlipped(false); }}
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    background: `${THEME.warning}15`,
                    color: THEME.warning,
                    fontSize: 15,
                    border: `1.5px solid ${THEME.warning}30`,
                  }}
                >
                  ⚠️ Seen before
                </button>
                <button
                  className="vm-btn"
                  onClick={(e) => { e.stopPropagation(); handleRate("good"); setIsFlipped(false); }}
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    background: `${THEME.success}15`,
                    color: THEME.success,
                    fontSize: 15,
                    border: `1.5px solid ${THEME.success}30`,
                  }}
                >
                  ✅ Familiar
                </button>
                <button
                  className="vm-btn"
                  onClick={(e) => { e.stopPropagation(); handleRate("easy"); setIsFlipped(false); }}
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    background: `${THEME.accent}15`,
                    color: THEME.accent,
                    fontSize: 15,
                    border: `1.5px solid ${THEME.accent}30`,
                  }}
                >
                  🎯 Know well
                </button>
              </div>

              <div className="vm-card" style={{
                padding: 12,
                marginTop: 16,
                background: `${THEME.info}08`,
                textAlign: "center"
              }}>
                <div style={{ fontSize: 12, color: THEME.textSecondary }}>
                  💡 <strong>Tip:</strong> Read carefully, then rate honestly. This helps the system schedule reviews optimally.
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Vietnamese Reading + English Terms Mode
    if (mode === "vietmix") return (
      <div style={{ padding: "20px 16px 100px", maxWidth: 520, margin: "0 auto", animation: "vmFadeIn 0.3s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <button className="vm-btn" onClick={exitSession} style={{ background: "none", color: THEME.textSecondary, fontSize: 22, padding: 4 }}>←</button>
          <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textSecondary }}>{idx + 1} / {queue.length}</div>
          <div className="vm-mono" style={{ fontSize: 12, color: THEME.accent }}>VietMix Reading</div>
        </div>

        <div style={{ height: 4, borderRadius: 2, background: THEME.border, marginBottom: 24, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${((idx + (phase === "reveal" ? 1 : 0.5)) / queue.length) * 100}%`, background: THEME.gradient1, transition: "width 0.4s ease", borderRadius: 2 }} />
        </div>

        <div className="vm-card" style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textSecondary }}>
              Article Library ({vietMixArticles.length})
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="vm-btn"
                onClick={handleDeleteAllVietMixArticles}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  background: `${THEME.danger}12`,
                  color: THEME.danger,
                  border: `1px solid ${THEME.danger}35`,
                }}
              >
                Delete All
              </button>
              <button
                className="vm-btn"
                onClick={() => {
                  if (showVietMixEditor && !editingVietMixArticleId) {
                    resetVietMixEditor();
                    return;
                  }
                  setEditingVietMixArticleId(null);
                  setVietMixDraft({
                    title: "",
                    lessonId: selectedLesson || currentLessonIdForVietMix || "",
                    content: "",
                    focusTerms: "",
                  });
                  setShowVietMixEditor(true);
                }}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  background: `${THEME.accent}18`,
                  color: THEME.accent,
                  border: `1px solid ${THEME.accent}35`,
                }}
              >
                Add Article
              </button>
            </div>
          </div>

          {showVietMixEditor && (
            <div className="vm-card" style={{ padding: 12, marginBottom: 10, background: `${THEME.accent}08` }}>
              <input
                className="vm-input"
                value={vietMixDraft.title}
                onChange={(e) => setVietMixDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Article title"
                style={{ marginBottom: 8 }}
              />
              <select
                className="vm-btn"
                value={vietMixDraft.lessonId}
                onChange={(e) => setVietMixDraft((prev) => ({ ...prev, lessonId: e.target.value }))}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 10,
                  background: THEME.card,
                  border: `1px solid ${THEME.border}`,
                  color: THEME.text,
                  cursor: "pointer",
                  marginBottom: 8,
                }}
              >
                <option value="">All lessons</option>
                {TOEIC_LESSONS.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>{lesson.title}</option>
                ))}
              </select>
              <textarea
                className="vm-input"
                value={vietMixDraft.content}
                onChange={(e) => setVietMixDraft((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="Write your Vietnamese passage with English words..."
                style={{ minHeight: 110, resize: "vertical", lineHeight: 1.6, marginBottom: 8 }}
              />
              <input
                className="vm-input"
                value={vietMixDraft.focusTerms}
                onChange={(e) => setVietMixDraft((prev) => ({ ...prev, focusTerms: e.target.value }))}
                placeholder="focus words: deadline, agenda, memorandum"
                style={{ marginBottom: 8 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="vm-btn"
                  onClick={handleSaveVietMixArticle}
                  disabled={isSavingVietMixArticle}
                  style={{
                    flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    background: THEME.gradient1, color: "#fff",
                    opacity: isSavingVietMixArticle ? 0.75 : 1,
                  }}
                >
                  {isSavingVietMixArticle ? "Saving..." : editingVietMixArticleId ? "Update" : "Save"}
                </button>
                <button
                  className="vm-btn"
                  onClick={resetVietMixEditor}
                  style={{
                    padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    background: THEME.surface, color: THEME.textSecondary, border: `1px solid ${THEME.border}`,
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
            {!vietMixArticlesReady && (
              <div style={{ fontSize: 11, color: THEME.textMuted }}>
                Loading articles...
              </div>
            )}

            {vietMixArticlesReady && (
              <>
                {vietMixArticles.map((article) => {
                  const lessonLabel = article.lessonId
                    ? TOEIC_LESSONS.find((lesson) => lesson.id === article.lessonId)?.title || article.lessonId
                    : "All lessons";

                  return (
                    <div key={article.id} style={{ display: "flex", gap: 6 }}>
                      <button
                        className="vm-btn"
                        onClick={() => {
                          setSelectedVietMixArticleId(article.id);
                          setPhase("reveal");
                        }}
                        style={{
                          flex: 1,
                          textAlign: "left",
                          padding: "8px 10px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          background: activeVietMixArticleId === article.id ? `${THEME.accent}18` : THEME.surface,
                          color: activeVietMixArticleId === article.id ? THEME.accent : THEME.textSecondary,
                          border: `1px solid ${activeVietMixArticleId === article.id ? `${THEME.accent}40` : THEME.border}`,
                          overflow: "hidden",
                        }}
                      >
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {article.title}
                        </div>
                        <div style={{ fontSize: 10, opacity: 0.72, marginTop: 2 }}>
                          {lessonLabel}
                        </div>
                      </button>
                      <button
                        className="vm-btn"
                        onClick={() => handleEditVietMixArticle(article)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          fontSize: 11,
                          fontWeight: 700,
                          background: `${THEME.info}12`,
                          color: THEME.info,
                          border: `1px solid ${THEME.info}35`,
                          flexShrink: 0,
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="vm-btn"
                        onClick={() => handleDeleteVietMixArticle(article.id)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          fontSize: 11,
                          fontWeight: 700,
                          background: `${THEME.danger}12`,
                          color: THEME.danger,
                          border: `1px solid ${THEME.danger}35`,
                          flexShrink: 0,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  );
                })}

                {vietMixArticles.length === 0 && (
                  <div style={{ fontSize: 11, color: THEME.textMuted }}>
                    No articles yet. Add your first article to start.
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="vm-card" style={{ padding: 12, marginBottom: 12, background: `${THEME.info}08` }}>
          <div style={{ fontSize: 12, color: THEME.textSecondary, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span>
              Focus word {(idx % Math.max(1, (vietMixPassage?.focusWords?.length || 1))) + 1}/{Math.min(5, vietMixPassage?.focusWords?.length || 0)}
            </span>
            <strong style={{ color: THEME.text }}>{activeSessionWord?.term || "-"}</strong>
          </div>
          <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 4 }}>
            Source: {vietMixPassage?.source === "manual" ? `Manual - ${vietMixPassage?.title}` : "No article selected"}
          </div>
        </div>

        <div className="vm-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            TOEIC Reading (Lesson Theme)
          </div>
          <div style={{ fontSize: 14, color: THEME.textSecondary, marginBottom: 14 }}>
            {vietMixPassage?.title || "Add an article to start reading"}
          </div>

          <div style={{ fontSize: 16, lineHeight: 1.8, color: THEME.text }}>
            {(vietMixPassage?.lines || ["Use Add Article to create your first VietMix passage."]).map((line, lineIndex) => (
              <div key={lineIndex} style={{ marginBottom: 8 }}>
                {line}
              </div>
            ))}
          </div>
        </div>

        <div className="vm-card" style={{ padding: 14, marginBottom: 20, background: `${THEME.accent}08` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: THEME.accent, marginBottom: 8 }}>
            Focus Words In This Passage
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(vietMixPassage?.focusWords || []).map((word, wordIndex) => (
              <span key={`${word.id}_${wordIndex}`} className="vm-tag" style={{ background: `${THEME.accent}15`, color: THEME.accent }}>
                {word.term}
              </span>
            ))}
          </div>
        </div>

        {!vietMixPassage && (
          <button
            className="vm-btn"
            onClick={() => setShowVietMixEditor(true)}
            style={{
              width: "100%", padding: 16, borderRadius: 14, background: THEME.gradient1,
              color: "#fff", fontSize: 15, fontWeight: 700,
            }}
          >
            Add Article First
          </button>
        )}

        {vietMixPassage && (
          <div style={{ animation: "vmSlideUp 0.3s ease" }}>
            <div style={{ marginBottom: 16 }}>
              <WordCard word={activeSessionWord || currentWord} showDef compact />
            </div>
            <RatingButtons onRate={handleRate} word={activeSessionWord || currentWord} />
          </div>
        )}
      </div>
    );

    // Active Recall Mode
    if (mode === "recall") return (
      <div style={{ padding: "20px 16px 100px", maxWidth: 480, margin: "0 auto", animation: "vmFadeIn 0.3s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <button className="vm-btn" onClick={exitSession} style={{ background: "none", color: THEME.textSecondary, fontSize: 22, padding: 4 }}>←</button>
          <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textSecondary }}>{idx + 1} / {queue.length}</div>
          <div className="vm-mono" style={{ fontSize: 12, color: THEME.accent }}>Active Recall</div>
        </div>
        
        <div style={{ height: 4, borderRadius: 2, background: THEME.border, marginBottom: 24, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${((idx + (phase === "reveal" ? 1 : 0.5)) / queue.length) * 100}%`, background: THEME.gradient1, transition: "width 0.4s ease", borderRadius: 2 }} />
        </div>
        
        <WordCard word={currentWord} showDef={phase === "reveal"} onFlip={phase === "think" ? () => setPhase("reveal") : undefined} />
        
        {phase === "think" && (
          <div style={{ marginTop: 20, animation: "vmFadeIn 0.3s ease" }}>
            {currentWord.examples?.[0] && (
              <div style={{ padding: 14, borderRadius: 12, background: `${THEME.warning}08`, border: `1px solid ${THEME.warning}15`, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: THEME.warning, marginBottom: 6 }}>💡 Context Hint</div>
                <div style={{ fontSize: 14, color: THEME.textSecondary, fontStyle: "italic" }}>
                  "{currentWord.examples[0].replace(new RegExp(currentWord.term, "gi"), "_____")}"
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 12 }}>
              <button className="vm-btn" onClick={() => setPhase("reveal")} style={{
                flex: 1, padding: 16, borderRadius: 14, background: `${THEME.danger}15`,
                color: THEME.danger, fontSize: 15, border: `1.5px solid ${THEME.danger}30`,
              }}>🤔 Don't Know</button>
              <button className="vm-btn" onClick={() => setPhase("reveal")} style={{
                flex: 1, padding: 16, borderRadius: 14, background: `${THEME.success}15`,
                color: THEME.success, fontSize: 15, border: `1.5px solid ${THEME.success}30`,
              }}>💡 I Think I Know</button>
            </div>
          </div>
        )}
        
        {phase === "reveal" && (
          <div style={{ marginTop: 20, animation: "vmSlideUp 0.3s ease" }}>
            <RatingButtons onRate={handleRate} word={currentWord} />
          </div>
        )}
      </div>
    );

    // Type Answer Mode
    if (mode === "type") return (
      <div style={{ padding: "20px 16px 100px", maxWidth: 480, margin: "0 auto", animation: "vmFadeIn 0.3s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <button className="vm-btn" onClick={exitSession} style={{ background: "none", color: THEME.textSecondary, fontSize: 22, padding: 4 }}>←</button>
          <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textSecondary }}>{idx + 1} / {queue.length}</div>
          <div className="vm-mono" style={{ fontSize: 12, color: THEME.success }}>Type Answer</div>
        </div>
        
        <div style={{ height: 4, borderRadius: 2, background: THEME.border, marginBottom: 24, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${((idx + (phase === "reveal" ? 1 : 0.5)) / queue.length) * 100}%`, background: THEME.gradient2, transition: "width 0.4s ease", borderRadius: 2 }} />
        </div>
        
        <div className="vm-card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Definition</div>
          <div style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.5, marginBottom: 16 }}>{currentWord.definition}</div>
          {currentWord.examples?.[0] && (
            <div style={{ padding: 12, borderRadius: 10, background: THEME.surface, borderLeft: `3px solid ${THEME.success}40`, fontSize: 14, color: THEME.textSecondary, fontStyle: "italic" }}>
              "{currentWord.examples[0].replace(new RegExp(currentWord.term, "gi"), "_____")}"
            </div>
          )}
        </div>
        
        {phase === "think" && (
          <div style={{ animation: "vmFadeIn 0.3s ease" }}>
            {/* Hint Cards */}
            {shownHints.map((hint, i) => {
              const hintColors = {
                1: { bg: `${THEME.info}10`, border: `${THEME.info}30`, text: THEME.info },
                2: { bg: `${THEME.warning}10`, border: `${THEME.warning}30`, text: THEME.warning },
                3: { bg: `${THEME.accent}10`, border: `${THEME.accent}30`, text: THEME.accent },
                4: { bg: `${THEME.danger}10`, border: `${THEME.danger}30`, text: THEME.danger },
              };
              const colors = hintColors[hint.level];

              return (
                <div key={i} className="vm-card" style={{
                  padding: 14,
                  marginBottom: 12,
                  background: colors.bg,
                  border: `1.5px solid ${colors.border}`,
                  animation: "vmSlideDown 0.3s ease",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: colors.text, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    {hint.level === 1 && "🔊"} {hint.level === 2 && "📖"} {hint.level === 3 && "✏️"} {hint.level === 4 && "🎯"}
                    <span>Hint {hint.level}/4</span>
                  </div>
                  {hint.type === "pronunciation" && (
                    <div style={{ fontSize: 16, fontWeight: 600, color: colors.text }}>{hint.content}</div>
                  )}
                  {hint.type === "example" && (
                    <div style={{ fontSize: 14, color: THEME.textSecondary, fontStyle: "italic" }}>"{hint.content}"</div>
                  )}
                  {hint.type === "firstLetter" && (
                    <div style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>{hint.content}</div>
                  )}
                  {hint.type === "multipleChoice" && (
                    <div style={{ marginTop: 8 }}>
                      {mcChoices.map((choice, idx) => (
                        <button
                          key={idx}
                          className="vm-btn"
                          onClick={() => selectMCOption(choice)}
                          style={{
                            width: "100%",
                            padding: 12,
                            marginBottom: 8,
                            borderRadius: 10,
                            background: selectedMCOption === choice ? `${THEME.success}20` : THEME.surface,
                            border: `1.5px solid ${selectedMCOption === choice ? THEME.success : THEME.border}`,
                            color: selectedMCOption === choice ? THEME.success : THEME.text,
                            fontWeight: selectedMCOption === choice ? 700 : 500,
                            fontSize: 15,
                            textAlign: "left",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span style={{ opacity: 0.5 }}>{String.fromCharCode(65 + idx)})</span>
                          <span>{choice}</span>
                          {selectedMCOption === choice && <span style={{ marginLeft: "auto" }}>✓</span>}
                        </button>
                      ))}
                      <div style={{ fontSize: 12, color: THEME.textMuted, marginTop: 8, fontStyle: "italic" }}>
                        ⚠️ Type the word below to confirm
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ position: "relative", marginBottom: 16 }}>
              <input ref={inputRef} className="vm-input" value={typedAnswer} onChange={e => setTypedAnswer(e.target.value)}
                onKeyDown={e => e.key === "Enter" && typedAnswer.trim() && checkTyped()}
                placeholder="Type the English word..." autoFocus
                style={{ fontSize: 18, padding: "16px 20px", textAlign: "center", fontWeight: 600 }}
              />
            </div>

            {/* Hint Button */}
            {currentHintLevel < 4 && (
              <div style={{ marginBottom: 16, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 8 }}>
                  💡 {currentHintLevel === 0 ? "Need a hint?" : "Still struggling?"} ({hintsUsed}/4 used)
                </div>
                <button className="vm-btn" onClick={showNextHint} style={{
                  padding: "12px 24px",
                  borderRadius: 12,
                  background: `${THEME.warning}15`,
                  color: THEME.warning,
                  fontSize: 14,
                  fontWeight: 600,
                  border: `1.5px solid ${THEME.warning}30`,
                }}>
                  {currentHintLevel === 0 ? "Show Hint" : currentHintLevel === 3 ? "Show Choices..." : "Next Hint"}
                </button>
              </div>
            )}

            <button className="vm-btn" onClick={checkTyped} disabled={!typedAnswer.trim()} style={{
              width: "100%", padding: 16, borderRadius: 14,
              background: typedAnswer.trim() ? THEME.gradient2 : THEME.border,
              color: typedAnswer.trim() ? "#fff" : THEME.textMuted,
              fontSize: 16, opacity: typedAnswer.trim() ? 1 : 0.5,
            }}>Check Answer</button>
          </div>
        )}
        
        {phase === "reveal" && (
          <div style={{ animation: "vmSlideUp 0.3s ease" }}>
            <div className="vm-card" style={{
              padding: 16, marginBottom: 16, textAlign: "center",
              background: isCorrect ? `${THEME.success}10` : `${THEME.danger}10`,
              border: `2px solid ${isCorrect ? THEME.success : THEME.danger}30`,
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{isCorrect ? "✅" : "❌"}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: isCorrect ? THEME.success : THEME.danger }}>
                {isCorrect ? "Correct!" : "Not quite..."}
              </div>
              {!isCorrect && (
                <div style={{ marginTop: 8 }}>
                  <span style={{ color: THEME.textMuted }}>Answer: </span>
                  <span style={{ fontWeight: 700, color: THEME.text, fontSize: 18 }}>{currentWord.term}</span>
                </div>
              )}

              {/* Show hint usage and score */}
              {isCorrect && hintsUsed > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${THEME.border}` }}>
                  <div style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 4 }}>
                    💡 Used {hintsUsed} hint{hintsUsed > 1 ? "s" : ""}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {"⭐".repeat(5 - hintsUsed)}{"☆".repeat(hintsUsed)} {" "}
                    {hintsUsed === 1 ? "(Excellent)" : hintsUsed === 2 ? "(Good)" : hintsUsed === 3 ? "(Fair)" : "(Needs practice)"}
                  </div>
                  <div style={{ fontSize: 12, color: THEME.accent, marginTop: 4 }}>
                    XP: {getXPFromHints(isCorrect, hintsUsed) > 0 ? "+" : ""}{getXPFromHints(isCorrect, hintsUsed)}
                  </div>
                </div>
              )}
            </div>

            <RatingButtons
              onRate={handleRate}
              showEasy={isCorrect && hintsUsed === 0}
              showGood={isCorrect && hintsUsed < 3}
              word={currentWord}
            />
          </div>
        )}
      </div>
    );

    // Listening Mode
    if (mode === "listen") return (
      <div style={{ padding: "20px 16px 100px", maxWidth: 480, margin: "0 auto", animation: "vmFadeIn 0.3s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <button className="vm-btn" onClick={exitSession} style={{ background: "none", color: THEME.textSecondary, fontSize: 22, padding: 4 }}>←</button>
          <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textSecondary }}>{idx + 1} / {queue.length}</div>
          <div className="vm-mono" style={{ fontSize: 12, color: THEME.info }}>Listening</div>
        </div>
        
        <div style={{ height: 4, borderRadius: 2, background: THEME.border, marginBottom: 24, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${((idx + (phase === "reveal" ? 1 : 0.5)) / queue.length) * 100}%`, background: `linear-gradient(90deg, ${THEME.info}, ${THEME.accentLight})`, transition: "width 0.4s ease", borderRadius: 2 }} />
        </div>
        
        <div className="vm-card" style={{ padding: 40, textAlign: "center", marginBottom: 20 }}>
          {phase === "think" ? (
            <div style={{ animation: "vmFadeIn 0.3s ease" }}>
              <button className="vm-btn" onClick={() => speak(currentWord.term, 0.7)} style={{
                width: 100, height: 100, borderRadius: "50%", background: `${THEME.info}15`,
                border: `3px solid ${THEME.info}40`, fontSize: 40, color: THEME.info,
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
              }}>🔊</button>
              <div style={{ fontSize: 14, color: THEME.textSecondary, marginBottom: 8 }}>Listen and try to recall the meaning</div>
              <div className="vm-mono" style={{ fontSize: 13, color: THEME.textMuted }}>{currentWord.phonetic}</div>
              <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center" }}>
                <button className="vm-btn" onClick={() => speak(currentWord.term, 0.5)} style={{
                  padding: "10px 20px", borderRadius: 12, background: THEME.surface, color: THEME.textSecondary, fontSize: 13, border: `1px solid ${THEME.border}`,
                }}>🐢 Slow</button>
                <button className="vm-btn" onClick={() => setPhase("reveal")} style={{
                  padding: "10px 28px", borderRadius: 12, background: THEME.gradient1, color: "#fff", fontSize: 14,
                }}>Reveal</button>
              </div>
            </div>
          ) : (
            <div style={{ animation: "vmBounceIn 0.4s ease" }}>
              <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 8 }}>{currentWord.term}</div>
              <div style={{ fontSize: 16, color: THEME.textSecondary, lineHeight: 1.5 }}>{currentWord.definition}</div>
            </div>
          )}
        </div>
        
        {phase === "reveal" && (
          <div style={{ animation: "vmSlideUp 0.3s ease" }}>
            <RatingButtons onRate={handleRate} word={currentWord} />
          </div>
        )}
      </div>
    );

    // Sentence Builder Mode
    if (mode === "sentence") {
      // Generate sentence on first render for this word
      if (phase === "think" && userSentence.length === 0 && sentenceWords.length === 0) {
        const { correct, shuffled } = generateSentence(currentWord);
        setSentenceWords(shuffled);
        setCorrectSentence(correct);
      }

      const checkSentence = () => {
        const userText = userSentence.join(' ').toLowerCase().replace(/[.,!?]/g, '');
        const correctText = correctSentence.join(' ').toLowerCase().replace(/[.,!?]/g, '');
        const correct = userText === correctText;
        setIsCorrect(correct);
        setPhase("reveal");
      };

      return (
        <div style={{ padding: "20px 16px 100px", maxWidth: 480, margin: "0 auto", animation: "vmFadeIn 0.3s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <button className="vm-btn" onClick={() => { exitSession(); setUserSentence([]); setSentenceWords([]); }} style={{ background: "none", color: THEME.textSecondary, fontSize: 22, padding: 4 }}>←</button>
            <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textSecondary }}>{idx + 1} / {queue.length}</div>
            <div className="vm-mono" style={{ fontSize: 12, color: THEME.warning }}>Sentence Builder</div>
          </div>

          <div style={{ height: 4, borderRadius: 2, background: THEME.border, marginBottom: 24, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${((idx + (phase === "reveal" ? 1 : 0.5)) / queue.length) * 100}%`, background: `linear-gradient(90deg, ${THEME.warning}, ${THEME.accent})`, transition: "width 0.4s ease", borderRadius: 2 }} />
          </div>

          {/* Target Word */}
          <div className="vm-card" style={{ padding: 20, marginBottom: 20, textAlign: "center", background: `${THEME.warning}08`, border: `1.5px solid ${THEME.warning}30` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: THEME.warning, marginBottom: 8 }}>TARGET WORD</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{currentWord.term}</div>
            <div style={{ fontSize: 14, color: THEME.textSecondary }}>{currentWord.definition}</div>
          </div>

          {phase === "think" && (
            <div style={{ animation: "vmFadeIn 0.3s ease" }}>
              {/* User's Sentence Area */}
              <div className="vm-card" style={{ padding: 16, marginBottom: 16, minHeight: 80, background: THEME.surface }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: THEME.accent, marginBottom: 12 }}>📝 YOUR SENTENCE</div>
                <div style={{
                  fontSize: 15, lineHeight: 1.8, minHeight: 40,
                  display: "flex", flexWrap: "wrap", gap: 6
                }}>
                  {userSentence.length === 0 ? (
                    <span style={{ color: THEME.textMuted, fontStyle: "italic" }}>Tap words below to build a sentence...</span>
                  ) : (
                    userSentence.map((word, i) => (
                      <button
                        key={i}
                        className="vm-btn"
                        onClick={() => {
                          setUserSentence(prev => prev.filter((_, idx) => idx !== i));
                          setSentenceWords(prev => [...prev, word]);
                        }}
                        style={{
                          padding: "6px 12px", borderRadius: 8, fontSize: 14, fontWeight: 600,
                          background: THEME.accent, color: "#fff",
                          border: "none"
                        }}
                      >
                        {word}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Word Bank */}
              <div className="vm-card" style={{ padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textSecondary, marginBottom: 12 }}>💡 WORD BANK</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {sentenceWords.map((word, i) => (
                    <button
                      key={i}
                      className="vm-btn"
                      onClick={() => {
                        setUserSentence(prev => [...prev, word]);
                        setSentenceWords(prev => prev.filter((_, idx) => idx !== i));
                      }}
                      style={{
                        padding: "8px 14px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                        background: `${THEME.accent}15`, color: THEME.accent,
                        border: `1.5px solid ${THEME.accent}30`
                      }}
                    >
                      {word}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  className="vm-btn"
                  onClick={() => {
                    setSentenceWords([...sentenceWords, ...userSentence]);
                    setUserSentence([]);
                  }}
                  disabled={userSentence.length === 0}
                  style={{
                    flex: 1, padding: 14, borderRadius: 12, fontSize: 14, fontWeight: 600,
                    background: "transparent", color: THEME.textSecondary,
                    border: `1.5px solid ${THEME.border}`,
                    opacity: userSentence.length === 0 ? 0.4 : 1
                  }}
                >
                  🔄 Clear
                </button>
                <button
                  className="vm-btn"
                  onClick={checkSentence}
                  disabled={sentenceWords.length > 0}
                  style={{
                    flex: 2, padding: 14, borderRadius: 12, fontSize: 15, fontWeight: 700,
                    background: sentenceWords.length === 0 ? THEME.gradient1 : THEME.surface,
                    color: sentenceWords.length === 0 ? "#fff" : THEME.textMuted,
                    border: "none",
                    opacity: sentenceWords.length > 0 ? 0.4 : 1
                  }}
                >
                  ✓ Check Answer
                </button>
              </div>
            </div>
          )}

          {phase === "reveal" && (
            <div style={{ animation: "vmSlideUp 0.3s ease" }}>
              {/* Result */}
              <div className="vm-card" style={{
                padding: 20, marginBottom: 20, textAlign: "center",
                background: isCorrect ? `${THEME.success}10` : `${THEME.danger}10`,
                border: `2px solid ${isCorrect ? THEME.success + "40" : THEME.danger + "40"}`
              }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>{isCorrect ? "🎉" : "💪"}</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: isCorrect ? THEME.success : THEME.danger }}>
                  {isCorrect ? "Perfect!" : "Not quite!"}
                </div>
                <div style={{ fontSize: 13, color: THEME.textSecondary, marginBottom: 16 }}>
                  Correct sentence:
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.6 }}>
                  {correctSentence.join(' ')}
                </div>
              </div>

              <RatingButtons onRate={(rating) => {
                handleRate(isCorrect ? (rating === "again" ? "hard" : rating) : "again");
                // Reset for next word
                setUserSentence([]);
                setSentenceWords([]);
                setCorrectSentence([]);
              }} showEasy={isCorrect} word={currentWord} />
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  // ── REVIEW SCREEN (Flashcards + SRS) ────────────────────────
  const ReviewScreen = () => {
    console.log('🔍 ReviewScreen rendering, words.length:', words?.length);

    const [queue, setQueue] = useState([]);
    const [idx, setIdx] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [started, setStarted] = useState(false);
    const [sessionDone, setSessionDone] = useState(false);
    const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0 });
    const [sessionResults, setSessionResults] = useState([]);
    const [sessionHistory, setSessionHistory] = useState([]);
    const [focusMode, setFocusMode] = useState(reviewFocusModePref);

    // Batch learning state
    const [allAvailableWords, setAllAvailableWords] = useState([]);
    const [batchSize] = useState(20);
    const [currentBatchIndex, setCurrentBatchIndex] = useState(0);

    useEffect(() => {
      if (reviewFocusModePref) {
        setFocusMode(true);
        setReviewFocusModePref(false);
      }
    }, [reviewFocusModePref]);

    const startReview = (batchIndex = 0) => {
      isInLearningSession.current = true;
      let allWords;
      if (focusMode) {
        // Focus mode: prioritize weak words (high failure rate)
        const weakWords = words
          .filter(w => {
            const totalReviews = w.srs?.totalReviews || 0;
            const wrongReviews = w.srs?.wrongReviews || 0;
            if (totalReviews < 2) return false;
            const failureRate = wrongReviews / totalReviews;
            return failureRate > 0.25; // More than 25% failure rate
          })
          .sort((a, b) => {
            const aRate = (a.srs?.wrongReviews || 0) / (a.srs?.totalReviews || 1);
            const bRate = (b.srs?.wrongReviews || 0) / (b.srs?.totalReviews || 1);
            return bRate - aRate; // Highest failure rate first
          });

        allWords = weakWords.length > 0 ? weakWords : selectWordsForReview(filteredWords, dueWords, 1000);
        if (weakWords.length > 0 && batchIndex === 0) {
          showToast(`🎯 Focusing on ${allWords.length} weak words`, "info");
        }
      } else {
        // Normal mode: prioritize due words, then least reviewed
        allWords = selectWordsForReview(filteredWords, dueWords, 1000);
      }

      console.log('🚀 startReview: allWords.length =', allWords.length, 'words.length =', words.length, 'dueWords.length =', dueWords.length);

      // Check if there are any words to review
      if (allWords.length === 0) {
        showToast('⚠️ No words available for review', 'warning');
        return;
      }

      setAllAvailableWords(allWords);
      setCurrentBatchIndex(batchIndex);

      // Load only current batch (20 words)
      console.log('🔍 DEBUG: batchSize =', batchSize, 'type:', typeof batchSize);
      const actualBatchSize = batchSize || 20;
      const startIdx = (batchIndex || 0) * actualBatchSize;
      const endIdx = startIdx + actualBatchSize;
      const batchWords = allWords.slice(startIdx, endIdx);

      console.log('📦 startReview: batchWords.length =', batchWords.length, 'startIdx =', startIdx, 'endIdx =', endIdx, 'actualBatchSize =', actualBatchSize);

      setQueue(batchWords);
      setIdx(0);
      setFlipped(false);
      setStarted(true);
      setSessionDone(false);
      setSessionStats({ correct: 0, incorrect: 0 });
      setSessionResults([]);
      setSessionHistory([]);
    };

    const continueNextBatch = () => {
      const nextBatchIndex = currentBatchIndex + 1;
      const actualBatchSize = batchSize || 20;
      const startIdx = nextBatchIndex * actualBatchSize;

      if (startIdx < allAvailableWords.length) {
        startReview(nextBatchIndex);
      }
    };

    const handleRate = (rating) => {
      if (!queue[idx]) return;

      const currentWord = queue[idx];

      // Store result for batch SRS update
      setSessionResults(prev => [...prev, {
        wordId: currentWord.id,
        rating
      }]);

      const isGood = rating === "good" || rating === "easy";
      setSessionStats(p => ({ correct: p.correct + (isGood ? 1 : 0), incorrect: p.incorrect + (isGood ? 0 : 1) }));

      // Track word in session history for review display
      setSessionHistory(prev => [...prev, { word: currentWord, rating, isGood }]);

      if (idx + 1 >= queue.length) {
        // Collect ALL words including current one for batch update
        const allResults = [...sessionResults, { wordId: currentWord.id, rating }];

        // ⚠️ Set flag to prevent Firestore listener interference
        isSyncingFromFirestore.current = true;

        // ✅ Compute SRS updates WITHOUT calling setWords (avoid parent re-render)
        const wordsToSave = allResults.map(result => {
          const w = words.find(word => word.id === result.wordId);
          if (!w) return null;
          const quality = SRSEngine.qualityFromRating(result.rating);
          return { ...w, srs: SRSEngine.processReview(w, quality) };
        }).filter(Boolean);

        // ✅ Store pending updates in ref (will apply when user exits review)
        const prevPending = pendingReviewUpdate.current;
        pendingReviewUpdate.current = {
          allResults,
          wordsToSave: prevPending ? [...prevPending.wordsToSave, ...wordsToSave] : wordsToSave,
          allResultsAccum: prevPending ? [...prevPending.allResultsAccum, ...allResults] : allResults,
        };

        // ✅ Set session done (local state only, no parent re-render)
        setSessionDone(true);

        // ✅ Batch save to Firestore (async, non-blocking)
        if (firestoreService && userId && wordsToSave.length > 0) {
          setTimeout(async () => {
            try {
              await firestoreService.saveWords(wordsToSave);
              console.log(`✅ Review batch saved: ${wordsToSave.length} words`);
            } catch (error) {
              console.error('❌ Review batch save error:', error);
            }
          }, 100);
        }
      } else {
        setIdx(i => i + 1);
        setFlipped(false);
      }
    };

    // Apply deferred setWords/setStats when user exits review
    const applyPendingReviewUpdates = () => {
      const pending = pendingReviewUpdate.current;
      if (!pending) return;

      const { wordsToSave, allResultsAccum } = pending;

      // Now safe to update parent state (user is leaving review)
      setWords(prev => prev.map(w => {
        const updated = wordsToSave.find(u => u.id === w.id);
        return updated || w;
      }));

      updateStreak();
      setStats(prev => {
        const totalXP = allResultsAccum.reduce((sum, result) => {
          const quality = SRSEngine.qualityFromRating(result.rating);
          return sum + (quality >= 4 ? 15 : quality >= 3 ? 10 : 5);
        }, 0);

        const newTodayReviews = (prev.todayDate === new Date().toDateString() ? prev.todayReviews : 0) + allResultsAccum.length;
        const dailyGoal = prev.dailyGoal || 20;

        if (newTodayReviews >= dailyGoal && (prev.todayReviews < dailyGoal)) {
          setTimeout(() => showToast(`🎉 Daily goal reached! ${dailyGoal} reviews completed!`, "success"), 300);
        }

        return {
          ...prev,
          totalReviews: prev.totalReviews + allResultsAccum.length,
          todayReviews: newTodayReviews,
          todayDate: new Date().toDateString(),
          xp: prev.xp + totalXP,
        };
      });

      pendingReviewUpdate.current = null;
      isSyncingFromFirestore.current = false;
    };

    console.log('🔍 ReviewScreen state:', { started, sessionDone, wordsLength: words?.length });

    // Empty state - no words available
    if (words.length === 0) {
      console.log('📭 ReviewScreen: No words');
      return (
        <div style={{ padding: "40px 16px 100px", maxWidth: 480, margin: "0 auto", textAlign: "center", animation: "vmFadeIn 0.4s ease" }}>
          <button className="vm-btn" onClick={() => setScreen("home")} style={{ position: "absolute", top: 20, left: 16, background: "none", color: THEME.textSecondary, fontSize: 22, padding: 4 }}>←</button>
          <div style={{ fontSize: 64, marginBottom: 24 }}>📚</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>No Vocabulary Yet</div>
          <div style={{ fontSize: 15, color: THEME.textSecondary, marginBottom: 32, lineHeight: 1.6 }}>
            You haven't added any words yet.<br/>
            Go to <strong style={{ color: THEME.accent }}>Words</strong> tab to import or add vocabulary.
          </div>
          <button className="vm-btn" onClick={() => setScreen("words")} style={{
            padding: "14px 32px", borderRadius: 14, background: THEME.gradient1, color: "#fff", fontSize: 15
          }}>
            ➕ Add Words
          </button>
        </div>
      );
    }

    if (!started) {
      console.log('🎬 ReviewScreen: Pre-start screen');
      // Calculate available words for review
      const availableWords = focusMode
        ? (words || []).filter(w => {
            const totalReviews = w.srs?.totalReviews || 0;
            const wrongReviews = w.srs?.wrongReviews || 0;
            if (totalReviews < 2) return false;
            const failureRate = wrongReviews / totalReviews;
            return failureRate > 0.25;
          })
        : selectWordsForReview(filteredWords || [], dueWords || [], 1000);

      const totalAvailable = availableWords?.length || 0;
      const totalBatches = batchSize > 0 ? Math.ceil(totalAvailable / batchSize) : 0;

      return (
        <div style={{ padding: "20px 16px 100px", maxWidth: 480, margin: "0 auto", animation: "vmFadeIn 0.4s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
            <button className="vm-btn" onClick={() => setScreen("home")} style={{ background: "none", color: THEME.textSecondary, fontSize: 22, padding: 4 }}>←</button>
            <div style={{ fontSize: 22, fontWeight: 800 }}>Flashcard Review</div>
          </div>

          <div className="vm-card" style={{ padding: 24, textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔄</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Spaced Repetition Review</div>
            <div style={{ fontSize: 14, color: THEME.textSecondary, marginBottom: 20 }}>
              Review flashcards with the SM-2 algorithm. Cards you struggle with will appear more often.
            </div>

            {/* Word count display */}
            <div className="vm-card" style={{ padding: 16, marginBottom: 20, background: `${THEME.accent}08` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
                <div style={{ fontSize: 36 }}>📚</div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: THEME.accent }}>{totalAvailable}</div>
                  <div style={{ fontSize: 13, color: THEME.textSecondary }}>
                    {totalAvailable === 0 ? "No words to review" :
                     totalAvailable <= batchSize ? "words ready" :
                     `words (${totalBatches} batches of ${batchSize})`}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: THEME.danger }}>{dueWords.length}</div>
                <div style={{ fontSize: 11, color: THEME.textMuted }}>Due now</div>
              </div>
              <div style={{ width: 1, background: THEME.border }} />
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: THEME.accent }}>{words.length}</div>
                <div style={{ fontSize: 11, color: THEME.textMuted }}>Total words</div>
              </div>
            </div>

          {/* Focus Mode Toggle */}
          <div style={{ marginBottom: 20 }}>
            <button
              className="vm-btn"
              onClick={() => setFocusMode(!focusMode)}
              style={{
                width: "100%", padding: 14, borderRadius: 12, fontSize: 14, fontWeight: 600,
                background: focusMode ? `${THEME.warning}20` : "transparent",
                color: focusMode ? THEME.warning : THEME.textSecondary,
                border: `2px solid ${focusMode ? THEME.warning + "60" : THEME.border}`,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transition: "all 0.2s ease"
              }}
            >
              <span style={{ fontSize: 16 }}>{focusMode ? "⚠️" : "🎯"}</span>
              <span>{focusMode ? "Focus Mode: ON (Weak Words)" : "Focus Mode: OFF (All Words)"}</span>
            </button>
          </div>

          <button className="vm-btn" onClick={() => startReview(0)} style={{
            padding: "16px 48px", borderRadius: 14, background: THEME.gradient2, color: "#fff", fontSize: 16,
          }}>Start Review</button>
        </div>
      </div>
      );
    }

    if (sessionDone) {
      console.log('✅ ReviewScreen: Session done');
      const total = sessionStats.correct + sessionStats.incorrect;
      const accuracy = total > 0 ? Math.round((sessionStats.correct / total) * 100) : 0;

      // Check if there are more batches
      const totalBatches = Math.ceil(allAvailableWords.length / batchSize);
      const currentBatchNum = currentBatchIndex + 1;
      const hasMoreBatches = (currentBatchIndex + 1) * batchSize < allAvailableWords.length;

      return (
        <div style={{ padding: "40px 16px 100px", maxWidth: 480, margin: "0 auto", textAlign: "center", animation: "vmBounceIn 0.5s ease" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎯</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Batch Complete!</div>
          <div style={{ fontSize: 15, color: THEME.textSecondary, marginBottom: 8 }}>
            {accuracy >= 70 ? "Great job!" : "Keep practicing!"}
          </div>

          {/* Batch progress */}
          {allAvailableWords.length > batchSize && (
            <div style={{ fontSize: 13, color: THEME.textSecondary, marginBottom: 24 }}>
              Batch {currentBatchNum} of {totalBatches} completed
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
            <div className="vm-card" style={{ padding: 16 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: THEME.accent }}>{total}</div>
              <div style={{ fontSize: 11, color: THEME.textMuted }}>Words</div>
            </div>
            <div className="vm-card" style={{ padding: 16 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: THEME.success }}>{accuracy}%</div>
              <div style={{ fontSize: 11, color: THEME.textMuted }}>Accuracy</div>
            </div>
            <div className="vm-card" style={{ padding: 16 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: THEME.warning }}>+{total * 10}</div>
              <div style={{ fontSize: 11, color: THEME.textMuted }}>XP</div>
            </div>
          </div>

          {/* Reviewed Words List */}
          {sessionHistory.length > 0 && (
            <div className="vm-card" style={{ padding: 16, marginBottom: 24, textAlign: "left", maxHeight: 300, overflowY: "auto" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, textAlign: "center", color: THEME.text }}>
                📝 Words Reviewed
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sessionHistory.map((item, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "8px 12px",
                    background: item.isGood ? `${THEME.success}08` : `${THEME.warning}08`,
                    borderRadius: 8, border: `1px solid ${item.isGood ? `${THEME.success}20` : `${THEME.warning}20`}`,
                  }}>
                    <div style={{ fontSize: 18 }}>{item.isGood ? "✓" : "✗"}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: THEME.text }}>{item.word.term}</div>
                      <div style={{ fontSize: 12, color: THEME.textSecondary }}>{item.word.definition}</div>
                    </div>
                    <div style={{
                      fontSize: 10, fontWeight: 700, padding: "4px 8px", borderRadius: 6,
                      background: item.rating === "easy" ? `${THEME.success}20` :
                                 item.rating === "good" ? `${THEME.info}20` :
                                 item.rating === "hard" ? `${THEME.warning}20` :
                                 `${THEME.danger}20`,
                      color: item.rating === "easy" ? THEME.success :
                            item.rating === "good" ? THEME.info :
                            item.rating === "hard" ? THEME.warning :
                            THEME.danger,
                    }}>
                      {item.rating.toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            {hasMoreBatches ? (
              <>
                <button className="vm-btn" onClick={continueNextBatch} style={{
                  flex: 1, padding: 16, borderRadius: 14, background: THEME.gradient2, color: "#fff", fontSize: 15,
                }}>
                  Continue Next Batch →
                </button>
                <button className="vm-btn" onClick={() => { applyPendingReviewUpdates(); isInLearningSession.current = false; setStarted(false); setScreen("home"); }} style={{
                  flex: 1, padding: 16, borderRadius: 14, background: THEME.card, color: THEME.text, fontSize: 15, border: `1px solid ${THEME.border}`,
                }}>
                  Finish
                </button>
              </>
            ) : (
              <button className="vm-btn" onClick={() => { applyPendingReviewUpdates(); isInLearningSession.current = false; setStarted(false); setScreen("home"); }} style={{
                width: "100%", padding: 16, borderRadius: 14, background: THEME.gradient2, color: "#fff", fontSize: 15,
              }}>
                Finish
              </button>
            )}
          </div>
        </div>
      );
    }

    const currentWord = queue[idx];
    if (!currentWord) {
      console.log('⚠️ ReviewScreen: No currentWord, returning null. started:', started, 'queue:', queue.length);
      return null;
    }

    console.log('📝 ReviewScreen: Showing active review');
    return (
      <div style={{ padding: "20px 16px 100px", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <button className="vm-btn" onClick={() => { applyPendingReviewUpdates(); isInLearningSession.current = false; setStarted(false); }} style={{ background: "none", color: THEME.textSecondary, fontSize: 22, padding: 4 }}>←</button>
          <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textSecondary }}>{idx + 1} / {queue.length}</div>
        </div>
        
        <div style={{ height: 4, borderRadius: 2, background: THEME.border, marginBottom: 24, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${((idx + (flipped ? 1 : 0.5)) / queue.length) * 100}%`, background: THEME.gradient2, transition: "width 0.4s ease", borderRadius: 2 }} />
        </div>

        <WordCard word={currentWord} showDef={flipped} onFlip={() => !flipped && setFlipped(true)} />
        
        {flipped && (
          <div style={{ marginTop: 20, animation: "vmSlideUp 0.3s ease" }}>
            <RatingButtons onRate={handleRate} word={currentWord} />
          </div>
        )}
      </div>
    );
  };

  // ── QUIZ SCREEN ─────────────────────────────────────────────
  const QuizScreen = () => {
    const [quizType, setQuizType] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [qIdx, setQIdx] = useState(0);
    const [selected, setSelected] = useState(null);
    const [answered, setAnswered] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [score, setScore] = useState(0);
    const [quizDone, setQuizDone] = useState(false);
    const [spellingInput, setSpellingInput] = useState("");
    const [quizResults, setQuizResults] = useState([]);
    const spellingRef = useRef(null);
    const processingRef = useRef(false);
    // Reading comprehension state
    const [readingQuestionIdx, setReadingQuestionIdx] = useState(0);
    const [readingScore, setReadingScore] = useState(0);

    const generateReadingPassage = (vocabWords) => {
      // TOEIC-style passage templates
      const templates = [
        {
          type: "email",
          template: (w) => `Dear Team,\n\nI am writing to ${w[0].term} the upcoming project changes. It is ${w[1].term} that we maintain clear communication throughout this process. Our team's ability to ${w[2].term} will determine our success.\n\nPlease review the attached documents and provide your feedback by Friday.\n\nBest regards,\nProject Manager`,
          purpose: "To inform team about project changes",
          question: "When should team members provide feedback?",
          answer: "By Friday",
          wrong: ["By Monday", "Immediately", "Next month"]
        },
        {
          type: "memo",
          template: (w) => `MEMO\n\nTo: All Staff\nFrom: Management\nRe: New Policy\n\nEffective immediately, all employees must ${w[0].term} their timesheets weekly. This ${w[1].term} approach will help us ${w[2].term} our payroll process and ensure accuracy.\n\nThank you for your cooperation.`,
          purpose: "To announce a new company policy",
          question: "How often must employees submit timesheets?",
          answer: "Weekly",
          wrong: ["Daily", "Monthly", "Bi-weekly"]
        },
        {
          type: "notice",
          template: (w) => `IMPORTANT NOTICE\n\nThe office will ${w[0].term} a system upgrade next Tuesday. This ${w[1].term} maintenance is necessary to ${w[2].term} our network security. Please save all work before 5 PM.\n\nWe apologize for any inconvenience.`,
          purpose: "To notify staff about system maintenance",
          question: "When will the system upgrade occur?",
          answer: "Next Tuesday",
          wrong: ["This Friday", "Next Monday", "This Tuesday"]
        }
      ];

      const template = templates[Math.floor(Math.random() * templates.length)];
      return {
        text: template.template(vocabWords),
        type: template.type,
        correctPurpose: template.purpose,
        specificQuestion: template.question,
        correctAnswer: template.answer,
        wrongAnswers: template.wrong
      };
    };

    const generateQuiz = (type) => {
      setQuizType(type);
      const pool = shuffleArray(words);
      const qs = [];
      const count = Math.min(10, pool.length);

      for (let i = 0; i < count; i++) {
        const word = pool[i];
        const others = pool.filter((_, j) => j !== i);
        const distractors = shuffleArray(others).slice(0, 3);

        if (type === "mc") {
          const options = shuffleArray([
            { text: word.definition, correct: true },
            ...distractors.map(d => ({ text: d.definition, correct: false })),
          ]);
          qs.push({ word, options, type: "mc" });
        } else if (type === "tf") {
          const isTrue = Math.random() > 0.5;
          const fakeDef = distractors[0]?.definition || "Not a real definition";
          qs.push({ word, shownDef: isTrue ? word.definition : fakeDef, isTrue, type: "tf" });
        } else if (type === "fill") {
          const example = word.examples?.[0] || `The word is ${word.term}.`;
          const blank = example.replace(new RegExp(word.term, "gi"), "_____");
          qs.push({ word, blank, type: "fill" });
        } else if (type === "spell") {
          qs.push({ word, type: "spell" });
        } else if (type === "listen") {
          const options = shuffleArray([
            { text: word.term, correct: true },
            ...distractors.slice(0, 3).map(d => ({ text: d.term, correct: false })),
          ]);
          qs.push({ word, options, type: "listen" });
        } else if (type === "match") {
          // Match uses pairs
          const matchWords = pool.slice(i, Math.min(i + 4, pool.length));
          if (matchWords.length >= 2) {
            qs.push({ words: matchWords, type: "match" });
          }
          if (qs.length >= 5) break;
        } else if (type === "reading") {
          // Reading comprehension - generate passage with 3-5 words
          const passageWords = pool.slice(i, Math.min(i + 5, pool.length));
          if (passageWords.length >= 3) {
            // Generate a business/TOEIC-style passage
            const passage = generateReadingPassage(passageWords);
            // Create 3 comprehension questions
            const readingQuestions = [
              {
                question: `What is the main purpose of this ${passage.type}?`,
                options: shuffleArray([
                  { text: passage.correctPurpose, correct: true },
                  { text: "To provide entertainment", correct: false },
                  { text: "To request a refund", correct: false },
                  { text: "To complain about service", correct: false },
                ])
              },
              {
                question: `According to the passage, what does "${passageWords[0].term}" mean?`,
                options: shuffleArray([
                  { text: passageWords[0].definition, correct: true },
                  ...distractors.slice(0, 3).map(d => ({ text: d.definition, correct: false })),
                ])
              },
              {
                question: passage.specificQuestion,
                options: shuffleArray([
                  { text: passage.correctAnswer, correct: true },
                  ...passage.wrongAnswers.map(a => ({ text: a, correct: false })),
                ])
              }
            ];
            qs.push({ type: "reading", passage: passage.text, passageType: passage.type, questions: readingQuestions, words: passageWords });
          }
          if (qs.length >= 3) break; // Reading has multiple questions, so limit to 3 passages
        }
      }

      setQuestions(qs);
      setQIdx(0);
      setSelected(null);
      setAnswered(false);
      setScore(0);
      setQuizDone(false);
      setQuizResults([]);
      setReadingQuestionIdx(0);
      setReadingScore(0);
    };

    const checkAnswer = (answer) => {
      if (answered || processingRef.current) return;

      processingRef.current = true;
      setSelected(answer);
      setAnswered(true);

      const q = questions[qIdx];
      let correct = false;

      if (q.type === "reading") {
        // For reading, answer is the selected option
        correct = answer.correct;
        if (correct) setReadingScore(s => s + 1);
      } else if (q.type === "mc" || q.type === "listen") {
        correct = answer.correct;
      } else if (q.type === "tf") {
        correct = answer === q.isTrue;
      } else if (q.type === "fill" || q.type === "spell") {
        correct = answer.toLowerCase().trim() === q.word.term.toLowerCase();
      }

      setIsCorrect(correct);
      if (correct) setScore(s => s + 1);

      // Store result for batch SRS update later (reading updates all words in passage)
      if (q.type === "reading") {
        q.words?.forEach(word => {
          setQuizResults(prev => [...prev, {
            wordId: word.id,
            correct,
            rating: correct ? "good" : "again"
          }]);
        });
      } else {
        setQuizResults(prev => [...prev, {
          wordId: q.word?.id,
          correct,
          rating: correct ? "good" : "again"
        }]);
      }

      // Scroll to show Continue button
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 100);
    };

    const nextQuestion = () => {
      processingRef.current = false;

      const q = questions[qIdx];

      // Handle reading comprehension with multiple questions
      if (q.type === "reading" && q.questions && readingQuestionIdx + 1 < q.questions.length) {
        // Move to next question in the same passage
        setReadingQuestionIdx(idx => idx + 1);
        setSelected(null);
        setAnswered(false);
        setIsCorrect(false);
        return;
      }

      // Reset reading question index for next passage
      if (q.type === "reading") {
        setReadingQuestionIdx(0);
      }

      if (qIdx + 1 >= questions.length) {
        // Batch update SRS for all answered questions
        quizResults.forEach(result => {
          if (result.wordId) {
            updateWordSRS(result.wordId, result.rating);
          }
        });

        setQuizDone(true);
        const total = questions.length;
        if (score + (answered && isCorrect ? 1 : 0) === total) {
          setStats(p => ({ ...p, perfectQuizzes: (p.perfectQuizzes || 0) + 1 }));
        }
        setStats(p => ({ ...p, totalQuizzes: (p.totalQuizzes || 0) + 1 }));
      } else {
        setQIdx(q => q + 1);
        setSelected(null);
        setAnswered(false);
        setIsCorrect(false);
        setSpellingInput("");
      }
    };

    // Empty state - no words available
    if (words.length === 0) {
      return (
        <div style={{ padding: "40px 16px 100px", maxWidth: 480, margin: "0 auto", textAlign: "center", animation: "vmFadeIn 0.4s ease" }}>
          <button className="vm-btn" onClick={() => setScreen("home")} style={{ position: "absolute", top: 20, left: 16, background: "none", color: THEME.textSecondary, fontSize: 22, padding: 4 }}>←</button>
          <div style={{ fontSize: 64, marginBottom: 24 }}>📚</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>No Vocabulary Yet</div>
          <div style={{ fontSize: 15, color: THEME.textSecondary, marginBottom: 32, lineHeight: 1.6 }}>
            You haven't added any words yet.<br/>
            Go to <strong style={{ color: THEME.accent }}>Words</strong> tab to import or add vocabulary.
          </div>
          <button className="vm-btn" onClick={() => setScreen("words")} style={{
            padding: "14px 32px", borderRadius: 14, background: THEME.gradient1, color: "#fff", fontSize: 15
          }}>
            ➕ Add Words
          </button>
        </div>
      );
    }

    // Quiz Type Select
    if (!quizType) return (
      <div style={{ padding: "20px 16px 100px", maxWidth: 480, margin: "0 auto", animation: "vmFadeIn 0.4s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <button className="vm-btn" onClick={() => setScreen("home")} style={{ background: "none", color: THEME.textSecondary, fontSize: 22, padding: 4 }}>←</button>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Quiz Mode</div>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { id: "mc", icon: "🔤", name: "Multiple Choice", desc: "Pick the right definition", color: THEME.accent },
            { id: "tf", icon: "✅", name: "True / False", desc: "Is this definition correct?", color: THEME.success },
            { id: "reading", icon: "📖", name: "Reading", desc: "TOEIC-style comprehension", color: "#00b894", featured: true },
            { id: "fill", icon: "✏️", name: "Fill in Blank", desc: "Complete the sentence", color: THEME.warning },
            { id: "spell", icon: "📝", name: "Spelling", desc: "Type the correct word", color: THEME.info },
            { id: "listen", icon: "👂", name: "Listening", desc: "Identify the spoken word", color: THEME.danger },
            { id: "match", icon: "🔗", name: "Matching", desc: "Match words to meanings", color: "#a29bfe" },
          ].map(q => (
            <button key={q.id} className="vm-btn vm-card" onClick={() => generateQuiz(q.id)} style={{
              padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center",
            }}>
              <div style={{ fontSize: 32 }}>{q.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: q.color }}>{q.name}</div>
              <div style={{ fontSize: 11, color: THEME.textMuted }}>{q.desc}</div>
            </button>
          ))}
        </div>
      </div>
    );

    // Quiz Done
    if (quizDone) {
      const accuracy = Math.round((score / questions.length) * 100);
      return (
        <div style={{ padding: "40px 16px 100px", maxWidth: 480, margin: "0 auto", textAlign: "center", animation: "vmBounceIn 0.5s ease" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>{accuracy === 100 ? "🏆" : accuracy >= 70 ? "🎉" : "💪"}</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Quiz Complete!</div>
          <div style={{ fontSize: 40, fontWeight: 800, color: accuracy >= 70 ? THEME.success : THEME.warning }}>{score}/{questions.length}</div>
          <div style={{ fontSize: 16, color: THEME.textSecondary, marginBottom: 32 }}>{accuracy}% correct</div>
          <div style={{ display: "flex", gap: 12 }}>
            <button className="vm-btn" onClick={() => generateQuiz(quizType)} style={{ flex: 1, padding: 16, borderRadius: 14, background: THEME.gradient1, color: "#fff", fontSize: 15 }}>Try Again</button>
            <button className="vm-btn" onClick={() => setQuizType(null)} style={{ flex: 1, padding: 16, borderRadius: 14, background: THEME.card, color: THEME.text, fontSize: 15, border: `1px solid ${THEME.border}` }}>Other Quiz</button>
          </div>
        </div>
      );
    }

    const q = questions[qIdx];
    if (!q) return null;
    const progress = (qIdx / questions.length) * 100;

    return (
      <div style={{ padding: "20px 16px 100px", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button className="vm-btn" onClick={() => setQuizType(null)} style={{ background: "none", color: THEME.textSecondary, fontSize: 22, padding: 4 }}>←</button>
          <div style={{ fontSize: 13, fontWeight: 600, color: THEME.textSecondary }}>Q{qIdx + 1} / {questions.length}</div>
          <div className="vm-tag" style={{ background: `${THEME.success}15`, color: THEME.success }}>{score} ✓</div>
        </div>
        
        <div style={{ height: 4, borderRadius: 2, background: THEME.border, marginBottom: 24, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: THEME.gradient1, transition: "width 0.4s ease", borderRadius: 2 }} />
        </div>

        {/* Multiple Choice */}
        {q.type === "mc" && (
          <div style={{ animation: "vmFadeIn 0.3s ease" }}>
            <div className="vm-card" style={{ padding: 20, marginBottom: 20, textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>What does this word mean?</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{q.word.term}</div>
              <div className="vm-mono" style={{ fontSize: 13, color: THEME.textMuted }}>{q.word.phonetic}</div>
            </div>
            {q.options.map((opt, i) => (
              <button key={i} className="vm-btn" onClick={() => checkAnswer(opt)} disabled={answered} style={{
                width: "100%", padding: 16, marginBottom: 10, borderRadius: 14, textAlign: "left",
                background: !answered ? THEME.card : opt.correct ? `${THEME.success}15` : (selected === opt ? `${THEME.danger}15` : THEME.card),
                border: `1.5px solid ${!answered ? THEME.border : opt.correct ? THEME.success : (selected === opt ? THEME.danger : THEME.border)}`,
                color: THEME.text, fontSize: 14, lineHeight: 1.5, opacity: answered && !opt.correct && selected !== opt ? 0.4 : 1,
              }}>
                <span style={{ fontWeight: 600, marginRight: 8, color: THEME.textMuted }}>{String.fromCharCode(65 + i)}.</span>
                {opt.text}
                {answered && opt.correct && <span style={{ float: "right", color: THEME.success }}>✓</span>}
                {answered && selected === opt && !opt.correct && <span style={{ float: "right", color: THEME.danger }}>✕</span>}
              </button>
            ))}
          </div>
        )}

        {/* True/False */}
        {q.type === "tf" && (
          <div style={{ animation: "vmFadeIn 0.3s ease" }}>
            <div className="vm-card" style={{ padding: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{q.word.term}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textMuted, marginBottom: 8 }}>Is this definition correct?</div>
              <div style={{ fontSize: 16, color: THEME.textSecondary, lineHeight: 1.5, padding: 14, borderRadius: 10, background: THEME.surface }}>
                "{q.shownDef}"
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              {[true, false].map(val => (
                <button key={String(val)} className="vm-btn" onClick={() => checkAnswer(val)} disabled={answered} style={{
                  flex: 1, padding: 20, borderRadius: 14, fontSize: 18, fontWeight: 700,
                  background: !answered ? (val ? `${THEME.success}12` : `${THEME.danger}12`) :
                    (val === q.isTrue ? `${THEME.success}20` : (selected === val ? `${THEME.danger}20` : THEME.card)),
                  color: val ? THEME.success : THEME.danger,
                  border: `2px solid ${!answered ? "transparent" : (val === q.isTrue ? THEME.success : (selected === val ? THEME.danger : "transparent"))}`,
                }}>
                  {val ? "✓ True" : "✕ False"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Fill in Blank */}
        {q.type === "fill" && (
          <div style={{ animation: "vmFadeIn 0.3s ease" }}>
            <div className="vm-card" style={{ padding: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Fill in the blank</div>
              <div style={{ fontSize: 17, lineHeight: 1.6 }}>{q.blank}</div>
            </div>
            {!answered ? (
              <div>
                <input className="vm-input" value={spellingInput} onChange={e => setSpellingInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && spellingInput.trim() && checkAnswer(spellingInput)}
                  placeholder="Type the missing word..." autoFocus
                  style={{ fontSize: 17, padding: "14px 18px", textAlign: "center", fontWeight: 600, marginBottom: 12 }}
                />
                <button className="vm-btn" onClick={() => checkAnswer(spellingInput)} disabled={!spellingInput.trim()} style={{
                  width: "100%", padding: 14, borderRadius: 14, background: spellingInput.trim() ? THEME.gradient1 : THEME.border,
                  color: "#fff", fontSize: 15, opacity: spellingInput.trim() ? 1 : 0.5,
                }}>Submit</button>
              </div>
            ) : (
              <div className="vm-card" style={{
                padding: 16, textAlign: "center",
                background: selected.toLowerCase().trim() === q.word.term.toLowerCase() ? `${THEME.success}10` : `${THEME.danger}10`,
              }}>
                <div style={{ fontSize: 24 }}>{selected.toLowerCase().trim() === q.word.term.toLowerCase() ? "✅" : "❌"}</div>
                <div style={{ fontWeight: 700, fontSize: 18, marginTop: 8 }}>Answer: {q.word.term}</div>
              </div>
            )}
          </div>
        )}

        {/* Spelling */}
        {q.type === "spell" && (
          <div style={{ animation: "vmFadeIn 0.3s ease" }}>
            <div className="vm-card" style={{ padding: 20, marginBottom: 20, textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Spell this word</div>
              <div style={{ fontSize: 16, color: THEME.textSecondary, marginBottom: 8 }}>{q.word.definition}</div>
              <button className="vm-btn" onClick={() => speak(q.word.term)} style={{ background: `${THEME.info}15`, color: THEME.info, padding: "8px 20px", borderRadius: 10, fontSize: 14 }}>
                🔊 Listen
              </button>
            </div>
            {!answered ? (
              <div>
                <input className="vm-input" ref={spellingRef} value={spellingInput} onChange={e => setSpellingInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && spellingInput.trim() && checkAnswer(spellingInput)}
                  placeholder="Type the word..." autoFocus
                  style={{ fontSize: 20, padding: "16px 18px", textAlign: "center", fontWeight: 600, letterSpacing: 2, marginBottom: 12 }}
                />
                <button className="vm-btn" onClick={() => checkAnswer(spellingInput)} disabled={!spellingInput.trim()} style={{
                  width: "100%", padding: 14, borderRadius: 14, background: spellingInput.trim() ? THEME.gradient1 : THEME.border,
                  color: "#fff", fontSize: 15, opacity: spellingInput.trim() ? 1 : 0.5,
                }}>Check Spelling</button>
              </div>
            ) : (
              <div className="vm-card" style={{
                padding: 16, textAlign: "center",
                background: selected.toLowerCase().trim() === q.word.term.toLowerCase() ? `${THEME.success}10` : `${THEME.danger}10`,
              }}>
                <div style={{ fontSize: 24 }}>{selected.toLowerCase().trim() === q.word.term.toLowerCase() ? "✅" : "❌"}</div>
                <div style={{ fontWeight: 700, fontSize: 20, marginTop: 8, letterSpacing: 1 }}>{q.word.term}</div>
              </div>
            )}
          </div>
        )}

        {/* Listening Quiz */}
        {q.type === "listen" && (
          <div style={{ animation: "vmFadeIn 0.3s ease" }}>
            <div className="vm-card" style={{ padding: 24, marginBottom: 20, textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Which word did you hear?</div>
              <div style={{ fontSize: 16, color: THEME.textSecondary, marginBottom: 16 }}>"{q.word.definition}"</div>
              <button className="vm-btn" onClick={() => speak(q.word.term)} style={{
                width: 80, height: 80, borderRadius: "50%", background: `${THEME.info}15`,
                border: `2px solid ${THEME.info}40`, fontSize: 32, color: THEME.info, margin: "0 auto",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>🔊</button>
            </div>
            {q.options.map((opt, i) => (
              <button key={i} className="vm-btn" onClick={() => checkAnswer(opt)} disabled={answered} style={{
                width: "100%", padding: 16, marginBottom: 10, borderRadius: 14, textAlign: "center",
                background: !answered ? THEME.card : opt.correct ? `${THEME.success}15` : (selected === opt ? `${THEME.danger}15` : THEME.card),
                border: `1.5px solid ${!answered ? THEME.border : opt.correct ? THEME.success : (selected === opt ? THEME.danger : THEME.border)}`,
                color: THEME.text, fontSize: 17, fontWeight: 600,
              }}>
                {opt.text}
              </button>
            ))}
          </div>
        )}

        {/* Reading Comprehension */}
        {q.type === "reading" && (
          <div style={{ animation: "vmFadeIn 0.3s ease" }}>
            {/* Passage */}
            <div className="vm-card" style={{ padding: 20, marginBottom: 20, background: THEME.surface }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: THEME.warning, textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span>📖</span>
                <span>{q.passageType.toUpperCase()}</span>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.8, color: THEME.text, whiteSpace: "pre-wrap", fontFamily: "Georgia, serif" }}>
                {q.passage}
              </div>
            </div>

            {/* Current Reading Question */}
            {q.questions && q.questions[readingQuestionIdx] && (
              <div>
                <div className="vm-card" style={{ padding: 16, marginBottom: 16, background: `${THEME.accent}08`, border: `1.5px solid ${THEME.accent}30` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: THEME.accent, marginBottom: 8 }}>
                    Question {readingQuestionIdx + 1} of {q.questions.length}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.6 }}>
                    {q.questions[readingQuestionIdx].question}
                  </div>
                </div>

                {/* Options */}
                {q.questions[readingQuestionIdx].options.map((opt, i) => (
                  <button
                    key={i}
                    className="vm-btn"
                    onClick={() => checkAnswer(opt)}
                    disabled={answered}
                    style={{
                      width: "100%", padding: 14, marginBottom: 10, borderRadius: 12, textAlign: "left",
                      background: !answered ? THEME.card : opt.correct ? `${THEME.success}15` : (selected === opt ? `${THEME.danger}15` : THEME.card),
                      border: `1.5px solid ${!answered ? THEME.border : opt.correct ? THEME.success : (selected === opt ? THEME.danger : THEME.border)}`,
                      color: THEME.text, fontSize: 14, lineHeight: 1.5,
                      opacity: answered && !opt.correct && selected !== opt ? 0.4 : 1,
                    }}
                  >
                    <span style={{ fontWeight: 600, marginRight: 8, color: THEME.textMuted }}>{String.fromCharCode(65 + i)}.</span>
                    {opt.text}
                    {answered && opt.correct && <span style={{ float: "right", color: THEME.success }}>✓</span>}
                    {answered && selected === opt && !opt.correct && <span style={{ float: "right", color: THEME.danger }}>✕</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Matching */}
        {q.type === "match" && <MatchingQuiz question={q} answered={answered} onAnswer={(correct) => {
          if (processingRef.current) return;
          processingRef.current = true;
          setAnswered(true);
          setIsCorrect(correct);
          if (correct) setScore(s => s + 1);

          // Store matching results for batch SRS update
          q.words.forEach(word => {
            setQuizResults(prev => [...prev, {
              wordId: word.id,
              correct,
              rating: correct ? "good" : "again"
            }]);
          });

          setTimeout(() => {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          }, 100);
        }} />}

        {answered && (
          <div style={{ marginTop: 24, marginBottom: 40, animation: "vmBounceIn 0.5s ease" }}>
            <div style={{
              padding: 16, borderRadius: 12, marginBottom: 16, textAlign: "center",
              background: (isCorrect ? THEME.success : THEME.danger) + "15",
              border: `2px solid ${isCorrect ? THEME.success : THEME.danger}`,
            }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>{isCorrect ? "✅" : "❌"}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: isCorrect ? THEME.success : THEME.danger }}>
                {isCorrect ? "Correct!" : "Incorrect!"}
              </div>
            </div>
            <button className="vm-btn" onClick={nextQuestion} style={{
              width: "100%", padding: 20, borderRadius: 14, background: THEME.gradient1, color: "#fff", fontSize: 18, fontWeight: 700,
              boxShadow: "0 8px 24px rgba(108,92,231,0.5)",
            }}>
              {qIdx + 1 >= questions.length
                ? "📊 See Results"
                : q.type === "reading" && readingQuestionIdx + 1 < q.questions.length
                  ? `Next Question (${readingQuestionIdx + 2}/${q.questions.length}) →`
                  : "Continue →"
              }
            </button>
          </div>
        )}
      </div>
    );
  };

  // Simple matching sub-component
  const MatchingQuiz = ({ question, answered, onAnswer }) => {
    const [pairs, setPairs] = useState([]);
    const [selectedWord, setSelectedWord] = useState(null);
    const [matched, setMatched] = useState({});
    
    useEffect(() => {
      setPairs(question.words.map(w => ({ id: w.id, term: w.term, definition: w.definition })));
      setMatched({});
      setSelectedWord(null);
    }, [question]);
    
    const shuffledDefs = useMemo(() => shuffleArray(pairs.map(p => ({ id: p.id, definition: p.definition }))), [pairs]);
    
    const handleWordClick = (wordId) => {
      if (answered || matched[wordId]) return;
      setSelectedWord(wordId);
    };
    
    const handleDefClick = (defId) => {
      if (answered || !selectedWord) return;
      const newMatched = { ...matched, [selectedWord]: defId };
      setMatched(newMatched);
      setSelectedWord(null);
      
      if (Object.keys(newMatched).length === pairs.length) {
        const allCorrect = Object.entries(newMatched).every(([wId, dId]) => wId === dId);
        onAnswer(allCorrect);
      }
    };
    
    return (
      <div style={{ animation: "vmFadeIn 0.3s ease" }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: THEME.textSecondary }}>Match words to definitions</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            {pairs.map(p => (
              <button key={p.id} className="vm-btn" onClick={() => handleWordClick(p.id)} style={{
                width: "100%", padding: 12, marginBottom: 8, borderRadius: 10, fontSize: 14, fontWeight: 600,
                background: matched[p.id] ? `${THEME.success}12` : (selectedWord === p.id ? `${THEME.accent}20` : THEME.card),
                border: `1.5px solid ${matched[p.id] ? THEME.success : (selectedWord === p.id ? THEME.accent : THEME.border)}`,
                color: THEME.text, opacity: matched[p.id] ? 0.6 : 1,
              }}>{p.term}</button>
            ))}
          </div>
          <div>
            {shuffledDefs.map(d => {
              const isMatched = Object.values(matched).includes(d.id);
              return (
                <button key={d.id} className="vm-btn" onClick={() => handleDefClick(d.id)} style={{
                  width: "100%", padding: 12, marginBottom: 8, borderRadius: 10, fontSize: 12,
                  background: isMatched ? `${THEME.success}12` : THEME.card,
                  border: `1.5px solid ${isMatched ? THEME.success : THEME.border}`,
                  color: THEME.textSecondary, textAlign: "left", lineHeight: 1.4,
                  opacity: isMatched ? 0.6 : 1,
                }}>{d.definition.slice(0, 50)}{d.definition.length > 50 ? "..." : ""}</button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── WORDS LIST SCREEN ───────────────────────────────────────
  const WordsScreen = () => {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");
    const [showImport, setShowImport] = useState(false);
    const [importText, setImportText] = useState("");
    const [showAdd, setShowAdd] = useState(false);
    const [newWord, setNewWord] = useState({ term: "", definition: "", phonetic: "", partOfSpeech: "n", examples: "", synonyms: "", category: "custom" });
    const [expandedId, setExpandedId] = useState(null);

    const filtered = useMemo(() => {
      let result = words;
      if (search) result = result.filter(w => w.term.toLowerCase().includes(search.toLowerCase()) || w.definition.toLowerCase().includes(search.toLowerCase()));
      if (filter !== "all") result = result.filter(w => w.category === filter);
      return result;
    }, [words, search, filter]);

    const handleImport = async () => {
      const lines = importText.split("\n").filter(l => l.trim() && !l.startsWith("#"));
      const newWords = lines.map((line, i) => {
        const parts = line.split("|").map(p => p.trim());
        if (parts.length < 2) return null;
        return {
          id: `imp_${Date.now()}_${i}`,
          term: parts[0],
          definition: parts[1],
          phonetic: parts[2] || "",
          partOfSpeech: parts[3] || "n",
          examples: parts[4] ? parts[4].split(";").map(e => e.trim()) : [],
          synonyms: parts[5] ? parts[5].split(",").map(s => s.trim()) : [],
          category: parts[6] || "custom",
          srs: {},
        };
      }).filter(Boolean);

      if (newWords.length > 0) {
        setWords(prev => [...prev, ...newWords]);

        // Save to Firestore if available (OPTIMIZED: uses writeBatch)
        if (firestoreService && userId) {
          showToast(`💾 Saving ${newWords.length} words to Firestore...`, "warning");
          await firestoreService.saveWords(newWords);
          showToast(`✅ Imported ${newWords.length} words!`, "success");
        } else {
          showToast(`✅ Imported ${newWords.length} words!`, "success");
        }

        setShowImport(false);
        setImportText("");
      }
    };

    const handleAddWord = async () => {
      if (!newWord.term.trim() || !newWord.definition.trim()) return;
      const word = {
        id: `w_${Date.now()}`,
        ...newWord,
        examples: newWord.examples ? newWord.examples.split(";").map(e => e.trim()).filter(Boolean) : [],
        synonyms: newWord.synonyms ? newWord.synonyms.split(",").map(s => s.trim()).filter(Boolean) : [],
        srs: {},
      };
      setWords(prev => [...prev, word]);

      // Save to Firestore if available
      if (firestoreService && userId) {
        await firestoreService.saveWord(word);
      }

      showToast(`Added "${word.term}"`);
      setShowAdd(false);
      setNewWord({ term: "", definition: "", phonetic: "", partOfSpeech: "n", examples: "", synonyms: "", category: "custom" });
    };

    const deleteWord = async (id) => {
      setWords(prev => prev.filter(w => w.id !== id));

      // Delete from Firestore if available
      if (firestoreService && userId) {
        await firestoreService.deleteWord(id);
      }

      showToast("Word deleted", "warning");
    };

    // Import Modal
    if (showImport) return (
      <div style={{ padding: "20px 16px 100px", maxWidth: 480, margin: "0 auto", animation: "vmFadeIn 0.3s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button className="vm-btn" onClick={() => setShowImport(false)} style={{ background: "none", color: THEME.textSecondary, fontSize: 22, padding: 4 }}>←</button>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Import Vocabulary</div>
        </div>
        
        <div className="vm-card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: THEME.accent }}>📋 Format Guide</div>
          <div className="vm-mono" style={{ fontSize: 11, color: THEME.textSecondary, lineHeight: 1.8, padding: 12, borderRadius: 8, background: THEME.surface }}>
            word | definition<br/>
            word | definition | phonetic<br/>
            word | definition | phonetic | pos | examples | synonyms | category
          </div>
        </div>
        
        <textarea className="vm-input" value={importText} onChange={e => setImportText(e.target.value)}
          placeholder={"ubiquitous | present everywhere\nresilient | able to recover quickly\nleverage | use to maximum advantage"}
          style={{ height: 240, resize: "vertical", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}
        />
        
        <div style={{ display: "flex", gap: 12 }}>
          <button className="vm-btn" onClick={handleImport} disabled={!importText.trim()} style={{
            flex: 1, padding: 16, borderRadius: 14, background: importText.trim() ? THEME.gradient1 : THEME.border,
            color: "#fff", fontSize: 15, opacity: importText.trim() ? 1 : 0.5,
          }}>Import {importText.split("\n").filter(l => l.trim() && !l.startsWith("#")).length} words</button>
        </div>
      </div>
    );

    // Add Word Modal
    if (showAdd) return (
      <div style={{ padding: "20px 16px 100px", maxWidth: 480, margin: "0 auto", animation: "vmFadeIn 0.3s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button className="vm-btn" onClick={() => setShowAdd(false)} style={{ background: "none", color: THEME.textSecondary, fontSize: 22, padding: 4 }}>←</button>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Add New Word</div>
        </div>
        
        {[
          { key: "term", label: "Word *", placeholder: "e.g. ubiquitous" },
          { key: "definition", label: "Definition *", placeholder: "e.g. present, appearing everywhere" },
          { key: "phonetic", label: "Phonetic", placeholder: "e.g. /juːˈbɪkwɪtəs/" },
          { key: "examples", label: "Examples (;separated)", placeholder: "e.g. It's ubiquitous today; Found everywhere" },
          { key: "synonyms", label: "Synonyms (,separated)", placeholder: "e.g. omnipresent, pervasive" },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: THEME.textSecondary, marginBottom: 6, display: "block" }}>{f.label}</label>
            <input className="vm-input" value={newWord[f.key]} onChange={e => setNewWord(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} />
          </div>
        ))}
        
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: THEME.textSecondary, marginBottom: 6, display: "block" }}>Category</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {CATEGORIES.map(c => (
              <button key={c.id} className="vm-btn" onClick={() => setNewWord(p => ({ ...p, category: c.id }))} style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: newWord.category === c.id ? `${c.color}20` : THEME.surface,
                color: newWord.category === c.id ? c.color : THEME.textMuted,
                border: `1.5px solid ${newWord.category === c.id ? c.color : THEME.border}`,
              }}>{c.icon} {c.name}</button>
            ))}
          </div>
        </div>
        
        <button className="vm-btn" onClick={handleAddWord} disabled={!newWord.term.trim() || !newWord.definition.trim()} style={{
          width: "100%", padding: 16, marginTop: 8, borderRadius: 14,
          background: (newWord.term.trim() && newWord.definition.trim()) ? THEME.gradient1 : THEME.border,
          color: "#fff", fontSize: 16, opacity: (newWord.term.trim() && newWord.definition.trim()) ? 1 : 0.5,
        }}>Add Word</button>
      </div>
    );

    return (
      <div style={{ padding: "20px 16px 100px", maxWidth: 480, margin: "0 auto", animation: "vmFadeIn 0.4s ease" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>My Words</div>
            <div style={{ fontSize: 13, color: THEME.textSecondary }}>{words.length} words total</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="vm-btn" onClick={() => setShowImport(true)} style={{
              padding: "8px 14px", borderRadius: 10, background: `${THEME.accent}15`, color: THEME.accent, fontSize: 13,
            }}>📥 Import</button>
            <button className="vm-btn" onClick={() => setShowAdd(true)} style={{
              padding: "8px 14px", borderRadius: 10, background: THEME.gradient1, color: "#fff", fontSize: 13,
            }}>+ Add</button>
          </div>
        </div>
        
        <input className="vm-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search words..."
          style={{ marginBottom: 12 }}
        />
        
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
          <button className="vm-btn" onClick={() => setFilter("all")} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
            background: filter === "all" ? `${THEME.accent}20` : THEME.surface,
            color: filter === "all" ? THEME.accent : THEME.textMuted,
          }}>All ({words.length})</button>
          {CATEGORIES.filter(c => words.some(w => w.category === c.id)).map(c => (
            <button key={c.id} className="vm-btn" onClick={() => setFilter(c.id)} style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
              background: filter === c.id ? `${c.color}20` : THEME.surface,
              color: filter === c.id ? c.color : THEME.textMuted,
            }}>{c.icon} {c.name}</button>
          ))}
        </div>
        
        <div>
          {filtered.map(word => {
            const mastery = SRSEngine.getMasteryLevel(word);
            const m = MASTERY[mastery];
            const expanded = expandedId === word.id;
            return (
              <div key={word.id} className="vm-card" style={{ marginBottom: 8, overflow: "hidden" }}>
                <div onClick={() => setExpandedId(expanded ? null : word.id)} style={{
                  padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                }}>
                  <div style={{ width: 4, height: 32, borderRadius: 2, background: m.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{word.term}</span>
                      <span className="vm-mono" style={{ fontSize: 11, color: THEME.textMuted }}>{word.phonetic}</span>
                    </div>
                    <div style={{ fontSize: 13, color: THEME.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {word.definition}
                    </div>
                  </div>
                  <span style={{ fontSize: 16 }}>{m.icon}</span>
                  <span style={{ color: THEME.textMuted, fontSize: 16, transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
                </div>
                {expanded && (
                  <div style={{ padding: "0 16px 14px", animation: "vmFadeIn 0.2s ease" }}>
                    <div style={{ height: 1, background: THEME.border, marginBottom: 12 }} />
                    {word.examples?.length > 0 && word.examples.map((ex, i) => (
                      <div key={i} style={{ fontSize: 13, color: THEME.textSecondary, marginBottom: 4, fontStyle: "italic", display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ flex: 1 }}>• "{ex}"</div>
                        <button
                          className="vm-btn"
                          onClick={(e) => { e.stopPropagation(); speak(ex); }}
                          style={{
                            background: "none",
                            color: THEME.accent,
                            fontSize: 16,
                            padding: 2,
                            flexShrink: 0
                          }}
                          title="Listen to example"
                        >
                          🔊
                        </button>
                      </div>
                    ))}
                    {word.synonyms?.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                        {word.synonyms.map((s, i) => (
                          <span key={i} className="vm-tag" style={{ background: `${THEME.success}12`, color: THEME.success, fontSize: 11 }}>{s}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button className="vm-btn" onClick={(e) => { e.stopPropagation(); speak(word.term); }} style={{
                        padding: "6px 14px", borderRadius: 8, background: `${THEME.info}12`, color: THEME.info, fontSize: 12,
                      }}>🔊 Play</button>
                      <button className="vm-btn" onClick={(e) => { e.stopPropagation(); deleteWord(word.id); }} style={{
                        padding: "6px 14px", borderRadius: 8, background: `${THEME.danger}12`, color: THEME.danger, fontSize: 12,
                      }}>🗑 Delete</button>
                      <div style={{ flex: 1 }} />
                      <span style={{ fontSize: 11, color: THEME.textMuted, alignSelf: "center" }}>
                        Next: {formatDate(word.srs?.nextReview)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: THEME.textMuted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
              <div>No words found</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── PROFILE/STATS SCREEN ────────────────────────────────────
  const ProfileScreen = () => {
    const weeklyData = useMemo(() => {
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      return days.map((d, i) => ({ day: d, reviews: Math.floor(Math.random() * 20) + (stats.todayReviews || 0) * (i === new Date().getDay() - 1 ? 1 : 0) }));
    }, [stats]);

    const maxReviews = Math.max(...weeklyData.map(d => d.reviews), 1);

    // Calculate weak words (failure rate > 30% and at least 3 reviews)
    const weakWords = useMemo(() => {
      return words
        .filter(w => {
          const totalReviews = w.srs?.totalReviews || 0;
          const wrongReviews = w.srs?.wrongReviews || 0;
          if (totalReviews < 3) return false; // Need at least 3 reviews to be statistically relevant
          const failureRate = wrongReviews / totalReviews;
          return failureRate > 0.3; // More than 30% failure rate
        })
        .map(w => ({
          ...w,
          failureRate: ((w.srs?.wrongReviews || 0) / (w.srs?.totalReviews || 1)) * 100
        }))
        .sort((a, b) => b.failureRate - a.failureRate) // Highest failure rate first
        .slice(0, 10); // Top 10 weak words
    }, [words]);

    return (
      <div style={{ padding: "20px 16px 100px", maxWidth: 480, margin: "0 auto", animation: "vmFadeIn 0.4s ease" }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>Your Progress</div>
        
        {/* Stats Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
          <StatCard icon="📚" label="Total Words" value={words.length} color={THEME.accent} />
          <StatCard icon="🔥" label="Streak" value={`${stats.streak}d`} color={THEME.danger} />
          <StatCard icon="📊" label="Total Reviews" value={stats.totalReviews} color={THEME.success} />
          <StatCard icon="⚡" label="XP" value={stats.xp} color={THEME.warning} />
        </div>
        
        {/* Weekly Chart */}
        <div className="vm-card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>📊 This Week</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
            {weeklyData.map((d, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center" }}>
                <div style={{
                  height: `${Math.max((d.reviews / maxReviews) * 100, 4)}%`,
                  background: d.reviews > 0 ? THEME.gradient1 : THEME.border,
                  borderRadius: "6px 6px 0 0",
                  transition: "height 0.5s ease",
                  minHeight: 4,
                  position: "relative",
                }}>
                  {d.reviews > 0 && (
                    <div style={{ position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)", fontSize: 10, fontWeight: 700, color: THEME.accent }}>
                      {d.reviews}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 10, color: THEME.textMuted, marginTop: 6, fontWeight: 600 }}>{d.day}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Weak Words Analysis */}
        {weakWords.length > 0 && (
          <div className="vm-card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
              ⚠️ <span>Weak Areas</span>
            </div>
            <div style={{ fontSize: 12, color: THEME.textSecondary, marginBottom: 16 }}>
              Words with high failure rate (need more practice)
            </div>

            {weakWords.map((word, idx) => (
              <div key={word.id} style={{
                padding: "12px 0",
                borderBottom: idx < weakWords.length - 1 ? `1px solid ${THEME.border}15` : "none",
                display: "flex", alignItems: "center", gap: 12
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: `${THEME.danger}20`, border: `1.5px solid ${THEME.danger}40`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, color: THEME.danger
                }}>
                  {Math.round(word.failureRate)}%
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{word.term}</div>
                  <div style={{ fontSize: 11, color: THEME.textSecondary }}>
                    {word.srs?.wrongReviews || 0} wrong / {word.srs?.totalReviews || 0} total
                  </div>
                </div>
                <button
                  className="vm-btn"
                  onClick={() => {
                    setScreen("review");
                    showToast(`Focus on: ${word.term}`, "info");
                  }}
                  style={{
                    padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                    background: `${THEME.accent}15`, color: THEME.accent,
                    border: `1px solid ${THEME.accent}30`
                  }}
                >
                  Review
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Mastery Breakdown */}
        <div className="vm-card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Mastery Breakdown</div>
          {MASTERY.map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <span style={{ fontSize: 18, width: 28, textAlign: "center" }}>{m.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, width: 80, color: m.color }}>{m.name}</span>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: THEME.surface, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${words.length > 0 ? (masteryDist[i] / words.length) * 100 : 0}%`,
                  background: m.color, borderRadius: 4, transition: "width 0.5s ease",
                }} />
              </div>
              <span className="vm-mono" style={{ fontSize: 12, color: THEME.textMuted, width: 28, textAlign: "right" }}>{masteryDist[i]}</span>
            </div>
          ))}
        </div>
        
        {/* Achievements */}
        <div className="vm-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>
            🏆 Achievements ({unlockedAchievements.length}/{ACHIEVEMENTS.length})
          </div>
          {ACHIEVEMENTS.map(a => {
            const unlocked = a.condition({ ...stats, totalWords: words.length });
            return (
              <div key={a.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
                borderBottom: `1px solid ${THEME.border}15`, opacity: unlocked ? 1 : 0.35,
              }}>
                <span style={{ fontSize: 28 }}>{a.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: unlocked ? THEME.text : THEME.textMuted }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: THEME.textMuted }}>{a.desc}</div>
                </div>
                {unlocked && <span style={{ color: THEME.success, fontSize: 18 }}>✓</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── SETTINGS/DATA SCREEN ────────────────────────────────────
  const SettingsScreen = () => {
    const fileInputRef = useRef(null);
    const [backups, setBackups] = useState([]);

    useEffect(() => {
      setBackups(getAvailableBackups());
    }, []);

    const handleExportJSON = () => {
      exportData(words, stats);
      showToast("✅ Data exported successfully!", "success");
    };

    const handleExportCSV = () => {
      exportToCSV(words);
      showToast("✅ CSV exported successfully!", "success");
    };

    const handleImportClick = () => {
      fileInputRef.current?.click();
    };

    const handleImportFile = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const data = await importData(file);
        setWords(data.words);
        if (data.stats) setStats(prev => ({ ...prev, ...data.stats }));

        // Save to Firestore if available
        if (firestoreService && userId && data.words?.length > 0) {
          showToast(`💾 Saving ${data.words.length} words to Firestore...`, "warning");
          await firestoreService.saveWords(data.words);
          showToast("✅ Data imported successfully!", "success");
        } else {
          showToast("✅ Data imported successfully!", "success");
        }
      } catch (error) {
        showToast(`❌ ${error.message}`, "danger");
      }
      e.target.value = "";
    };

    const handleRestoreBackup = async (backupKey) => {
      try {
        const data = restoreBackup(backupKey);
        setWords(data.words);
        setStats(prev => ({ ...prev, ...data.stats }));

        // Save to Firestore if available
        if (firestoreService && userId && data.words?.length > 0) {
          showToast(`💾 Saving ${data.words.length} words to Firestore...`, "warning");
          await firestoreService.saveWords(data.words);
          showToast("✅ Backup restored!", "success");
        } else {
          showToast("✅ Backup restored!", "success");
        }
      } catch (error) {
        showToast(`❌ ${error.message}`, "danger");
      }
    };

    const handleResetData = async () => {
      if (confirm("⚠️ Reset all data? This will delete EVERYTHING!")) {
        if (confirm("Are you absolutely sure? All progress will be lost FOREVER!")) {
          try {
            // Delete from Firestore if using Firebase
            if (firestoreService && userId) {
              showToast("🗑️ Deleting all data...", "warning");
              await firestoreService.deleteAllUserData();
            }

            // Clear localStorage
            localStorage.clear();

            // Reset state to empty
            setWords([]);
            setStats({
              streak: 0, lastStudyDate: null, totalReviews: 0, totalQuizzes: 0,
              perfectQuizzes: 0, nightStudy: false, speedReview: false,
              todayReviews: 0, todayDate: new Date().toDateString(), xp: 0, dailyGoal: 20,
            });

            showToast("✅ All data deleted! Start fresh.", "success");
          } catch (error) {
            console.error('Reset error:', error);
            showToast("❌ Error: " + error.message, "danger");
          }
        }
      }
    };

    return (
      <div style={{ padding: "20px 16px 100px", maxWidth: 480, margin: "0 auto", animation: "vmFadeIn 0.4s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <button className="vm-btn" onClick={() => setScreen("home")} style={{ background: "none", color: THEME.textSecondary, fontSize: 22, padding: 4 }}>←</button>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Settings & Data</div>
        </div>

        {/* User Profile (if signed in with Firebase) */}
        {userId && userEmail && (
          <div className="vm-card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              {userPhoto ? (
                <img src={userPhoto} alt="Profile" style={{
                  width: 56, height: 56, borderRadius: "50%",
                  border: `2px solid ${THEME.accent}40`
                }} />
              ) : (
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: THEME.gradient1,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24, fontWeight: 700, color: "#fff"
                }}>
                  {userEmail[0].toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                  {userEmail}
                </div>
                <div style={{ fontSize: 12, color: THEME.textSecondary }}>
                  ☁️ Synced with Firebase
                </div>
              </div>
            </div>

            {onSignOut && (
              <button className="vm-btn" onClick={onSignOut} style={{
                width: "100%", padding: 14, borderRadius: 12,
                background: `${THEME.danger}15`, color: THEME.danger, fontSize: 14,
                border: `1.5px solid ${THEME.danger}30`, fontWeight: 600
              }}>
                🚪 Sign Out
              </button>
            )}
          </div>
        )}

        {/* Import TOEIC Vocabulary */}
        {firestoreService && userId && (
          <div className="vm-card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              📚 <span>TOEIC Vocabulary</span>
            </div>
            <div style={{ fontSize: 13, color: THEME.textSecondary, marginBottom: 16 }}>
              Import 934 essential TOEIC words across 19 lessons into your collection
            </div>
            <button
              className="vm-btn"
              onClick={async () => {
                if (confirm(`Import ${getAllTOEICWords().length} TOEIC words to your collection?`)) {
                  try {
                    showToast("📚 Importing TOEIC vocabulary...", "warning");
                    const result = await firestoreService.importTOEICWords(getAllTOEICWords());
                    if (result.success) {
                      showToast(`✅ Imported ${result.imported} words! (${result.skipped} already existed)`, "success");
                    } else {
                      showToast("❌ Import failed: " + result.error.message, "danger");
                    }
                  } catch (error) {
                    showToast("❌ Error: " + error.message, "danger");
                  }
                }
              }}
              style={{
                width: "100%", padding: 14, borderRadius: 12,
                background: THEME.gradient1, color: "#fff", fontSize: 14,
                fontWeight: 600, boxShadow: `0 4px 16px ${THEME.accentGlow}`
              }}
            >
              📥 Import TOEIC Words
            </button>
          </div>
        )}

        {/* Daily Goal Settings */}
        <div className="vm-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            🎯 <span>Daily Goal</span>
          </div>
          <div style={{ fontSize: 13, color: THEME.textSecondary, marginBottom: 16 }}>
            Set how many words you want to review each day
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {[20, 50, 100].map(goal => (
              <button
                key={goal}
                className="vm-btn"
                onClick={() => setStats(prev => ({ ...prev, dailyGoal: goal }))}
                style={{
                  flex: 1, padding: 16, borderRadius: 12, fontSize: 14, fontWeight: 700,
                  background: stats.dailyGoal === goal ? THEME.gradient1 : `${THEME.accent}10`,
                  color: stats.dailyGoal === goal ? "#fff" : THEME.accent,
                  border: `2px solid ${stats.dailyGoal === goal ? "transparent" : THEME.accent + "30"}`,
                  boxShadow: stats.dailyGoal === goal ? `0 4px 16px ${THEME.accent}40` : "none",
                  transition: "all 0.2s ease"
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 4 }}>{goal}</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>words/day</div>
              </button>
            ))}
          </div>
        </div>

        {/* Data Management */}
        <div className="vm-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            💾 <span>Data Management</span>
          </div>

          <button className="vm-btn" onClick={handleExportJSON} style={{
            width: "100%", padding: 14, marginBottom: 10, borderRadius: 12,
            background: `${THEME.accent}15`, color: THEME.accent, fontSize: 14,
            border: `1.5px solid ${THEME.accent}30`, textAlign: "left", display: "flex",
            alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>📥</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>Export JSON</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>Backup all data (words + progress)</div>
            </div>
          </button>

          <button className="vm-btn" onClick={handleExportCSV} style={{
            width: "100%", padding: 14, marginBottom: 10, borderRadius: 12,
            background: `${THEME.success}15`, color: THEME.success, fontSize: 14,
            border: `1.5px solid ${THEME.success}30`, textAlign: "left", display: "flex",
            alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>📊</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>Export CSV</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>Export words for Excel/Sheets</div>
            </div>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            style={{ display: "none" }}
          />

          <button className="vm-btn" onClick={handleImportClick} style={{
            width: "100%", padding: 14, borderRadius: 12,
            background: `${THEME.info}15`, color: THEME.info, fontSize: 14,
            border: `1.5px solid ${THEME.info}30`, textAlign: "left", display: "flex",
            alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>📤</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>Import JSON</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>Restore from backup file</div>
            </div>
          </button>
        </div>

        {/* Backups */}
        {backups.length > 0 && (
          <div className="vm-card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              ⏰ <span>Auto Backups ({backups.length})</span>
            </div>

            {backups.slice(0, 3).map(backup => (
              <div key={backup.key} style={{
                padding: 12, marginBottom: 8, borderRadius: 10,
                background: THEME.surface, display: "flex", justifyContent: "space-between",
                alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: THEME.text }}>
                    {backup.date}
                  </div>
                  <div style={{ fontSize: 11, color: THEME.textMuted }}>
                    {backup.wordCount} words
                  </div>
                </div>
                <button className="vm-btn" onClick={() => handleRestoreBackup(backup.key)} style={{
                  padding: "6px 14px", borderRadius: 8, background: `${THEME.success}15`,
                  color: THEME.success, fontSize: 12,
                }}>
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Danger Zone */}
        <div className="vm-card" style={{ padding: 20, background: `${THEME.danger}08`, border: `1px solid ${THEME.danger}30` }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: THEME.danger }}>
            ⚠️ Danger Zone
          </div>
          <button className="vm-btn" onClick={handleResetData} style={{
            width: "100%", padding: 14, borderRadius: 12,
            background: `${THEME.danger}20`, color: THEME.danger, fontSize: 14,
            border: `1.5px solid ${THEME.danger}`,
          }}>
            🗑️ Reset All Data
          </button>
        </div>
      </div>
    );
  };

  // ── RENDER ──────────────────────────────────────────────────
  const screens = {
    home: HomeScreen,
    learn: LearnScreen,
    review: ReviewScreen,
    quiz: QuizScreen,
    words: WordsScreen,
    profile: ProfileScreen,
    settings: SettingsScreen,
  };
  const CurrentScreen = screens[screen] || HomeScreen;

  // Show loading screen while waiting for Firestore initial data
  if (!dataReady) {
    return (
      <div className="vm-app" style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: THEME.bg, color: THEME.text,
      }}>
        <div style={{ textAlign: "center", animation: "vmFadeIn 0.3s ease" }}>
          <div style={{ fontSize: 48, marginBottom: 16, animation: "vmPulse 1.5s ease infinite" }}>📚</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Loading your data...</div>
          <div style={{ fontSize: 13, color: THEME.textSecondary }}>Syncing from cloud</div>
        </div>
      </div>
    );
  }

  return (
    <div className="vm-app" style={{ position: "relative", minHeight: "100vh", paddingBottom: 80 }}>
      {/* Background ambience */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 0,
        background: `radial-gradient(ellipse at 20% 20%, ${THEME.accent}06 0%, transparent 60%),
                      radial-gradient(ellipse at 80% 80%, ${THEME.success}04 0%, transparent 60%)`,
      }} />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <CurrentScreen />
      </div>
      
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)",
          background: toast.type === "success" ? THEME.success : toast.type === "warning" ? THEME.warning : THEME.danger,
          color: "#fff", padding: "10px 24px", borderRadius: 12, fontWeight: 600, fontSize: 14,
          zIndex: 1000, animation: "vmSlideUp 0.3s ease",
          boxShadow: `0 8px 32px ${toast.type === "success" ? THEME.successGlow : THEME.dangerGlow}`,
        }}>
          {toast.msg}
        </div>
      )}
      
      {/* Bottom Navigation */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: "rgba(10,10,15,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderTop: `1px solid ${THEME.border}`,
        display: "flex", justifyContent: "center", padding: "8px 8px 12px",
        overflowX: "auto", overflowY: "hidden",
      }}>
        <div style={{ display: "flex", gap: 2, maxWidth: 480, width: "100%", justifyContent: "space-around", minWidth: "fit-content" }}>
          {[
            { id: "home", icon: "🏠", label: "Home" },
            { id: "learn", icon: "🧠", label: "Learn" },
            { id: "review", icon: "🔄", label: "Review" },
            { id: "quiz", icon: "❓", label: "Quiz" },
            { id: "words", icon: "📚", label: "Words" },
            { id: "profile", icon: "📊", label: "Stats" },
            { id: "settings", icon: "⚙️", label: "Settings" },
          ].map(nav => (
            <div key={nav.id} className={`vm-nav-item ${screen === nav.id ? "active" : ""}`} onClick={() => setScreen(nav.id)}>
              <span className="nav-icon">{nav.icon}</span>
              <span className="nav-label">{nav.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
