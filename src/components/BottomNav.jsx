const NAV_ITEMS = [
  { id: 'today', label: 'Today', icon: '📚' },
  { id: 'decks', label: 'Decks', icon: '🗂️' },
  { id: 'add', label: 'Add', icon: '➕' },
  { id: 'stats', label: 'Stats', icon: '📊' },
];

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          className={`nav-item ${active === item.id ? 'active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
