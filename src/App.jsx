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

  // 1. Centralized Data Fetching with loading & error states
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

  // 2. State-driven navigation function
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

  // 3. Hash-based routing (handles browser back/forward and initial load)
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
    handleHashChange(); // Init
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 4. Global Stats Calculation
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

  // 4b. MVP — player with highest euro total
  const mvpId = useMemo(() => {
    if (!stats.length) return null;
    const mvp = stats.reduce((best, s) => s.totalEuro > best.totalEuro ? s : best, stats[0]);
    return mvp.totalEuro > 0 ? mvp.player.id : null;
  }, [stats]);

  // 5. Upcoming Multe Logic (ISO dates sort natively)
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

  // --- LOADING & ERROR STATES ---

  if (isLoading) {
    return (
      <div className="app-container">
        <h1 className="app-title">Multe Sokol 🏀</h1>
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
        <h1 className="app-title">Multe Sokol 🏀</h1>
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

  // --- RENDER HELPERS ---

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

  // Split stats: top 3 for podium, rest for grid
  const podiumStats = stats.slice(0, 3);
  const gridStats = stats.slice(3);

  // Find MVP stat for display in totals
  const mvpStat = mvpId ? stats.find(s => s.player.id === mvpId) : null;

  return (
    <div className="app-container">
      <h1 className="app-title">Multe Sokol 🏀</h1>

      {/* Upcoming Section */}
      {upcomingMulte.length > 0 && (
        <div className="upcoming-multe">
          <h3>Najstarejši recupero</h3>
          <div className="upcoming-multe-list">
            {upcomingMulte.map(f => {
              const fineDate = new Date(f.date);
              const today = new Date();
              const diffTime = today - fineDate;
              const daysPassed = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

              const initials = (f.player.name[0] + f.player.surname[0]).toUpperCase();

              return (
                <div key={f.id} className="upcoming-multa-item">
                  <div className="player-avatar">
                    {initials}
                  </div>

                  <div className="upcoming-info">
                     <div className="upcoming-player">{f.player.name} {f.player.surname}</div>
                     <div className="upcoming-desc">{f.type.name}</div>
                  </div>

                  <div className="upcoming-badges-container">
                    <div className="days-overdue-badge">
                      +{daysPassed} dni
                    </div>
                    <div className="upcoming-date-badge">
                      {formatDate(f.date)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="section">
        <h2 className="section-title section-title-purple">Classifica Multe</h2>

        {/* Hall of Shame Podium */}
        {podiumStats.length >= 3 && (
          <div className="podium">
            {/* Render in order: 2nd | 1st | 3rd */}
            {[1, 0, 2].map(rank => {
              const stat = podiumStats[rank];
              const { emoji, title } = PODIUM_TITLES[rank];
              return (
                <div
                  key={stat.player.id}
                  className={`podium-card podium-rank-${rank + 1}`}
                  onClick={() => navigate('player', stat.player.id)}
                >
                  <div className="podium-emoji">{emoji}</div>
                  <div className="podium-name">{stat.player.name} {stat.player.surname}</div>
                  <div className="podium-title">{title}</div>
                  <div className="podium-stats">
                    <span>{stat.totalCount} multe</span>
                    <span>{stat.totalEuro}€</span>
                  </div>
                  {stat.pending > 0 && (
                    <div className="podium-pending">⚠️ {stat.pending} Pending</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="stats-grid">
           {/* Total Summary Block */}
           <div className="stats-total">
             <h3>Totale Squadra</h3>
             <div className="stats-total-grid">
               <div><strong>Multe:</strong> {finesInstances.length}</div>
               <div><strong>Euro:</strong> {stats.reduce((acc, s) => acc + s.totalEuro, 0)}€</div>
               {mvpStat && (
                 <div className="stats-total-mvp">
                   <strong>💰 Sponsor:</strong> {mvpStat.player.name} {mvpStat.player.surname} ({mvpStat.totalEuro}€)
                 </div>
               )}
               <button onClick={() => navigate('all-fines')} className="btn" style={{marginTop: 5, width: '100%'}}>Vedi Tutte</button>
             </div>
           </div>

           {/* Player Cards */}
           {gridStats.map(stat => (
             <div
               key={stat.player.id}
               className={`player-card ${stat.player.id === mvpId ? 'player-card-mvp' : ''}`}
               onClick={() => navigate('player', stat.player.id)}
             >
               <div style={{display:'flex', justifyContent:'space-between', alignItems: 'center'}}>
                 <strong>{stat.player.name} {stat.player.surname}</strong>
                 {stat.player.id === mvpId ? (
                   <span className="badge badge-mvp">Sponsor Ufficiale</span>
                 ) : (
                   <span style={{fontSize: '1.5em'}}>🏀</span>
                 )}
               </div>
               <hr style={{borderColor: 'var(--team-grey-light)'}}/>
               <div>Total: <strong>{stat.totalCount}</strong></div>
               <div>Euro: <strong>{stat.totalEuro}€</strong></div>
               {stat.kasa > 0 && <div>Kasa: {stat.kasa}</div>}
               {stat.merenda > 0 && <div>Merenda: {stat.merenda}</div>}
               {stat.pending > 0 && <div style={{color: 'var(--team-red)', fontWeight:'bold'}}>⚠️ {stat.pending} Pending</div>}
             </div>
           ))}
        </div>

        {/* Minigame Button */}
        <div style={{textAlign: 'center', marginTop: '25px'}}>
          <button className="btn btn-minigame" onClick={() => navigate('minigame')}>
            🏀 0/2 Liberi Simulator
          </button>
        </div>
      </div>

      {/* Legend Section */}
      <div className="section">
        <h2 className="section-title section-title-orange">Legenda Multe</h2>
        <div className="legend-grid">
          {multeTypesData.map(type => (
            <div key={type.id} className="legend-item">
              <div className="legend-info">
                <span className="legend-id">#{type.id}</span>
                <span className="legend-name">{type.name}</span>
              </div>
              <div>
                {typeof type.price === 'number' ? (
                  <strong style={{color: 'var(--team-blue-dark)'}}>{type.price}€</strong>
                ) : type.price === 'KASA' ? (
                  <span className="badge badge-kasa">KASA</span>
                ) : (
                  <span className="badge badge-merenda">MERENDA</span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="legend-notes">
          <div><strong>💡 Note:</strong></div>
          <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
            <span className="badge badge-kasa">KASA</span>
            <span>= Kasa bjre</span>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
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
        <button className="back-button" onClick={() => navigate('home')}>← Back</button>
      </div>
      <h2 className="app-title" style={{fontSize: '2em'}}>{title}</h2>

      <div className="filters-container">
        <input
          type="text"
          className="search-input"
          placeholder="Cerca..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="All">Tutti</option>
          <option value="Pending">Pending</option>
          <option value="Validated">Validated</option>
        </select>
      </div>

      <div className="table-container">
        <table className="multe-history-table">
          <thead>
            <tr>
              <th>Data</th>
              {!isPlayerView && <th>Giocatore</th>}
              <th>Multa</th>
              <th>Sanzione</th>
              <th>Descrizione</th>
              <th>Status</th>
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
                <td><span className={`badge badge-${f.status === 'Pending' ? 'kasa' : 'validated'}`}>{f.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- FREE THROW MINIGAME ---
const FreeThrowGame = ({ navigate }) => {
  const [phase, setPhase] = useState('ready'); // ready | shooting | result
  const [shots, setShots] = useState([]);
  const [cursorPos, setCursorPos] = useState(50);
  const animRef = useRef(null);
  const posRef = useRef(50);
  const dirRef = useRef(1);

  // Animate cursor back and forth
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
      // Instantly reset cursor for second shot — no pause
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
        <button className="back-button" onClick={() => navigate('home')}>← Back</button>
      </div>
      <h2 className="app-title" style={{fontSize: '2em'}}>🏀 0/2 Liberi Simulator</h2>

      <div className="section minigame-container">
        {phase === 'ready' && shots.length === 0 && (
          <div className="minigame-intro">
            <p>Hai 2 tiri liberi. Ferma il cursore nella zona verde per segnare!</p>
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
                {/* Show previous shot markers */}
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

            {/* Shot recap */}
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
  );
};
