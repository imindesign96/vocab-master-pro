import { useMemo } from 'react';
import { CARD_STATE } from '../utils/srsEngine';

export default function StatsScreen({ cards }) {
  const stats = useMemo(() => {
    const total = cards.length;
    const byState = {
      [CARD_STATE.NEW]: 0,
      [CARD_STATE.LEARNING]: 0,
      [CARD_STATE.REVIEW]: 0,
      [CARD_STATE.RELEARNING]: 0,
    };
    let totalReviews = 0, correctReviews = 0;

    cards.forEach(c => {
      byState[c.state] = (byState[c.state] || 0) + 1;
      totalReviews += c.totalReviews || 0;
      correctReviews += c.correctReviews || 0;
    });

    const retention = totalReviews > 0 ? Math.round((correctReviews / totalReviews) * 100) : 0;
    const mature = cards.filter(c => c.interval >= 21).length;

    // Forecast: how many due in next 7 days
    const forecast = [];
    const now = new Date();
    for (let d = 0; d < 7; d++) {
      const day = new Date(now);
      day.setDate(day.getDate() + d);
      const dayStr = day.toISOString().split('T')[0];
      const count = cards.filter(c => c.due && c.due.split('T')[0] === dayStr).length;
      forecast.push({ label: d === 0 ? 'Today' : day.toLocaleDateString('en', { weekday: 'short' }), count });
    }

    return { total, byState, retention, mature, totalReviews, forecast };
  }, [cards]);

  const maxForecast = Math.max(...stats.forecast.map(f => f.count), 1);

  return (
    <div className="screen stats-screen">
      <header className="screen-header">
        <h2>Stats</h2>
      </header>

      {/* Retention */}
      <div className="stat-card retention-card">
        <div className="retention-ring">
          <svg viewBox="0 0 36 36" className="ring-svg">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.9" fill="none"
              stroke="#6366f1" strokeWidth="3"
              strokeDasharray={`${stats.retention} ${100 - stats.retention}`}
              strokeDashoffset="25"
              strokeLinecap="round"
            />
          </svg>
          <div className="ring-label">
            <span className="ring-num">{stats.retention}%</span>
            <span className="ring-sub">retention</span>
          </div>
        </div>
        <div className="retention-details">
          <p>{stats.totalReviews} total reviews</p>
          <p>{stats.mature} mature cards (21+ days)</p>
        </div>
      </div>

      {/* Card state breakdown */}
      <div className="section">
        <h3 className="section-title">Card States</h3>
        <div className="state-bars">
          {[
            { key: CARD_STATE.NEW, label: 'New', color: '#64748b' },
            { key: CARD_STATE.LEARNING, label: 'Learning', color: '#f97316' },
            { key: CARD_STATE.REVIEW, label: 'Review', color: '#6366f1' },
            { key: CARD_STATE.RELEARNING, label: 'Relearning', color: '#ef4444' },
          ].map(({ key, label, color }) => {
            const count = stats.byState[key] || 0;
            const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
            return (
              <div key={key} className="state-row">
                <span className="state-label">{label}</span>
                <div className="state-bar-wrap">
                  <div className="state-bar-bg">
                    <div className="state-bar-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
                <span className="state-count">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 7-day forecast */}
      <div className="section">
        <h3 className="section-title">7-Day Forecast</h3>
        <div className="forecast-chart">
          {stats.forecast.map(({ label, count }) => (
            <div key={label} className="forecast-col">
              <div className="forecast-bar-wrap">
                <div
                  className="forecast-bar"
                  style={{ height: `${(count / maxForecast) * 80}px` }}
                />
              </div>
              <span className="forecast-count">{count}</span>
              <span className="forecast-label">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
