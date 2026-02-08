import { describe, it, expect } from 'vitest';

// Mock SRS Engine matching the actual implementation
const SRSEngine = {
  INTERVALS: [1, 3, 7, 14, 30, 60],

  processReview(word, quality) {
    let { easeFactor = 2.5, interval = 0, repetitions = 0 } = word.srs || {};

    if (quality >= 3) {
      // Correct answer - advance to next interval
      if (repetitions < SRSEngine.INTERVALS.length) {
        interval = SRSEngine.INTERVALS[repetitions];
      } else {
        // After all intervals, word is mastered
        interval = 60;
      }
      repetitions++;
    } else {
      // Wrong answer - reset to beginning
      repetitions = 0;
      interval = 1;
    }

    easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

    const mastered = repetitions >= SRSEngine.INTERVALS.length;

    return {
      ...word.srs,
      easeFactor,
      interval,
      repetitions,
      totalReviews: (word.srs?.totalReviews || 0) + 1,
      mastered,
    };
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

  isDueForReview(word) {
    // Mastered words don't need review
    if (word.srs?.mastered) return false;
    if (!word.srs?.nextReview) return true;
    return new Date(word.srs.nextReview) <= new Date();
  },
};

describe('SRS Engine', () => {
  describe('processReview', () => {
    it('should increase interval for correct answers', () => {
      const word = { id: '1', term: 'test', srs: { easeFactor: 2.5, interval: 0, repetitions: 0 } };
      const result = SRSEngine.processReview(word, 4); // quality = 4 (good)

      expect(result.interval).toBe(1); // First review
      expect(result.repetitions).toBe(1);
      expect(result.totalReviews).toBe(1);
    });

    it('should reset progress for incorrect answers', () => {
      const word = { id: '1', term: 'test', srs: { easeFactor: 2.5, interval: 6, repetitions: 2 } };
      const result = SRSEngine.processReview(word, 0); // quality = 0 (again)

      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(0);
    });

    it('should follow optimized intervals (1→3→7→14→30→60)', () => {
      let word = { id: '1', term: 'test', srs: { easeFactor: 2.5, interval: 0, repetitions: 0 } };

      // First review: 1 day
      word.srs = SRSEngine.processReview(word, 4);
      expect(word.srs.interval).toBe(1);
      expect(word.srs.repetitions).toBe(1);

      // Second review: 3 days
      word.srs = SRSEngine.processReview(word, 4);
      expect(word.srs.interval).toBe(3);
      expect(word.srs.repetitions).toBe(2);

      // Third review: 7 days
      word.srs = SRSEngine.processReview(word, 4);
      expect(word.srs.interval).toBe(7);
      expect(word.srs.repetitions).toBe(3);

      // Fourth review: 14 days
      word.srs = SRSEngine.processReview(word, 4);
      expect(word.srs.interval).toBe(14);

      // Fifth review: 30 days
      word.srs = SRSEngine.processReview(word, 4);
      expect(word.srs.interval).toBe(30);

      // Sixth review: 60 days (mastered)
      word.srs = SRSEngine.processReview(word, 4);
      expect(word.srs.interval).toBe(60);
      expect(word.srs.mastered).toBe(true);

      // After mastery: stays at 60 days
      word.srs = SRSEngine.processReview(word, 4);
      expect(word.srs.interval).toBe(60);
    });
  });

  describe('qualityFromRating', () => {
    it('should convert rating to quality score', () => {
      expect(SRSEngine.qualityFromRating('again')).toBe(1);
      expect(SRSEngine.qualityFromRating('hard')).toBe(3);
      expect(SRSEngine.qualityFromRating('good')).toBe(4);
      expect(SRSEngine.qualityFromRating('easy')).toBe(5);
    });
  });

  describe('isDueForReview', () => {
    it('should return true for words without nextReview', () => {
      const word = { id: '1', term: 'test', srs: {} };
      expect(SRSEngine.isDueForReview(word)).toBe(true);
    });

    it('should return true for words with past nextReview date', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const word = { id: '1', term: 'test', srs: { nextReview: yesterday.toISOString() } };
      expect(SRSEngine.isDueForReview(word)).toBe(true);
    });

    it('should return false for words with future nextReview date', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const word = { id: '1', term: 'test', srs: { nextReview: tomorrow.toISOString() } };
      expect(SRSEngine.isDueForReview(word)).toBe(false);
    });

    it('should return false for mastered words', () => {
      const word = { id: '1', term: 'test', srs: { mastered: true, nextReview: new Date().toISOString() } };
      expect(SRSEngine.isDueForReview(word)).toBe(false);
    });
  });

  describe('Mastery System', () => {
    it('should mark word as mastered after 6 successful reviews', () => {
      let word = { id: '1', term: 'test', srs: {} };

      // Go through all 6 intervals
      for (let i = 0; i < 6; i++) {
        word.srs = SRSEngine.processReview(word, 4);
      }

      expect(word.srs.mastered).toBe(true);
      expect(word.srs.repetitions).toBe(6);
    });

    it('should reset mastery progress on wrong answer', () => {
      let word = { id: '1', term: 'test', srs: { repetitions: 5, interval: 30 } };

      // Wrong answer resets everything
      word.srs = SRSEngine.processReview(word, 0);

      expect(word.srs.repetitions).toBe(0);
      expect(word.srs.interval).toBe(1);
      expect(word.srs.mastered).toBe(false);
    });
  });
});
