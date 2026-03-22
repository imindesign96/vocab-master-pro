/**
 * Anki SM-2 Spaced Repetition Engine — Full Anki-accurate implementation
 * Includes: learning steps, relearning, fuzzing, ease factor, per-day limits
 */

export const CARD_STATE = {
  NEW: 'new',
  LEARNING: 'learning',
  REVIEW: 'review',
  RELEARNING: 'relearning',
};

export const QUALITY = {
  AGAIN: 0,
  HARD: 1,
  GOOD: 3,
  EASY: 5,
};

// Anki defaults
const LEARN_STEPS_MIN = [1, 10];
const RELEARN_STEPS_MIN = [10];
const GRADUATING_INTERVAL = 1;
const EASY_INTERVAL = 4;
const STARTING_EASE = 2.5;
const MIN_EASE = 1.3;
const MAX_EASE = 3.5;
const EASY_BONUS = 1.3;
const HARD_INTERVAL_MULT = 1.2;
export const DEFAULT_NEW_PER_DAY = 20;
const REVIEW_CARDS_PER_DAY = 500;

export const createCard = (overrides = {}) => ({
  state: CARD_STATE.NEW,
  easeFactor: STARTING_EASE,
  interval: 0,
  step: 0,           // which learning step we're on
  repetitions: 0,
  lapses: 0,
  due: null,
  lastReview: null,
  totalReviews: 0,
  correctReviews: 0,
  ...overrides,
});

/**
 * Process a review and return updated card — exact Anki SM-2
 */
export function processReview(card, quality) {
  const now = new Date();
  const c = {
    ...card,
    lastReview: now.toISOString(),
    totalReviews: (card.totalReviews || 0) + 1,
  };

  if (quality >= QUALITY.GOOD) {
    c.correctReviews = (card.correctReviews || 0) + 1;
  }

  const state = card.state || CARD_STATE.NEW;
  const step = card.step || 0;
  const ease = card.easeFactor || STARTING_EASE;

  if (state === CARD_STATE.NEW || state === CARD_STATE.LEARNING) {
    // ── Learning phase ──────────────────────────────
    if (quality === QUALITY.AGAIN) {
      c.state = CARD_STATE.LEARNING;
      c.step = 0;
      c.due = addMinutes(now, LEARN_STEPS_MIN[0]).toISOString();
    } else if (quality === QUALITY.HARD) {
      // Repeat current step (slightly longer)
      c.state = CARD_STATE.LEARNING;
      c.step = step;
      const delay = step === 0
        ? LEARN_STEPS_MIN[0]
        : Math.round((LEARN_STEPS_MIN[step - 1] + LEARN_STEPS_MIN[step]) / 2);
      c.due = addMinutes(now, delay).toISOString();
    } else if (quality === QUALITY.GOOD) {
      const nextStep = step + 1;
      if (nextStep >= LEARN_STEPS_MIN.length) {
        // Graduate to review
        c.state = CARD_STATE.REVIEW;
        c.step = 0;
        c.interval = GRADUATING_INTERVAL;
        c.repetitions = 1;
        c.due = addDays(now, GRADUATING_INTERVAL).toISOString();
      } else {
        c.state = CARD_STATE.LEARNING;
        c.step = nextStep;
        c.due = addMinutes(now, LEARN_STEPS_MIN[nextStep]).toISOString();
      }
    } else {
      // EASY — graduate immediately
      c.state = CARD_STATE.REVIEW;
      c.step = 0;
      c.interval = EASY_INTERVAL;
      c.repetitions = 1;
      c.easeFactor = Math.min(MAX_EASE, ease + 0.15);
      c.due = addDays(now, EASY_INTERVAL).toISOString();
    }

  } else if (state === CARD_STATE.RELEARNING) {
    // ── Relearning after lapse ──────────────────────
    if (quality === QUALITY.AGAIN) {
      c.step = 0;
      c.due = addMinutes(now, RELEARN_STEPS_MIN[0]).toISOString();
    } else {
      const nextStep = step + 1;
      if (nextStep >= RELEARN_STEPS_MIN.length) {
        // Graduate back to review with reduced interval
        c.state = CARD_STATE.REVIEW;
        c.step = 0;
        const newInterval = fuzz(Math.max(1, Math.ceil(card.interval * 0.5)));
        c.interval = newInterval;
        c.due = addDays(now, newInterval).toISOString();
      } else {
        c.step = nextStep;
        c.due = addMinutes(now, RELEARN_STEPS_MIN[nextStep]).toISOString();
      }
    }

  } else {
    // ── Review phase ────────────────────────────────
    if (quality === QUALITY.AGAIN) {
      c.state = CARD_STATE.RELEARNING;
      c.step = 0;
      c.lapses = (card.lapses || 0) + 1;
      c.easeFactor = Math.max(MIN_EASE, ease - 0.20);
      c.interval = Math.max(1, Math.ceil(card.interval * 0.5));
      c.repetitions = 0;
      c.due = addMinutes(now, RELEARN_STEPS_MIN[0]).toISOString();
    } else {
      let newInterval;

      if (card.repetitions <= 1) {
        // First review after graduating
        newInterval = card.interval === 1 ? 4 : Math.ceil(card.interval * ease);
      } else {
        newInterval = Math.ceil(card.interval * ease);
      }

      if (quality === QUALITY.HARD) {
        newInterval = Math.ceil(card.interval * HARD_INTERVAL_MULT);
        c.easeFactor = Math.max(MIN_EASE, ease - 0.15);
      } else if (quality === QUALITY.GOOD) {
        // ease unchanged
      } else {
        // EASY
        newInterval = Math.ceil(newInterval * EASY_BONUS);
        c.easeFactor = Math.min(MAX_EASE, ease + 0.15);
      }

      // Never shorter than current + 1
      newInterval = Math.max(card.interval + 1, newInterval);
      c.interval = fuzz(newInterval);
      c.repetitions = (card.repetitions || 0) + 1;
      c.state = CARD_STATE.REVIEW;
      c.due = addDays(now, c.interval).toISOString();
    }
  }

  return c;
}

