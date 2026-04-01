import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import './App.css'

const API = 'https://tigerplate-api.onrender.com'

function App() {
  const [meals, setMeals] = useState([])
  const [halls, setHalls] = useState([])
  const [selectedHall, setSelectedHall] = useState('')
  const [selectedMealTime, setSelectedMealTime] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('')
  const [detected, setDetected] = useState(null)
  const [matchedMeal, setMatchedMeal] = useState(null)
  const [alternatives, setAlternatives] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('home')
  const [stats, setStats] = useState(null)
  const [showDetail, setShowDetail] = useState(null)
  const [dailyLog, setDailyLog] = useState([])
  const [dailyGoal] = useState({ calories: 2200, protein: 150, carbs: 250, fat: 70 })
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', text: "yo what's good 🐯 i literally know everything on the menu rn — ask me what to eat, what's high protein, what's actually worth the swipe, whatever you need" }
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const [imagePreview, setImagePreview] = useState(null)
  const [logToast, setLogToast] = useState(null)
  const fileInputRef = useRef(null)
  const chatEndRef = useRef(null)

  const dailyTotals = dailyLog.reduce((acc, m) => ({
    calories: acc.calories + (Number(m.calories) || 0),
    protein: acc.protein + (Number(m.protein) || 0),
    carbs: acc.carbs + (Number(m.carbs) || 0),
    fat: acc.fat + (Number(m.fat) || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  const timeGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'morning'
    if (h < 17) return 'afternoon'
    return 'evening'
  }

  const currentMealTime = () => {
    const h = new Date().getHours()
    if (h < 10) return 'Breakfast'
    if (h < 15) return 'Lunch'
    return 'Dinner'
  }

  useEffect(() => {
    setTimeout(() => setShowSplash(false), 2000)
    axios.get(API + '/halls').then(res => setHalls(res.data.halls)).catch(() => {})
    axios.get(API + '/stats').then(res => setStats(res.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const params = { limit: 100 }
    if (selectedHall) params.hall = selectedHall
    if (selectedMealTime) params.meal = selectedMealTime
    if (search) params.search = search
    if (sortBy) params.sort_by = sortBy
    axios.get(API + '/meals', { params }).then(res => setMeals(res.data.meals)).catch(() => {})
  }, [selectedHall, selectedMealTime, search, sortBy])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImagePreview(URL.createObjectURL(file))
    setLoading(true)
    setDetected(null)
    setMatchedMeal(null)
    setAlternatives([])
    const formData = new FormData()
    formData.append('image', file)
    try {
      const res = await axios.post(API + '/meals/identify', formData)
      setDetected(res.data.detected)
      if (res.data.matched && res.data.meal) {
        setMatchedMeal(res.data.meal)
        const altRes = await axios.get(API + '/meals/healthier', { params: { item_name: res.data.meal.item_name } })
        setAlternatives(altRes.data.alternatives || [])
      }
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const getHealthier = async (meal) => {
    setShowDetail(meal)
    try {
      const res = await axios.get(API + '/meals/healthier', { params: { item_name: meal.item_name } })
      setAlternatives(res.data.alternatives || [])
    } catch (err) { console.error(err) }
  }

  const addToLog = (meal) => {
    setDailyLog(prev => [...prev, meal])
    setLogToast(meal.item_name)
    setTimeout(() => setLogToast(null), 2000)
  }

  const removeFromLog = (index) => { setDailyLog(prev => prev.filter((_, i) => i !== index)) }

  const sendChat = async () => {
    if (!chatInput.trim()) return
    const userMsg = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setChatLoading(true)
    try {
      const res = await axios.post(API + '/chat', { message: userMsg, context: '' })
      setChatMessages(prev => [...prev, { role: 'ai', text: res.data.response }])
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'ai', text: "my bad, connection's being weird rn — try again" }])
    }
    setChatLoading(false)
  }

  const ProgressRing = ({ value, max, color, size = 80, stroke = 6 }) => {
    const r = (size - stroke) / 2
    const circ = 2 * Math.PI * r
    const pct = Math.min(value / max, 1)
    const off = circ - (pct * circ)
    return (
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
      </svg>
    )
  }

  const ProgressBar = ({ value, max, color }) => (
    <div className="pbar-track">
      <div className="pbar-fill" style={{ width: Math.min(value/max*100, 100) + '%', background: color }}></div>
    </div>
  )

  // Quick suggestions for chat
  const chatSuggestions = [
    "what's the best high protein option rn?",
    "what should i eat at schilletter tonight?",
    "i'm trying to cut, what's low calorie?",
    "what's the healthiest thing at douthit?",
  ]

  if (showSplash) return (
    <div className="splash">
      <div className="splash-bg"></div>
      <div className="splash-content">
        <div className="splash-icon">🐾</div>
        <h1>Tiger<span>Plate</span></h1>
        <p>eat smarter at clemson</p>
        <div className="splash-loader"><div className="splash-bar"></div></div>
      </div>
    </div>
  )

  return (
    <div className="app">

      {/* LOG TOAST */}
      {logToast && <div className="toast fade-in">✓ Logged {logToast}</div>}

      {/* ─── HOME ─── */}
      {activeTab === 'home' && (
        <div className="fade-in">
          <header className="home-header">
            <div>
              <p className="greeting">Good {timeGreeting()} 👋</p>
              <h1 className="home-title">Tiger<span>Plate</span></h1>
            </div>
            <div className="header-right">
              <div className="live-dot"></div>
              <div className="header-badge">{stats?.total_items || 0} live</div>
            </div>
          </header>

          <div className="current-meal-banner">
            <div className="cmb-left">
              <span className="cmb-label">Serving now</span>
              <span className="cmb-meal">{currentMealTime()}</span>
            </div>
            <div className="cmb-right">
              <span className="cmb-halls">{stats?.halls || 0} halls</span>
            </div>
          </div>

          <div className="daily-card">
            <div className="dc-header">
              <h3>Today's Intake</h3>
              <span className="dc-cal">{dailyTotals.calories}<small>/{dailyGoal.calories}</small></span>
            </div>
            <div className="dc-rings">
              {[
                {l:'Calories',v:dailyTotals.calories,m:dailyGoal.calories,c:'#F56600'},
                {l:'Protein',v:dailyTotals.protein,m:dailyGoal.protein,c:'#22c55e'},
                {l:'Carbs',v:dailyTotals.carbs,m:dailyGoal.carbs,c:'#f59e0b'},
                {l:'Fat',v:dailyTotals.fat,m:dailyGoal.fat,c:'#ef4444'}
              ].map((d,i) => (
                <div key={i} className="dc-ring">
                  <div className="ring-wrap">
                    <ProgressRing value={d.v} max={d.m} color={d.c} size={62} stroke={5} />
                    <div className="ring-inner">
                      <span>{d.l === 'Calories' ? Math.round(d.v/d.m*100)+'%' : d.v+'g'}</span>
                    </div>
                  </div>
                  <span className="ring-label">{d.l}</span>
                </div>
              ))}
            </div>
          </div>

          {dailyLog.length > 0 && (
            <div className="section">
              <h3 className="sec-title">Logged Today</h3>
              {dailyLog.map((m, i) => (
                <div key={i} className="log-item">
                  <div>
                    <div className="log-name">{m.item_name}</div>
                    <div className="log-meta">{m.hall} · {m.calories} cal · {m.protein}g protein</div>
                  </div>
                  <button className="log-remove" onClick={() => removeFromLog(i)}>✕</button>
                </div>
              ))}
              <div className="log-total">
                <span>Total</span>
                <span>{dailyTotals.calories} cal · {dailyTotals.protein}g P · {dailyTotals.carbs}g C · {dailyTotals.fat}g F</span>
              </div>
            </div>
          )}

          <div className="section">
            <h3 className="sec-title">Quick Actions</h3>
            <div className="action-grid">
              {[
                {i:'📸',l:'Scan Meal',s:'AI identifies your food',t:'scan'},
                {i:'🔍',l:'Browse Menu',s:'All halls, live data',t:'search'},
                {i:'💬',l:'Ask Tiger',s:'Your nutrition homie',t:'chat'},
                {i:'💪',l:'High Protein',s:'Sorted by protein',t:'search',sort:'protein'}
              ].map((a,idx) => (
                <button key={idx} className="action-btn" onClick={() => { if(a.sort) setSortBy(a.sort); setActiveTab(a.t) }}>
                  <span className="action-icon">{a.i}</span>
                  <span className="action-label">{a.l}</span>
                  <span className="action-sub">{a.s}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── MENU ─── */}
      {activeTab === 'search' && (
        <div className="fade-in">
          <div className="tab-top">
            <h2>Menu</h2>
            <div className="tab-top-right">
              <div className="live-indicator"><div className="live-dot sm"></div>Live</div>
              <span className="tab-count">{meals.length}</span>
            </div>
          </div>

          <div className="search-wrap">
            <span className="s-icon">🔍</span>
            <input type="text" placeholder="Search today's menu..." value={search} onChange={e => setSearch(e.target.value)} className="s-input" />
            {search && <button className="s-clear" onClick={() => setSearch('')}>✕</button>}
          </div>

          <div className="chips">
            {['', ...halls].map(h => (
              <button key={h} className={'chip' + (selectedHall===h?' on':'')} onClick={() => setSelectedHall(h)}>
                {h || 'All Halls'}
              </button>
            ))}
          </div>

          <div className="chips">
            {['','breakfast','lunch','dinner'].map(t => (
              <button key={t} className={'chip' + (selectedMealTime===t?' on':'')} onClick={() => setSelectedMealTime(t)}>
                {t || 'All Meals'}
              </button>
            ))}
          </div>

          <div className="chips sort">
            {[
              {k:'calories',l:'Cal ↓'},
              {k:'protein',l:'Protein ↑'},
              {k:'carbs',l:'Carbs ↓'},
              {k:'fat',l:'Fat ↓'}
            ].map(s => (
              <button key={s.k} className={'chip sm' + (sortBy===s.k?' on':'')} onClick={() => setSortBy(sortBy===s.k?'':s.k)}>
                {s.l}
              </button>
            ))}
          </div>

          <div className="meal-list">
            {meals.length === 0 && (
              <div className="empty-state">
                <span>🍽️</span>
                <p>No items found — try a different filter or check back at meal time</p>
              </div>
            )}
            {(() => {
              // Group meals: hall -> station -> items
              const grouped = {}
              meals.forEach(m => {
                const hall = m.hall || 'Other'
                const station = m.station || 'Other'
                if (!grouped[hall]) grouped[hall] = {}
                if (!grouped[hall][station]) grouped[hall][station] = []
                grouped[hall][station].push(m)
              })
              let itemIdx = 0
              return Object.entries(grouped).map(([hall, stations]) => (
                <div key={hall} className="hall-group">
                  <div className="hall-header">
                    <span className="hall-name">{hall}</span>
                    <span className="hall-count">{Object.values(stations).flat().length} items</span>
                  </div>
                  {Object.entries(stations).map(([station, items]) => (
                    <div key={station} className="station-group">
                      <div className="station-header">{station}</div>
                      {items.map((m) => {
                        const idx = itemIdx++
                        return (
                          <div key={idx} className="mcard" style={{animationDelay: Math.min(idx*0.02,0.4)+'s'}}>
                            <div className="mcard-top" onClick={() => getHealthier(m)}>
                              <div>
                                <div className="mcard-name">{m.item_name}</div>
                                {m.description && <div className="mcard-desc">{m.description}</div>}
                              </div>
                              <div className="mcard-cal">{m.calories}<small>cal</small></div>
                            </div>
                            <div className="mcard-bar">
                              <div className="mb-p" style={{flex:m.protein||1}}></div>
                              <div className="mb-c" style={{flex:m.carbs||1}}></div>
                              <div className="mb-f" style={{flex:m.fat||1}}></div>
                            </div>
                            <div className="mcard-bottom">
                              <div className="mcard-macros">
                                <span className="mm-p">{m.protein}g P</span>
                                <span className="mm-c">{m.carbs}g C</span>
                                <span className="mm-f">{m.fat}g F</span>
                              </div>
                              <button className="mcard-log" onClick={e => {e.stopPropagation(); addToLog(m)}}>+ Log</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              ))
            })()}
          </div>
        </div>
      )}

      {/* ─── SCAN ─── */}
      {activeTab === 'scan' && (
        <div className="fade-in">
          <div className="tab-top"><h2>Scan Meal</h2></div>
          <div className="upload" onClick={() => fileInputRef.current?.click()}>
            {imagePreview ? <img src={imagePreview} alt="" className="upload-img" /> : (
              <div className="upload-inner">
                <div className="upload-circle"><span>📸</span></div>
                <p className="upload-t">Snap or upload your meal</p>
                <p className="upload-s">AI identifies it and pulls nutrition from today's menu</p>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageUpload} hidden />
          </div>

          {loading && <div className="scanning"><div className="scan-dot"></div><p>Analyzing...</p></div>}

          {detected && !loading && (
            <div className="scan-res fade-in">
              <span className="scan-badge">✅ Identified</span>
              <h3>{detected}</h3>
              {matchedMeal && (
                <div className="mcard highlighted">
                  <div className="mcard-top">
                    <div>
                      <div className="mcard-name">{matchedMeal.item_name}</div>
                      <div className="mcard-tags">
                        <span className="tag-hall">{matchedMeal.hall}</span>
                        <span className="tag-meal">{matchedMeal.meal}</span>
                      </div>
                    </div>
                    <div className="mcard-cal">{matchedMeal.calories}<small>cal</small></div>
                  </div>
                  <div className="scan-macros">
                    {[
                      {v:matchedMeal.protein,m:50,c:'#22c55e',l:'Protein'},
                      {v:matchedMeal.carbs,m:80,c:'#f59e0b',l:'Carbs'},
                      {v:matchedMeal.fat,m:40,c:'#ef4444',l:'Fat'}
                    ].map((d,i) => (
                      <div key={i} className="scan-macro">
                        <div className="ring-wrap sm">
                          <ProgressRing value={d.v} max={d.m} color={d.c} size={52} stroke={4}/>
                          <div className="ring-inner sm"><span>{d.v}g</span></div>
                        </div>
                        <small>{d.l}</small>
                      </div>
                    ))}
                  </div>
                  {matchedMeal.serving && <div className="scan-serving">Serving: {matchedMeal.serving}</div>}
                  <button className="mcard-log full" onClick={() => addToLog(matchedMeal)}>+ Log This Meal</button>
                </div>
              )}
              {!matchedMeal && <p className="no-match">Not on today's menu — try browsing</p>}
            </div>
          )}

          {alternatives.length > 0 && (
            <div className="section fade-in">
              <h3 className="sec-title">Healthier Swaps</h3>
              {alternatives.map((a,i) => (
                <div key={i} className="alt-row" onClick={() => {setShowDetail(a)}}>
                  <div>
                    <div className="mcard-name">{a.item_name}</div>
                    <div className="mcard-macros">
                      <span className="mm-p">{a.protein}g P</span>
                      <span className="mm-c">{a.carbs}g C</span>
                      <span className="mm-f">{a.fat}g F</span>
                    </div>
                  </div>
                  <div className="alt-nums">
                    <div className="alt-cal">{a.calories}<small>cal</small></div>
                    {matchedMeal && <div className="alt-save">-{matchedMeal.calories-a.calories}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {imagePreview && !loading && (
            <button className="btn-outline" onClick={() => {
              setImagePreview(null); setDetected(null); setMatchedMeal(null); setAlternatives([]);
              fileInputRef.current?.click()
            }}>
              Scan Another
            </button>
          )}
        </div>
      )}

      {/* ─── CHAT ─── */}
      {activeTab === 'chat' && (
        <div className="chat fade-in">
          <div className="chat-head">
            <div className="chat-av-lg">🐯</div>
            <div>
              <h3>Tiger</h3>
              <span className="chat-status"><div className="live-dot sm"></div> knows today's menu</span>
            </div>
          </div>

          <div className="chat-body">
            {chatMessages.map((msg,i) => (
              <div key={i} className={'cb '+msg.role}>
                {msg.role==='ai' && <div className="cb-av">🐯</div>}
                <div className="cb-text">{msg.text}</div>
              </div>
            ))}
            {chatLoading && (
              <div className="cb ai">
                <div className="cb-av">🐯</div>
                <div className="cb-text dots"><span></span><span></span><span></span></div>
              </div>
            )}
            <div ref={chatEndRef}></div>
          </div>

          {/* Suggestion chips — only show if no user messages yet */}
          {chatMessages.length <= 1 && (
            <div className="chat-suggestions">
              {chatSuggestions.map((s,i) => (
                <button key={i} className="chat-sug" onClick={() => {
                  setChatInput(s)
                  setTimeout(() => {
                    setChatInput('')
                    setChatMessages(prev => [...prev, { role: 'user', text: s }])
                    setChatLoading(true)
                    axios.post(API + '/chat', { message: s, context: '' })
                      .then(res => setChatMessages(prev => [...prev, { role: 'ai', text: res.data.response }]))
                      .catch(() => setChatMessages(prev => [...prev, { role: 'ai', text: "connection's being weird, try again" }]))
                      .finally(() => setChatLoading(false))
                  }, 100)
                }}>{s}</button>
              ))}
            </div>
          )}

          <div className="chat-bar">
            <input
              type="text"
              placeholder="ask about tonight's menu..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter'){e.preventDefault();sendChat()} }}
              className="chat-in"
            />
            <button className="chat-btn" onClick={sendChat} disabled={!chatInput.trim()}>↑</button>
          </div>
        </div>
      )}

      {/* ─── DETAIL MODAL ─── */}
      {showDetail && (
        <div className="overlay" onClick={() => {setShowDetail(null);setAlternatives([])}}>
          <div className="modal fade-in" onClick={e=>e.stopPropagation()}>
            <button className="modal-x" onClick={() => {setShowDetail(null);setAlternatives([])}}>✕</button>
            <h2>{showDetail.item_name}</h2>
            <div className="mcard-tags" style={{marginBottom:12}}>
              <span className="tag-hall">{showDetail.hall}</span>
              <span className="tag-meal">{showDetail.meal}</span>
              {showDetail.station && showDetail.station !== 'Other' && <span className="tag-station">{showDetail.station}</span>}
            </div>

            {showDetail.description && <p className="modal-desc">{showDetail.description}</p>}

            <div className="modal-cal">{showDetail.calories}<small> cal</small></div>

            {showDetail.serving && <div className="modal-serving">Serving: {showDetail.serving}</div>}

            <div className="modal-rings">
              {[
                {v:showDetail.protein,m:50,c:'#22c55e',l:'Protein'},
                {v:showDetail.carbs,m:80,c:'#f59e0b',l:'Carbs'},
                {v:showDetail.fat,m:40,c:'#ef4444',l:'Fat'}
              ].map((d,i) => (
                <div key={i} className="mr">
                  <div className="ring-wrap">
                    <ProgressRing value={d.v} max={d.m} color={d.c} />
                    <div className="ring-inner"><span className="ring-pct">{d.v}g</span></div>
                  </div>
                  <span>{d.l}</span>
                </div>
              ))}
            </div>

            {/* Extra nutrition details */}
            <div className="modal-details">
              {showDetail.sodium != null && <div className="md-row"><span>Sodium</span><span>{showDetail.sodium}mg</span></div>}
              {showDetail.fiber != null && <div className="md-row"><span>Fiber</span><span>{showDetail.fiber}g</span></div>}
              {showDetail.sugar != null && <div className="md-row"><span>Sugar</span><span>{showDetail.sugar}g</span></div>}
              {showDetail.saturated_fat != null && <div className="md-row"><span>Sat. Fat</span><span>{showDetail.saturated_fat}g</span></div>}
              {showDetail.cholesterol != null && <div className="md-row"><span>Cholesterol</span><span>{showDetail.cholesterol}mg</span></div>}
            </div>

            {showDetail.allergens && showDetail.allergens !== 'Contains: ' && showDetail.allergens.replace('Contains: ', '').trim().length > 0 && (
              <div className="modal-allergens">⚠️ {showDetail.allergens}</div>
            )}

            <button className="mcard-log full" onClick={() => {addToLog(showDetail);setShowDetail(null);setAlternatives([])}}>+ Log This Meal</button>

            {alternatives.length > 0 && (
              <div style={{marginTop:20}}>
                <h4 style={{marginBottom:8,fontSize:'.85rem',color:'#999',textTransform:'uppercase',letterSpacing:'1px'}}>Healthier Swaps</h4>
                {alternatives.map((a,i) => (
                  <div key={i} className="alt-row" onClick={() => {setShowDetail(a);getHealthier(a)}}>
                    <div>
                      <div className="mcard-name">{a.item_name}</div>
                      <div className="mcard-macros">
                        <span className="mm-p">{a.protein}g P</span>
                        <span className="mm-c">{a.carbs}g C</span>
                        <span className="mm-f">{a.fat}g F</span>
                      </div>
                    </div>
                    <div className="alt-nums">
                      <div className="alt-cal">{a.calories}<small>cal</small></div>
                      <div className="alt-save">-{showDetail.calories-a.calories}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── BOTTOM NAV ─── */}
      <nav className="bnav">
        {[{i:'🏠',l:'Home',t:'home'},{i:'🍽️',l:'Menu',t:'search'}].map(n => (
          <button key={n.t} className={activeTab===n.t?'on':''} onClick={() => setActiveTab(n.t)}>
            <span className="ni">{n.i}</span><span className="nl">{n.l}</span>
          </button>
        ))}
        <button className={'scan-fab'+(activeTab==='scan'?' on':'')} onClick={() => setActiveTab('scan')}>
          <span>📸</span>
        </button>
        {[{i:'💬',l:'Tiger',t:'chat'},{i:'📊',l:'Log',t:'home'}].map(n => (
          <button key={n.l} className={activeTab===n.t?'on':''} onClick={() => setActiveTab(n.t)}>
            <span className="ni">{n.i}</span><span className="nl">{n.l}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default App
