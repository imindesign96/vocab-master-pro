import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firestore functions
const mockSetDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockDeleteDoc = vi.fn();
const mockOnSnapshot = vi.fn();

vi.mock('firebase/firestore', () => ({
  setDoc: (...args) => mockSetDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  onSnapshot: (...args) => mockOnSnapshot(...args),
  collection: vi.fn((db, ...path) => ({ _path: path })),
  doc: vi.fn((db, ...path) => ({ _path: path })),
  query: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: () => Date.now(),
}));

describe('Firestore Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveWord', () => {
    it('should save word to Firestore', async () => {
      mockSetDoc.mockResolvedValue();

      // Import after mocks are set up
      const { saveWord } = await import('../firebase/firestoreService');

      const word = {
        id: 'word1',
        term: 'ubiquitous',
        definition: 'present everywhere',
        srs: {},
      };

      const result = await saveWord('user123', word);

      expect(result.success).toBe(true);
      expect(mockSetDoc).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockSetDoc.mockRejectedValue(new Error('Network error'));

      const { saveWord } = await import('../firebase/firestoreService');

      const word = { id: 'word1', term: 'test' };
      const result = await saveWord('user123', word);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getWords', () => {
    it('should fetch words from Firestore', async () => {
      const mockDocs = [
        { id: 'word1', data: () => ({ term: 'test1' }) },
        { id: 'word2', data: () => ({ term: 'test2' }) },
      ];

      mockGetDocs.mockResolvedValue({ docs: mockDocs });

      const { getWords } = await import('../firebase/firestoreService');
      const result = await getWords('user123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].term).toBe('test1');
    });
  });

  describe('deleteWord', () => {
    it('should delete word from Firestore', async () => {
      mockDeleteDoc.mockResolvedValue();

      const { deleteWord } = await import('../firebase/firestoreService');
      const result = await deleteWord('user123', 'word1');

      expect(result.success).toBe(true);
      expect(mockDeleteDoc).toHaveBeenCalled();
    });
  });

  describe('subscribeToWords', () => {
    it('should setup realtime listener', async () => {
      const callback = vi.fn();
      const unsubscribe = vi.fn();

      mockOnSnapshot.mockReturnValue(unsubscribe);

      const { subscribeToWords } = await import('../firebase/firestoreService');
      const unsub = subscribeToWords('user123', callback);

      expect(mockOnSnapshot).toHaveBeenCalled();
      expect(typeof unsub).toBe('function');
    });
  });
});