/** True if this card should appear in today's study session */
export function isDue(card) {
  if (card.state === CARD_STATE.NEW) return true;
  if (!card.due) return true;
  return new Date(card.due) <= new Date();
}

/** Get next interval preview string for answer buttons — mirrors processReview exactly */
export function getIntervalPreview(card, quality) {
  const state = card.state || CARD_STATE.NEW;
  const ease  = card.easeFactor || STARTING_EASE;
  const interval = card.interval || 0;
  const step  = card.step || 0;

  if (state === CARD_STATE.NEW || state === CARD_STATE.LEARNING) {
    if (quality === QUALITY.AGAIN) return `<${LEARN_STEPS_MIN[0]}m`;
    if (quality === QUALITY.HARD) {
      // Same logic as processReview: repeat current step (avg of prev+cur for step>0)
      const delay = step === 0
        ? LEARN_STEPS_MIN[0]
        : Math.round((LEARN_STEPS_MIN[step - 1] + LEARN_STEPS_MIN[step]) / 2);
      return `<${delay}m`;
    }
    if (quality === QUALITY.GOOD) {
      const next = step + 1;
      if (next >= LEARN_STEPS_MIN.length) return `${GRADUATING_INTERVAL}d`; // graduate
      return `<${LEARN_STEPS_MIN[next]}m`;
    }
    // EASY — graduate immediately
    return `${EASY_INTERVAL}d`;
  }

  if (state === CARD_STATE.RELEARNING) {
    if (quality === QUALITY.AGAIN) return `<${RELEARN_STEPS_MIN[0]}m`;
    const next = step + 1;
    if (next >= RELEARN_STEPS_MIN.length) return `${Math.max(1, Math.ceil(interval * 0.5))}d`;
    return `<${RELEARN_STEPS_MIN[next]}m`;
  }

  // ── Review phase ─────────────────────────────────────
  if (quality === QUALITY.AGAIN) return `<${RELEARN_STEPS_MIN[0]}m`;

  let newInterval;
  if (card.repetitions <= 1) {
    newInterval = interval === 1 ? 4 : Math.ceil(interval * ease);
  } else {
    newInterval = Math.ceil(interval * ease);
  }

  if (quality === QUALITY.HARD) {
    newInterval = Math.ceil(interval * HARD_INTERVAL_MULT);
  } else if (quality === QUALITY.EASY) {
    newInterval = Math.ceil(newInterval * EASY_BONUS);
  }

  newInterval = Math.max(interval + 1, newInterval);
  return `${newInterval}d`;
}

/**
 * Filter due cards respecting daily limits.
 * New cards are ordered: by topic name (alphabetical) then by importOrder
 * so the user studies Contract → Marketing → Warranties → ...
 */
export function getDailyQueue(allCards, newPerDay = DEFAULT_NEW_PER_DAY) {
  // Learning/Relearning — always show these first (time-sensitive)
  const learningCards = allCards.filter(
    c => (c.state === CARD_STATE.LEARNING || c.state === CARD_STATE.RELEARNING) && isDue(c)
  );

  // Review cards due today
  const reviewCards = allCards
    .filter(c => c.state === CARD_STATE.REVIEW && isDue(c))
    .slice(0, REVIEW_CARDS_PER_DAY);

  // New cards — sorted by topic (01. Contract first) then importOrder
  const newCards = allCards
    .filter(c => c.state === CARD_STATE.NEW)
    .sort((a, b) => {
      const topicA = a.topic || '';
      const topicB = b.topic || '';
      if (topicA !== topicB) return topicA.localeCompare(topicB);
      return (a.importOrder ?? 0) - (b.importOrder ?? 0);
    })
    .slice(0, newPerDay);

  return [...learningCards, ...reviewCards, ...newCards];
}

export function getRetention(cards) {
  const total = cards.reduce((s, c) => s + (c.totalReviews || 0), 0);
  const correct = cards.reduce((s, c) => s + (c.correctReviews || 0), 0);
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

// ── Helpers ───────────────────────────────────────────

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

/** Anki-style fuzzing: ±5% to prevent card bunching */
function fuzz(interval) {
  if (interval < 3) return interval;
  const range = Math.max(1, Math.round(interval * 0.05));
  return interval + Math.floor(Math.random() * (range * 2 + 1)) - range;
}
