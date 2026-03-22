import { QUALITY, getIntervalPreview } from '../utils/srsEngine';

const BUTTONS = [
  { quality: QUALITY.AGAIN, label: 'Again', color: '#ef4444' },
  { quality: QUALITY.HARD,  label: 'Hard',  color: '#f97316' },
  { quality: QUALITY.GOOD,  label: 'Good',  color: '#22c55e' },
  { quality: QUALITY.EASY,  label: 'Easy',  color: '#3b82f6' },
];

export default function AnswerButtons({ onAnswer, card }) {
  return (
    <div className="answer-buttons">
      {BUTTONS.map(({ quality, label, color }) => (
        <button
          key={quality}
          className="answer-btn"
          style={{ '--btn-color': color }}
          onClick={() => onAnswer(quality)}
        >
          <span className="btn-interval">{getIntervalPreview(card, quality)}</span>
          <span className="btn-label">{label}</span>
        </button>
      ))}
    </div>
  );
}
