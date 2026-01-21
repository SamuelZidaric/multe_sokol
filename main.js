const { useState, useEffect, useMemo } = React;

const BasketballTracker = () => {
  const [playersData, setPlayersData] = useState([]);
  const [multeTypesData, setMulteTypesData] = useState([]);
  const [finesInstances, setFinesInstances] = useState([]);
  const [currentPage, setCurrentPage] = useState('home');
  const [currentPlayerId, setCurrentPlayerId] = useState(null);

  // 1. Centralized Data Fetching
  useEffect(() => {
    Promise.all([
      fetch('./players.json').then(res => res.json()),
      fetch('./multe-types.json').then(res => res.json()),
      fetch('./fines-instances.json').then(res => res.json())
    ]).then(([players, types, fines]) => {
      setPlayersData(players);
      setMulteTypesData(types);
      setFinesInstances(fines);
    }).catch(err => console.error("Error loading data:", err));
  }, []);

  // 2. Routing Logic
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#player/')) {
        setCurrentPlayerId(parseInt(hash.replace('#player/', '')));
        setCurrentPage('player');
      } else if (hash === '#all-fines') {
        setCurrentPage('all-fines');
      } else {
        setCurrentPage('home');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Init
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 3. Global Stats Calculation
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

  // 4. Upcoming Multe Logic
  const upcomingMulte = useMemo(() => {
    return finesInstances
      .filter(f => f.status === 'Pending')
      .map(f => ({
        ...f,
        player: playersData.find(p => p.id === f.player_id),
        type: multeTypesData.find(t => t.id === f.multa_id)
      }))
      .filter(f => f.player && f.type)
      .sort((a, b) => {
        const dateA = a.date.split('/').reverse().join('');
        const dateB = b.date.split('/').reverse().join('');
        return dateA.localeCompare(dateB);
      })
      .slice(0, 5); // Take top 5 oldest
  }, [finesInstances, playersData, multeTypesData]);

  // --- RENDER HELPERS ---
  
  if (currentPage === 'all-fines') {
    return <FinesListPage 
      fines={finesInstances} 
      players={playersData} 
      types={multeTypesData} 
      title="Tutte le Multe"
    />;
  }

  if (currentPage === 'player' && currentPlayerId) {
    return <FinesListPage 
      fines={finesInstances.filter(f => f.player_id === currentPlayerId)} 
      players={playersData} 
      types={multeTypesData}
      title="Dettaglio Giocatore"
      isPlayerView={true}
    />;
  }

  return (
    <div className="app-container">
      <h1 className="app-title">Multe Sokol 🏀</h1>
      
      {/* Upcoming Section (Fixed Layout with Avatar) */}
      {upcomingMulte.length > 0 && (
        <div className="upcoming-multe">
          <h3>Najstarejši recupero</h3>
          <div className="upcoming-multe-list">
            {upcomingMulte.map(f => {
              // Calculate days
              const parts = f.date.split('/');
              const fineDate = new Date(parts[2], parts[1] - 1, parts[0]);
              const today = new Date();
              const diffTime = today - fineDate;
              const daysPassed = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              // Initials for Avatar
              const initials = (f.player.name[0] + f.player.surname[0]).toUpperCase();

              return (
                <div key={f.id} className="upcoming-multa-item">
                  {/* 1. Avatar (Was missing before!) */}
                  <div className="player-avatar">
                    {initials}
                  </div>

                  {/* 2. Info */}
                  <div className="upcoming-info">
                     <div className="upcoming-player">{f.player.name} {f.player.surname}</div>
                     <div className="upcoming-desc">{f.type.name}</div>
                  </div>
                  
                  {/* 3. Badges */}
                  <div className="upcoming-badges-container">
                    <div className="days-overdue-badge">
                      +{daysPassed} dni
                    </div>
                    <div className="upcoming-date-badge">
                      {f.date}
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
        <div className="stats-grid">
           {/* Total Summary Block */}
           <div className="stats-total">
             <h3>Totale Squadra</h3>
             <div className="stats-total-grid">
               <div><strong>Multe:</strong> {finesInstances.length}</div>
               <div><strong>Euro:</strong> {stats.reduce((acc, s) => acc + s.totalEuro, 0)}€</div>
               <button onClick={() => window.location.hash = '#all-fines'} className="btn" style={{marginTop: 5, width: '100%'}}>Vedi Tutte</button>
             </div>
           </div>

           {/* Player Cards */}
           {stats.map(stat => (
             <div key={stat.player.id} className="player-card" onClick={() => window.location.hash = `#player/${stat.player.id}`}>
               <div style={{display:'flex', justifyContent:'space-between'}}>
                 <strong>{stat.player.name} {stat.player.surname}</strong>
                 <span style={{fontSize: '1.5em'}}>🏀</span>
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
      </div>

      {/* --- LEGEND SECTION (Added to Home View) --- */}
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
const FinesListPage = ({ fines, players, types, title, isPlayerView }) => {
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
        <a href="#" className="back-button" onClick={(e) => {e.preventDefault(); window.location.hash='';}}>← Back</a>
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
            {filtered.map((f, i) => (
              <tr key={i} className={`multe-row ${f.status.toLowerCase()}`}>
                <td>{f.date}</td>
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

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<BasketballTracker />);