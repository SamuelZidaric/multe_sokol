import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// Helper: format ISO date (YYYY-MM-DD) to display format (DD/MM/YYYY)
const formatDate = (isoDate) => {
  const [yyyy, mm, dd] = isoDate.split('-');
  return `${dd}/${mm}/${yyyy}`;
};

const PODIUM_TITLES = [
  { emoji: '🥇', title: 'Kralj Mult' },
  { emoji: '🥈', title: 'Princ Mult' },
  { emoji: '🥉', title: 'Smrdljivc' },
];

export const BasketballTracker = () => {
  const [playersData, setPlayersData] = useState([]);
  const [multeTypesData, setMulteTypesData] = useState([]);
  const [finesInstances, setFinesInstances] = useState([]);
  const [currentPage, setCurrentPage] = useState('home');
  const [currentPlayerId, setCurrentPlayerId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('./players.json').then(res => {
        if (!res.ok) throw new Error(`Failed to load players.json (${res.status})`);
        return res.json();
      }),
      fetch('./multe-types.json').then(res => {
        if (!res.ok) throw new Error(`Failed to load multe-types.json (${res.status})`);
        return res.json();
      }),
      fetch('./fines-instances.json').then(res => {
        if (!res.ok) throw new Error(`Failed to load fines-instances.json (${res.status})`);
        return res.json();
      })
    ]).then(([players, types, fines]) => {
      setPlayersData(players);
      setMulteTypesData(types);
      setFinesInstances(fines);
      setIsLoading(false);
    }).catch(err => {
      console.error("Error loading data:", err);
      setError(err.message);
      setIsLoading(false);
    });
  }, []);

  const navigate = useCallback((page, playerId = null) => {
    if (page === 'player' && playerId) {
      window.location.hash = `#player/${playerId}`;
    } else if (page === 'all-fines') {
      window.location.hash = '#all-fines';
    } else if (page === 'minigame') {
      window.location.hash = '#minigame';
    } else {
      window.location.hash = '';
    }
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#player/')) {
        setCurrentPlayerId(parseInt(hash.replace('#player/', '')));
        setCurrentPage('player');
      } else if (hash === '#all-fines') {
        setCurrentPage('all-fines');
      } else if (hash === '#minigame') {
        setCurrentPage('minigame');
      } else {
        setCurrentPage('home');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const stats = useMemo(() => {
    if (!playersData.length || !multeTypesData.length) return [];

    return playersData.map(player => {
      const playerFines = finesInstances.filter(f => f.player_id === player.id);
      let totalEuro = 0, pending = 0, validated = 0, kasa = 0, merenda = 0;

      playerFines.forEach(f => {
        const type = multeTypesData.find(t => t.id === f.multa_id);
        if (!type) return;

        if (f.status === 'Pending') pending++; else validated++;

        if (typeof type.price === 'number') totalEuro += type.price;
        else if (type.price === 'KASA') kasa++;
        else if (type.price === 'MERENDA') merenda++;
      });

      return {
        player,
        totalCount: playerFines.length,
        pending, validated, totalEuro, kasa, merenda
      };
    }).sort((a, b) => b.totalCount - a.totalCount);
  }, [playersData, finesInstances, multeTypesData]);

  const mvpId = useMemo(() => {
    if (!stats.length) return null;
    const mvp = stats.reduce((best, s) => s.totalEuro > best.totalEuro ? s : best, stats[0]);
    return mvp.totalEuro > 0 ? mvp.player.id : null;
  }, [stats]);

  const maxCount = useMemo(() => {
    if (!stats.length) return 1;
    return Math.max(...stats.map(s => s.totalCount), 1);
  }, [stats]);

  const upcomingMulte = useMemo(() => {
    return finesInstances
      .filter(f => f.status === 'Pending')
      .map(f => ({
        ...f,
        player: playersData.find(p => p.id === f.player_id),
        type: multeTypesData.find(t => t.id === f.multa_id)
      }))
      .filter(f => f.player && f.type)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [finesInstances, playersData, multeTypesData]);

  // Group legend by price type
  const legendGroups = useMemo(() => {
    if (!multeTypesData.length) return [];
    const euro = multeTypesData.filter(t => typeof t.price === 'number').sort((a, b) => a.price - b.price);
    const kasa = multeTypesData.filter(t => t.price === 'KASA');
    const merenda = multeTypesData.filter(t => t.price === 'MERENDA');
    return [
      { label: 'Multe in Euro', icon: '💶', items: euro, type: 'euro' },
      { label: 'Kasa', icon: '🍺', items: kasa, type: 'kasa' },
      { label: 'Merenda', icon: '🍕', items: merenda, type: 'merenda' },
    ];
  }, [multeTypesData]);

  if (isLoading) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="app-logo">S</div>
          <h1 className="app-title">Multe Sokol</h1>
        </header>
        <div className="section" style={{ textAlign: 'center', padding: '60px 25px' }}>
          <div className="loading-spinner"></div>
          <p style={{ color: 'var(--team-text-grey)', marginTop: '15px' }}>Caricamento dati...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="app-logo">S</div>
          <h1 className="app-title">Multe Sokol</h1>
        </header>
        <div className="section" style={{ textAlign: 'center', padding: '40px 25px' }}>
          <p style={{ color: 'var(--team-red)', fontWeight: 700, fontSize: '1.1em' }}>
            Errore nel caricamento dei dati
          </p>
          <p style={{ color: 'var(--team-text-grey)' }}>{error}</p>
          <button className="btn" onClick={() => window.location.reload()} style={{ marginTop: '15px' }}>
            Riprova
          </button>
        </div>
      </div>
    );
  }

  if (currentPage === 'all-fines') {
    return <FinesListPage
      fines={finesInstances}
      players={playersData}
      types={multeTypesData}
      title="Tutte le Multe"
      navigate={navigate}
    />;
  }

  if (currentPage === 'player' && currentPlayerId) {
    return <FinesListPage
      fines={finesInstances.filter(f => f.player_id === currentPlayerId)}
      players={playersData}
      types={multeTypesData}
      title="Dettaglio Giocatore"
      isPlayerView={true}
      navigate={navigate}
    />;
  }

  if (currentPage === 'minigame') {
    return <FreeThrowGame navigate={navigate} />;
  }

  const podiumStats = stats.slice(0, 3);
  const gridStats = stats.slice(3);
  const mvpStat = mvpId ? stats.find(s => s.player.id === mvpId) : null;
  const totalPending = stats.reduce((acc, s) => acc + s.pending, 0);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-logo">S</div>
        <div>
          <h1 className="app-title">Multe Sokol</h1>
          <p className="app-subtitle">Sistema multe stagione 2024/25</p>
        </div>
      </header>

      {/* Upcoming Section */}
      {upcomingMulte.length > 0 && (
        <div className="upcoming-multe">
          <h3>
            <span className="section-icon">🔥</span>
            Da recuperare
          </h3>
          <div className="upcoming-multe-list">
            {upcomingMulte.map(f => {
              const fineDate = new Date(f.date);
              const today = new Date();
              const diffTime = today - fineDate;
              const daysPassed = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              const initials = (f.player.name[0] + f.player.surname[0]).toUpperCase();

              return (
                <div key={f.id} className="upcoming-multa-item">
                  <div className="player-avatar">{initials}</div>
                  <div className="upcoming-info">
                     <div className="upcoming-player">{f.player.name} {f.player.surname}</div>
                     <div className="upcoming-desc">{f.type.name}</div>
                  </div>
                  <div className="upcoming-badges-container">
                    <div className="days-overdue-badge">+{daysPassed} dni</div>
                    <div className="upcoming-date-badge">{formatDate(f.date)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Team Totals - Hero Card */}
      <div className="stats-total">
        <div className="stats-total-inner">
          <div className="stats-total-left">
            <h3>Totale Squadra</h3>
            <div className="stats-total-numbers">
              <div className="stat-pill">
                <span className="stat-pill-label">Multe</span>
                <span className="stat-pill-value">{finesInstances.length}</span>
              </div>
              <div className="stat-pill">
                <span className="stat-pill-label">Euro</span>
                <span className="stat-pill-value">{stats.reduce((acc, s) => acc + s.totalEuro, 0)}€</span>
              </div>
              {totalPending > 0 && (
                <div className="stat-pill stat-pill-pending">
                  <span className="stat-pill-label">In sospeso</span>
                  <span className="stat-pill-value">{totalPending}</span>
                </div>
              )}
            </div>
          </div>
          <div className="stats-total-right">
            {mvpStat && (
              <div className="sponsor-badge">
                <span className="sponsor-label">💰 Sponsor Ufficiale</span>
                <span className="sponsor-name">{mvpStat.player.name} {mvpStat.player.surname}</span>
                <span className="sponsor-amount">{mvpStat.totalEuro}€</span>
              </div>
            )}
            <button onClick={() => navigate('all-fines')} className="btn btn-ghost">
              Vedi tutte le multe →
            </button>
          </div>
        </div>
      </div>

      {/* Classifica Section */}
      <div className="section">
        <h2 className="section-title">
          <span className="section-icon">🏆</span>
          Classifica Multe
        </h2>

        {/* Hall of Shame Podium */}
        {podiumStats.length >= 3 && (
          <div className="podium">
            {[1, 0, 2].map(rank => {
              const stat = podiumStats[rank];
              const { emoji, title } = PODIUM_TITLES[rank];
              return (
                <div
                  key={stat.player.id}
                  className={`podium-slot podium-slot-${rank + 1}`}
                  onClick={() => navigate('player', stat.player.id)}
                >
                  <div className="podium-card">
                    <div className="podium-emoji">{emoji}</div>
                    <div className="podium-name">{stat.player.name} {stat.player.surname}</div>
                    <div className="podium-title">{title}</div>
                    <div className="podium-stats">
                      <span>{stat.totalCount} multe</span>
                      <span className="podium-stats-sep">·</span>
                      <span>{stat.totalEuro}€</span>
                    </div>
                    {stat.pending > 0 && (
                      <div className="podium-pending">⚠ {stat.pending} in sospeso</div>
                    )}
                  </div>
                  <div className="podium-pedestal">
                    <span className="podium-rank">{rank + 1}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Player Cards Grid */}
        <div className="stats-grid">
           {gridStats.map(stat => {
             const barWidth = maxCount > 0 ? (stat.totalCount / maxCount) * 100 : 0;
             const severity = stat.totalCount >= 12 ? 'high' : stat.totalCount >= 6 ? 'mid' : 'low';
             return (
               <div
                 key={stat.player.id}
                 className={`player-card severity-${severity} ${stat.player.id === mvpId ? 'player-card-mvp' : ''}`}
                 onClick={() => navigate('player', stat.player.id)}
               >
                 <div className="player-card-header">
                   <strong>{stat.player.name} {stat.player.surname}</strong>
                   {stat.player.id === mvpId && (
                     <span className="badge badge-mvp">Sponsor</span>
                   )}
                 </div>

                 <div className="player-card-stats">
                   <div className="player-stat-row">
                     <span className="player-stat-label">Multe</span>
                     <span className="player-stat-value">{stat.totalCount}</span>
                   </div>
                   <div className="player-stat-row">
                     <span className="player-stat-label">Euro</span>
                     <span className="player-stat-value">{stat.totalEuro}€</span>
                   </div>
                   {stat.kasa > 0 && (
                     <div className="player-stat-row">
                       <span className="player-stat-label">Kasa</span>
                       <span className="player-stat-value">{stat.kasa}</span>
                     </div>
                   )}
                   {stat.merenda > 0 && (
                     <div className="player-stat-row">
                       <span className="player-stat-label">Merenda</span>
                       <span className="player-stat-value">{stat.merenda}</span>
                     </div>
                   )}
                 </div>

                 <div className="player-card-bar">
                   <div className="player-card-bar-fill" style={{ width: `${barWidth}%` }}></div>
                 </div>

                 {stat.pending > 0 && (
                   <div className="player-card-pending">⚠ {stat.pending} in sospeso</div>
                 )}
               </div>
             );
           })}
        </div>

        {/* Minigame Button */}
        <div className="minigame-cta">
          <button className="btn btn-minigame" onClick={() => navigate('minigame')}>
            🏀 0/2 Liberi Simulator
          </button>
          <span className="minigame-cta-sub">Prova la tua mira!</span>
        </div>
      </div>

      {/* Legend Section */}
      <div className="section">
        <h2 className="section-title">
          <span className="section-icon">📋</span>
          Legenda Multe
        </h2>
        {legendGroups.map(group => (
          <div key={group.type} className="legend-group">
            <h4 className={`legend-group-title legend-group-${group.type}`}>
              {group.icon} {group.label}
            </h4>
            <div className="legend-grid">
              {group.items.map(type => (
                <div key={type.id} className="legend-item">
                  <span className="legend-name">{type.name}</span>
                  <div>
                    {typeof type.price === 'number' ? (
                      <span className="legend-price">{type.price}€</span>
                    ) : type.price === 'KASA' ? (
                      <span className="badge badge-kasa">KASA</span>
                    ) : (
                      <span className="badge badge-merenda">MERENDA</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="legend-notes">
          <div><strong>💡 Note:</strong></div>
          <div className="legend-note-row">
            <span className="badge badge-kasa">KASA</span>
            <span>= Kasa bjre</span>
          </div>
          <div className="legend-note-row">
            <span className="badge badge-merenda">MERENDA</span>
            <span>= Kasa + Jedača</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- REUSABLE COMPONENT: List Page ---
const FinesListPage = ({ fines, players, types, title, isPlayerView, navigate }) => {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

  const enrichedFines = useMemo(() => {
    return fines.map(f => ({
      ...f,
      player: players.find(p => p.id === f.player_id),
      type: types.find(t => t.id === f.multa_id)
    })).filter(f => f.player && f.type);
  }, [fines, players, types]);

  const filtered = enrichedFines.filter(f => {
    const textMatch = f.player.surname.toLowerCase().includes(search.toLowerCase()) ||
                      f.type.name.toLowerCase().includes(search.toLowerCase()) ||
                      (f.desc && f.desc.toLowerCase().includes(search.toLowerCase()));
    const statusMatch = filterStatus === "All" || f.status === filterStatus;
    return textMatch && statusMatch;
  });

  const renderPrice = (price) => {
    if (typeof price === 'number') return <strong style={{color: 'var(--team-blue-dark)'}}>{price}€</strong>;
    if (price === 'KASA') return <span className="badge badge-kasa">KASA</span>;
    if (price === 'MERENDA') return <span className="badge badge-merenda">MERENDA</span>;
    return price;
  };

  return (
    <div className="app-container">
      <div className="main-controls">
        <button className="back-button" onClick={() => navigate('home')}>← Indietro</button>
      </div>
      <h2 className="app-title" style={{fontSize: '1.8em'}}>{title}</h2>

      <div className="filters-container">
        <input
          type="text"
          className="search-input"
          placeholder="Cerca giocatore o multa..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="All">Tutti</option>
          <option value="Pending">In sospeso</option>
          <option value="Validated">Confermato</option>
        </select>
      </div>

      {/* Mobile card view */}
      <div className="fines-cards-mobile">
        {filtered.map((f) => (
          <div key={f.id} className={`fine-card-mobile ${f.status === 'Pending' ? 'fine-card-pending' : ''}`}>
            <div className="fine-card-top">
              {!isPlayerView && <strong>{f.player.surname} {f.player.name}</strong>}
              {isPlayerView && <strong>{f.type.name}</strong>}
            </div>
            {!isPlayerView && <div className="fine-card-type">{f.type.name}</div>}
            {f.desc && <div className="fine-card-desc">{f.desc}</div>}
            <div className="fine-card-bottom">
              <span className="fine-card-date">{formatDate(f.date)}</span>
              <div className="fine-card-meta">
                {renderPrice(f.type.price)}
                <span className={`badge badge-${f.status === 'Pending' ? 'kasa' : 'validated'}`}>{f.status === 'Pending' ? 'In sospeso' : 'Confermato'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table view */}
      <div className="table-container">
        <table className="multe-history-table">
          <thead>
            <tr>
              <th>Data</th>
              {!isPlayerView && <th>Giocatore</th>}
              <th>Multa</th>
              <th>Sanzione</th>
              <th>Descrizione</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.id} className={`multe-row ${f.status.toLowerCase()}`}>
                <td>{formatDate(f.date)}</td>
                {!isPlayerView && <td><strong>{f.player.surname}</strong> {f.player.name}</td>}
                <td>{f.type.name}</td>
                <td>{renderPrice(f.type.price)}</td>
                <td>{f.desc}</td>
                <td><span className={`badge badge-${f.status === 'Pending' ? 'kasa' : 'validated'}`}>{f.status === 'Pending' ? 'In sospeso' : 'Confermato'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon">🔍</span>
          <p>Nessuna multa trovata</p>
        </div>
      )}
    </div>
  );
};

// --- FREE THROW MINIGAME ---
const FreeThrowGame = ({ navigate }) => {
  const [phase, setPhase] = useState('ready');
  const [shots, setShots] = useState([]);
  const [cursorPos, setCursorPos] = useState(50);
  const animRef = useRef(null);
  const posRef = useRef(50);
  const dirRef = useRef(1);

  useEffect(() => {
    if (phase !== 'shooting') return;

    const speed = 1.8;
    const animate = () => {
      posRef.current += speed * dirRef.current;
      if (posRef.current >= 100) { posRef.current = 100; dirRef.current = -1; }
      if (posRef.current <= 0) { posRef.current = 0; dirRef.current = 1; }
      setCursorPos(posRef.current);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [phase]);

  const startGame = () => {
    setShots([]);
    posRef.current = 0;
    dirRef.current = 1;
    setCursorPos(0);
    setPhase('shooting');
  };

  const evaluateShot = (pos) => {
    const dist = Math.abs(pos - 50);
    if (dist <= 5) return 'swish';
    if (dist <= 25) return 'brick';
    return 'airball';
  };

  const shoot = () => {
    if (phase !== 'shooting') return;

    const result = evaluateShot(cursorPos);
    const newShots = [...shots, { pos: cursorPos, result }];
    setShots(newShots);

    if (newShots.length >= 2) {
      cancelAnimationFrame(animRef.current);
      setPhase('result');
    } else {
      posRef.current = 0;
      dirRef.current = 1;
      setCursorPos(0);
    }
  };

  const getMadeCount = () => shots.filter(s => s.result === 'swish').length;
  const hasAirball = () => shots.some(s => s.result === 'airball');

  const getResultMessage = () => {
    const made = getMadeCount();
    if (hasAirball()) return { text: 'AIRBALL LIBERI! 🫠', sub: 'Multa: 2€ — Complimenti, fenomeno.', className: 'result-airball' };
    if (made === 2) return { text: 'PERFETTO! 2/2 🎯', sub: 'Bravo, nessuna multa per te!', className: 'result-perfect' };
    if (made === 1) return { text: '1/2 — Salvo per miracolo 😮‍💨', sub: 'Ce l\'hai fatta... per poco.', className: 'result-saved' };
    return { text: '0/2 LIBERI! 💸', sub: 'Multa: 2€ — Paghi tu la prossima birra.', className: 'result-fail' };
  };

  return (
    <div className="app-container">
      <div className="main-controls">
        <button className="back-button" onClick={() => navigate('home')}>← Indietro</button>
      </div>

      <div className="minigame-page">
        <div className="minigame-court">
          <div className="court-circle"></div>
          <div className="court-line"></div>
          <div className="court-ft-line"></div>
        </div>

        <h2 className="minigame-title">0/2 Liberi Simulator</h2>
        <p className="minigame-subtitle">La simulazione definitiva del tiro libero</p>

        <div className="section minigame-container">
          {phase === 'ready' && shots.length === 0 && (
            <div className="minigame-intro">
              <div className="minigame-intro-icon">🏀</div>
              <p>Hai <strong>2 tiri liberi</strong>. Ferma il cursore nella zona verde per segnare!</p>
              <div className="minigame-rules">
                <div className="minigame-rule">
                  <span className="rule-dot rule-dot-green"></span>
                  <span>Swish = Canestro</span>
                </div>
                <div className="minigame-rule">
                  <span className="rule-dot rule-dot-yellow"></span>
                  <span>Brick = Ferro</span>
                </div>
                <div className="minigame-rule">
                  <span className="rule-dot rule-dot-red"></span>
                  <span>Airball = Multa 2€</span>
                </div>
              </div>
              <button className="btn btn-shoot" onClick={startGame}>Tira!</button>
            </div>
          )}

          {(phase === 'shooting' || (phase === 'ready' && shots.length > 0)) && (
            <div className="minigame-play">
              <div className="shot-label">Tiro {shots.length + 1} di 2</div>

              <div className="shot-bar-container">
                <div className="shot-bar">
                  <div className="shot-zone zone-red-left"></div>
                  <div className="shot-zone zone-yellow-left"></div>
                  <div className="shot-zone zone-green"></div>
                  <div className="shot-zone zone-yellow-right"></div>
                  <div className="shot-zone zone-red-right"></div>
                  {phase === 'shooting' && (
                    <div className="shot-cursor" style={{ left: `${cursorPos}%` }}></div>
                  )}
                  {shots.map((s, i) => (
                    <div
                      key={i}
                      className={`shot-marker shot-marker-${s.result}`}
                      style={{ left: `${s.pos}%` }}
                    >
                      {s.result === 'swish' ? '✓' : '✗'}
                    </div>
                  ))}
                </div>
                <div className="shot-bar-labels">
                  <span>Airball</span>
                  <span>Brick</span>
                  <span>Swish</span>
                  <span>Brick</span>
                  <span>Airball</span>
                </div>
              </div>

              {phase === 'shooting' && (
                <button className="btn btn-shoot" onClick={shoot}>Tira!</button>
              )}
            </div>
          )}

          {phase === 'result' && (
            <div className={`minigame-result ${getResultMessage().className}`}>
              <div className="result-text">{getResultMessage().text}</div>
              <div className="result-sub">{getResultMessage().sub}</div>

              <div className="result-recap">
                {shots.map((s, i) => (
                  <div key={i} className={`recap-shot recap-${s.result}`}>
                    Tiro {i + 1}: {s.result === 'swish' ? 'Canestro!' : s.result === 'airball' ? 'Airball!' : 'Ferro!'}
                  </div>
                ))}
              </div>

              <div className="result-buttons">
                <button className="btn btn-shoot" onClick={startGame}>Rigioca</button>
                <button className="btn" onClick={() => navigate('home')}>Home</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
