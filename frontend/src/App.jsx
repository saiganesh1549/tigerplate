import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { supabase } from './supabase'
import './App.css'

const API = 'https://tigerplate-api.onrender.com'

function App() {
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPass, setAuthPass] = useState('')
  const [authName, setAuthName] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [profile, setProfile] = useState(null)
  const [onboardGoal, setOnboardGoal] = useState('maintain')
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
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', text: "yo what's good 🐯 i literally know everything on the menu rn — ask me what to eat, what's high protein, what's actually worth the swipe, whatever you need" }
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const [imagePreview, setImagePreview] = useState(null)
  const [logToast, setLogToast] = useState(null)
  const [settingsGoal, setSettingsGoal] = useState('')
  const [settingsName, setSettingsName] = useState('')
  const [newPass, setNewPass] = useState('')
  const [settingsMsg, setSettingsMsg] = useState('')
  const [mealHistory, setMealHistory] = useState([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const fileInputRef = useRef(null)
  const chatEndRef = useRef(null)

  const goals = profile || { calorie_goal: 2200, protein_goal: 150, carbs_goal: 250, fat_goal: 70 }
  const dailyTotals = dailyLog.reduce((acc, m) => ({
    calories: acc.calories + (Number(m.calories) || 0),
    protein: acc.protein + (Number(m.protein) || 0),
    carbs: acc.carbs + (Number(m.carbs) || 0),
    fat: acc.fat + (Number(m.fat) || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  const timeGreeting = () => { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening' }
  const currentMealTime = () => { const h = new Date().getHours(); return h < 10 ? 'Breakfast' : h < 15 ? 'Lunch' : 'Dinner' }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
      if (session?.user) loadProfile(session.user.id)
      setCheckingAuth(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null)
      if (session?.user) loadProfile(session.user.id)
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (uid) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (data) { setProfile(data); if (!data.goal) setAuthMode('onboarding') }
  }

  const loadTodayLogs = async (uid) => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('meal_logs').select('*').eq('user_id', uid)
      .gte('logged_at', today + 'T00:00:00').lte('logged_at', today + 'T23:59:59')
      .order('logged_at', { ascending: true })
    if (data) setDailyLog(data)
  }

  useEffect(() => { if (user && user.id !== 'guest') loadTodayLogs(user.id) }, [user])

  const handleAuth = async () => {
    setAuthError(''); setAuthLoading(true)
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPass })
        if (error) throw error
        setAuthMode('onboarding')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPass })
        if (error) throw error
      }
    } catch (err) { setAuthError(err.message) }
    setAuthLoading(false)
  }

  const handleOnboarding = async () => {
    const macros = { cut: { calorie_goal: 1800, protein_goal: 180, carbs_goal: 150, fat_goal: 60 }, maintain: { calorie_goal: 2200, protein_goal: 150, carbs_goal: 250, fat_goal: 70 }, bulk: { calorie_goal: 2800, protein_goal: 180, carbs_goal: 350, fat_goal: 80 } }[onboardGoal]
    await supabase.from('profiles').update({ name: authName || null, goal: onboardGoal, ...macros }).eq('id', user.id)
    setProfile({ ...profile, name: authName, goal: onboardGoal, ...macros })
    setAuthMode('done')
  }

  const handleLogout = async () => { await supabase.auth.signOut(); setUser(null); setProfile(null); setDailyLog([]); setActiveTab('home') }

  const updateGoal = async (newGoal) => {
    const macros = { cut: { calorie_goal: 1800, protein_goal: 180, carbs_goal: 150, fat_goal: 60 }, maintain: { calorie_goal: 2200, protein_goal: 150, carbs_goal: 250, fat_goal: 70 }, bulk: { calorie_goal: 2800, protein_goal: 180, carbs_goal: 350, fat_goal: 80 } }[newGoal]
    if (user?.id !== 'guest') { await supabase.from('profiles').update({ goal: newGoal, ...macros }).eq('id', user.id) }
    setProfile(prev => ({ ...prev, goal: newGoal, ...macros }))
    setSettingsGoal(newGoal)
    setSettingsMsg('Goal updated!')
    setTimeout(() => setSettingsMsg(''), 2000)
  }

  const updateName = async () => {
    if (user?.id !== 'guest') { await supabase.from('profiles').update({ name: settingsName }).eq('id', user.id) }
    setProfile(prev => ({ ...prev, name: settingsName }))
    setSettingsMsg('Name updated!')
    setTimeout(() => setSettingsMsg(''), 2000)
  }

  const changePassword = async () => {
    if (!newPass || newPass.length < 6) { setSettingsMsg('Password must be 6+ characters'); setTimeout(() => setSettingsMsg(''), 2000); return }
    const { error } = await supabase.auth.updateUser({ password: newPass })
    if (error) { setSettingsMsg(error.message) } else { setSettingsMsg('Password changed!'); setNewPass('') }
    setTimeout(() => setSettingsMsg(''), 2000)
  }

  const deleteAccount = async () => {
    if (user?.id !== 'guest') {
      await supabase.from('meal_logs').delete().eq('user_id', user.id)
      await supabase.from('profiles').delete().eq('id', user.id)
      await supabase.auth.signOut()
    }
    setUser(null); setProfile(null); setDailyLog([]); setActiveTab('home'); setShowDeleteConfirm(false)
  }

  const loadHistory = async () => {
    if (user?.id === 'guest') return
    const { data } = await supabase.from('meal_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(50)
    if (data) setMealHistory(data)
  }

  useEffect(() => { if (activeTab === 'settings') { setSettingsGoal(profile?.goal || 'maintain'); setSettingsName(profile?.name || ''); loadHistory() } }, [activeTab])

  useEffect(() => {
    setTimeout(() => setShowSplash(false), 2000)
    axios.get(API + '/halls').then(r => setHalls(r.data.halls)).catch(() => {})
    axios.get(API + '/stats').then(r => setStats(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    const p = { limit: 100 }; if (selectedHall) p.hall = selectedHall; if (selectedMealTime) p.meal = selectedMealTime; if (search) p.search = search; if (sortBy) p.sort_by = sortBy
    axios.get(API + '/meals', { params: p }).then(r => setMeals(r.data.meals)).catch(() => {})
  }, [selectedHall, selectedMealTime, search, sortBy])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return
    setImagePreview(URL.createObjectURL(file)); setLoading(true); setDetected(null); setMatchedMeal(null); setAlternatives([])
    const fd = new FormData(); fd.append('image', file)
    try { const r = await axios.post(API + '/meals/identify', fd); setDetected(r.data.detected)
      if (r.data.matched && r.data.meal) { setMatchedMeal(r.data.meal); const a = await axios.get(API + '/meals/healthier', { params: { item_name: r.data.meal.item_name } }); setAlternatives(a.data.alternatives || []) }
    } catch (err) { console.error(err) } setLoading(false)
  }

  const getHealthier = async (meal) => {
    setShowDetail(meal)
    try { const r = await axios.get(API + '/meals/healthier', { params: { item_name: meal.item_name } }); setAlternatives(r.data.alternatives || []) } catch (err) { console.error(err) }
  }

  const addToLog = async (meal) => {
    const entry = { user_id: user?.id, item_name: meal.item_name, hall: meal.hall, station: meal.station, meal: meal.meal, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat }
    if (user && user.id !== 'guest') { const { data } = await supabase.from('meal_logs').insert(entry).select().single(); if (data) setDailyLog(prev => [...prev, data]) }
    else { setDailyLog(prev => [...prev, { ...entry, id: Date.now(), logged_at: new Date().toISOString() }]) }
    setLogToast(meal.item_name); setTimeout(() => setLogToast(null), 2000)
  }

  const removeFromLog = async (log) => {
    if (user && user.id !== 'guest' && log.id) { await supabase.from('meal_logs').delete().eq('id', log.id) }
    setDailyLog(prev => prev.filter(m => m.id !== log.id))
  }

  const sendChat = async () => {
    if (!chatInput.trim()) return; const msg = chatInput.trim(); setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', text: msg }]); setChatLoading(true)
    try { const r = await axios.post(API + '/chat', { message: msg, context: '' }); setChatMessages(prev => [...prev, { role: 'ai', text: r.data.response }]) }
    catch { setChatMessages(prev => [...prev, { role: 'ai', text: "connection's being weird, try again" }]) }
    setChatLoading(false)
  }

  const ProgressRing = ({ value, max, color, size = 80, stroke = 6 }) => {
    const r = (size - stroke) / 2, circ = 2 * Math.PI * r, off = circ - (Math.min(value / max, 1) * circ)
    return (<svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} /><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }} /></svg>)
  }

  const chatSuggestions = ["what's the best high protein option rn?", "what should i eat at schilletter tonight?", "i'm trying to cut, what's low calorie?", "what's the healthiest thing at douthit?"]

  if (showSplash) return (<div className="splash"><div className="splash-bg"></div><div className="splash-content"><div className="splash-icon">🐾</div><h1>Tiger<span>Plate</span></h1><p>eat smarter at clemson</p><div className="splash-loader"><div className="splash-bar"></div></div></div></div>)
  if (checkingAuth) return (<div className="splash"><div className="splash-content"><div className="splash-icon">🐾</div><p>Loading...</p></div></div>)

  if (!user) return (
    <div className="app auth-page">
      <div className="auth-header"><div className="splash-icon">🐾</div><h1 className="home-title">Tiger<span>Plate</span></h1><p className="auth-sub">eat smarter at clemson</p></div>
      <div className="auth-card">
        <div className="auth-tabs"><button className={authMode==='login'?'on':''} onClick={()=>{setAuthMode('login');setAuthError('')}}>Log In</button><button className={authMode==='signup'?'on':''} onClick={()=>{setAuthMode('signup');setAuthError('')}}>Sign Up</button></div>
        <div className="auth-form">
          <input type="email" placeholder="Email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} className="auth-input" />
          <input type="password" placeholder="Password" value={authPass} onChange={e=>setAuthPass(e.target.value)} className="auth-input" onKeyDown={e=>{if(e.key==='Enter')handleAuth()}} />
          {authError && <div className="auth-error">{authError}</div>}
          <button className="auth-btn" onClick={handleAuth} disabled={authLoading}>{authLoading ? '...' : authMode==='login' ? 'Log In' : 'Create Account'}</button>
        </div>
      </div>
      <button className="auth-skip" onClick={()=>{setUser({id:'guest'});setProfile({calorie_goal:2200,protein_goal:150,carbs_goal:250,fat_goal:70,goal:'maintain'})}}>Continue without account →</button>
    </div>
  )

  if (user && user.id !== 'guest' && profile && !profile.goal) return (
    <div className="app auth-page">
      <div className="auth-header"><div className="splash-icon">🐾</div><h1 className="home-title">Tiger<span>Plate</span></h1><p className="auth-sub">let's set up your goals</p></div>
      <div className="auth-card">
        <input type="text" placeholder="Your name (optional)" value={authName} onChange={e=>setAuthName(e.target.value)} className="auth-input" />
        <p className="onboard-q">What's your goal?</p>
        <div className="goal-grid">
          {[{key:'cut',icon:'🔥',label:'Cut',desc:'1800 cal · high protein'},{key:'maintain',icon:'⚖️',label:'Maintain',desc:'2200 cal · balanced'},{key:'bulk',icon:'💪',label:'Bulk',desc:'2800 cal · high carbs'}].map(g=>(
            <button key={g.key} className={'goal-btn'+(onboardGoal===g.key?' on':'')} onClick={()=>setOnboardGoal(g.key)}><span className="goal-icon">{g.icon}</span><span className="goal-label">{g.label}</span><span className="goal-desc">{g.desc}</span></button>
          ))}
        </div>
        <button className="auth-btn" onClick={handleOnboarding}>Let's go →</button>
      </div>
    </div>
  )

  return (
    <div className="app">
      {logToast && <div className="toast fade-in">✓ Logged {logToast}</div>}
      {activeTab === 'home' && (
        <div className="fade-in">
          <header className="home-header"><div><p className="greeting">Good {timeGreeting()}{profile?.name ? `, ${profile.name}` : ''} 👋</p><h1 className="home-title">Tiger<span>Plate</span></h1></div><div className="header-right"><div className="live-dot"></div><div className="header-badge">{stats?.total_items||0} live</div></div></header>
          <div className="current-meal-banner"><div className="cmb-left"><span className="cmb-label">Serving now</span><span className="cmb-meal">{currentMealTime()}</span></div><div className="cmb-right"><span className="cmb-halls">{stats?.halls||0} halls</span></div></div>
          <div className="daily-card">
            <div className="dc-header"><h3>Today's Intake</h3><span className="dc-cal">{dailyTotals.calories}<small>/{goals.calorie_goal}</small></span></div>
            <div className="dc-rings">{[{l:'Calories',v:dailyTotals.calories,m:goals.calorie_goal,c:'#F56600'},{l:'Protein',v:dailyTotals.protein,m:goals.protein_goal,c:'#22c55e'},{l:'Carbs',v:dailyTotals.carbs,m:goals.carbs_goal,c:'#f59e0b'},{l:'Fat',v:dailyTotals.fat,m:goals.fat_goal,c:'#ef4444'}].map((d,i)=>(<div key={i} className="dc-ring"><div className="ring-wrap"><ProgressRing value={d.v} max={d.m} color={d.c} size={62} stroke={5}/><div className="ring-inner"><span>{d.l==='Calories'?Math.round(d.v/d.m*100)+'%':d.v+'g'}</span></div></div><span className="ring-label">{d.l}</span></div>))}</div>
          </div>
          {dailyLog.length > 0 && (<div className="section"><h3 className="sec-title">Logged Today</h3>{dailyLog.map((m,i)=>(<div key={m.id||i} className="log-item"><div><div className="log-name">{m.item_name}</div><div className="log-meta">{m.hall} · {m.calories} cal · {m.protein}g protein</div></div><button className="log-remove" onClick={()=>removeFromLog(m)}>✕</button></div>))}<div className="log-total"><span>Total</span><span>{dailyTotals.calories} cal · {dailyTotals.protein}g P · {dailyTotals.carbs}g C · {dailyTotals.fat}g F</span></div></div>)}
          <div className="section"><h3 className="sec-title">Quick Actions</h3><div className="action-grid">{[{i:'📸',l:'Scan Meal',s:'AI identifies your food',t:'scan'},{i:'🔍',l:'Browse Menu',s:'All halls, live data',t:'search'},{i:'💬',l:'Ask Tiger',s:'Your nutrition homie',t:'chat'},{i:'💪',l:'High Protein',s:'Sorted by protein',t:'search',sort:'protein'}].map((a,idx)=>(<button key={idx} className="action-btn" onClick={()=>{if(a.sort)setSortBy(a.sort);setActiveTab(a.t)}}><span className="action-icon">{a.i}</span><span className="action-label">{a.l}</span><span className="action-sub">{a.s}</span></button>))}</div></div>
        </div>
      )}

      {activeTab === 'search' && (
        <div className="fade-in">
          <div className="tab-top"><h2>Menu</h2><div className="tab-top-right"><div className="live-indicator"><div className="live-dot sm"></div>Live</div><span className="tab-count">{meals.length}</span></div></div>
          <div className="search-wrap"><span className="s-icon">🔍</span><input type="text" placeholder="Search today's menu..." value={search} onChange={e=>setSearch(e.target.value)} className="s-input"/>{search&&<button className="s-clear" onClick={()=>setSearch('')}>✕</button>}</div>
          <div className="chips">{['', ...halls].map(h=>(<button key={h} className={'chip'+(selectedHall===h?' on':'')} onClick={()=>setSelectedHall(h)}>{h||'All Halls'}</button>))}</div>
          <div className="chips">{['','breakfast','lunch','dinner'].map(t=>(<button key={t} className={'chip'+(selectedMealTime===t?' on':'')} onClick={()=>setSelectedMealTime(t)}>{t||'All Meals'}</button>))}</div>
          <div className="chips sort">{[{k:'calories',l:'Cal ↓'},{k:'protein',l:'Protein ↑'},{k:'carbs',l:'Carbs ↓'},{k:'fat',l:'Fat ↓'}].map(s=>(<button key={s.k} className={'chip sm'+(sortBy===s.k?' on':'')} onClick={()=>setSortBy(sortBy===s.k?'':s.k)}>{s.l}</button>))}</div>
          <div className="meal-list">
            {meals.length===0&&(<div className="empty-state"><span>🍽️</span><p>No items found — try a different filter or check back at meal time</p></div>)}
            {(()=>{const grouped={};meals.forEach(m=>{const h=m.hall||'Other',s=m.station||'';if(!grouped[h])grouped[h]={};if(!grouped[h][s])grouped[h][s]=[];grouped[h][s].push(m)});let idx=0
              return Object.entries(grouped).map(([hall,stations])=>(<div key={hall} className="hall-group"><div className="hall-header"><span className="hall-name">{hall}</span><span className="hall-count">{Object.values(stations).flat().length} items</span></div>
                {Object.entries(stations).map(([station,items])=>(<div key={station} className="station-group">{station&&<div className="station-header">{station}</div>}
                  {items.map(m=>{const i=idx++;return(<div key={i} className="mcard" style={{animationDelay:Math.min(i*0.02,0.4)+'s'}}><div className="mcard-top" onClick={()=>getHealthier(m)}><div><div className="mcard-name">{m.item_name}</div>{m.description&&<div className="mcard-desc">{m.description}</div>}</div><div className="mcard-cal">{m.calories}<small>cal</small></div></div><div className="mcard-bar"><div className="mb-p" style={{flex:m.protein||1}}></div><div className="mb-c" style={{flex:m.carbs||1}}></div><div className="mb-f" style={{flex:m.fat||1}}></div></div><div className="mcard-bottom"><div className="mcard-macros"><span className="mm-p">{m.protein}g P</span><span className="mm-c">{m.carbs}g C</span><span className="mm-f">{m.fat}g F</span></div><button className="mcard-log" onClick={e=>{e.stopPropagation();addToLog(m)}}>+ Log</button></div></div>)})}</div>))}
              </div>))})()}
          </div>
        </div>
      )}

      {activeTab === 'scan' && (
        <div className="fade-in">
          <div className="tab-top"><h2>Scan Meal</h2></div>
          <div className="upload" onClick={()=>fileInputRef.current?.click()}>{imagePreview?<img src={imagePreview} alt="" className="upload-img"/>:(<div className="upload-inner"><div className="upload-circle"><span>📸</span></div><p className="upload-t">Snap or upload your meal</p><p className="upload-s">AI identifies it and pulls nutrition from today's menu</p></div>)}<input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageUpload} hidden/></div>
          {loading&&<div className="scanning"><div className="scan-dot"></div><p>Analyzing...</p></div>}
          {detected&&!loading&&(<div className="scan-res fade-in"><span className="scan-badge">✅ Identified</span><h3>{detected}</h3>{matchedMeal&&(<div className="mcard highlighted"><div className="mcard-top"><div><div className="mcard-name">{matchedMeal.item_name}</div><div className="mcard-tags"><span className="tag-hall">{matchedMeal.hall}</span><span className="tag-meal">{matchedMeal.meal}</span></div></div><div className="mcard-cal">{matchedMeal.calories}<small>cal</small></div></div><div className="scan-macros">{[{v:matchedMeal.protein,m:50,c:'#22c55e',l:'Protein'},{v:matchedMeal.carbs,m:80,c:'#f59e0b',l:'Carbs'},{v:matchedMeal.fat,m:40,c:'#ef4444',l:'Fat'}].map((d,i)=>(<div key={i} className="scan-macro"><div className="ring-wrap sm"><ProgressRing value={d.v} max={d.m} color={d.c} size={52} stroke={4}/><div className="ring-inner sm"><span>{d.v}g</span></div></div><small>{d.l}</small></div>))}</div><button className="mcard-log full" onClick={()=>addToLog(matchedMeal)}>+ Log This Meal</button></div>)}{!matchedMeal&&<p className="no-match">Not on today's menu — try browsing</p>}</div>)}
          {alternatives.length>0&&(<div className="section fade-in"><h3 className="sec-title">Healthier Swaps</h3>{alternatives.map((a,i)=>(<div key={i} className="alt-row" onClick={()=>setShowDetail(a)}><div><div className="mcard-name">{a.item_name}</div><div className="mcard-macros"><span className="mm-p">{a.protein}g P</span><span className="mm-c">{a.carbs}g C</span><span className="mm-f">{a.fat}g F</span></div></div><div className="alt-nums"><div className="alt-cal">{a.calories}<small>cal</small></div>{matchedMeal&&<div className="alt-save">-{matchedMeal.calories-a.calories}</div>}</div></div>))}</div>)}
          {imagePreview&&!loading&&<button className="btn-outline" onClick={()=>{setImagePreview(null);setDetected(null);setMatchedMeal(null);setAlternatives([]);fileInputRef.current?.click()}}>Scan Another</button>}
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="chat fade-in">
          <div className="chat-head"><div className="chat-av-lg">🐯</div><div><h3>Tiger</h3><span className="chat-status"><div className="live-dot sm"></div> knows today's menu</span></div></div>
          <div className="chat-body">{chatMessages.map((msg,i)=>(<div key={i} className={'cb '+msg.role}>{msg.role==='ai'&&<div className="cb-av">🐯</div>}<div className="cb-text">{msg.text}</div></div>))}{chatLoading&&(<div className="cb ai"><div className="cb-av">🐯</div><div className="cb-text dots"><span></span><span></span><span></span></div></div>)}<div ref={chatEndRef}></div></div>
          {chatMessages.length<=1&&(<div className="chat-suggestions">{chatSuggestions.map((s,i)=>(<button key={i} className="chat-sug" onClick={()=>{setChatMessages(prev=>[...prev,{role:'user',text:s}]);setChatLoading(true);axios.post(API+'/chat',{message:s,context:''}).then(r=>setChatMessages(prev=>[...prev,{role:'ai',text:r.data.response}])).catch(()=>setChatMessages(prev=>[...prev,{role:'ai',text:"connection's being weird, try again"}])).finally(()=>setChatLoading(false))}}>{s}</button>))}</div>)}
          <div className="chat-bar"><input type="text" placeholder="ask about tonight's menu..." value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();sendChat()}}} className="chat-in"/><button className="chat-btn" onClick={sendChat} disabled={!chatInput.trim()}>↑</button></div>
        </div>
      )}

      {/* ─── SETTINGS ─── */}
      {activeTab === 'settings' && (
        <div className="fade-in">
          <div className="tab-top"><h2>Settings</h2></div>

          {settingsMsg && <div className="toast fade-in">{settingsMsg}</div>}

          <div className="settings-section">
            <div className="settings-profile-card">
              <div className="settings-avatar">{(profile?.name || user?.email || '?')[0].toUpperCase()}</div>
              <div>
                <div className="settings-profile-name">{profile?.name || 'Tiger'}</div>
                <div className="settings-profile-email">{user?.id === 'guest' ? 'Guest' : user?.email}</div>
              </div>
            </div>
          </div>

          {user?.id !== 'guest' && (
            <div className="settings-section">
              <h3 className="sec-title">Profile</h3>
              <div className="settings-row">
                <input type="text" placeholder="Your name" value={settingsName} onChange={e => setSettingsName(e.target.value)} className="auth-input" />
                <button className="settings-save" onClick={updateName}>Save</button>
              </div>
            </div>
          )}

          <div className="settings-section">
            <h3 className="sec-title">Nutrition Goal</h3>
            <div className="goal-grid">
              {[
                { key: 'cut', icon: '🔥', label: 'Cut', desc: '1800 cal · 180g protein' },
                { key: 'maintain', icon: '⚖️', label: 'Maintain', desc: '2200 cal · 150g protein' },
                { key: 'bulk', icon: '💪', label: 'Bulk', desc: '2800 cal · 180g protein' },
              ].map(g => (
                <button key={g.key} className={'goal-btn' + (settingsGoal === g.key ? ' on' : '')} onClick={() => updateGoal(g.key)}>
                  <span className="goal-icon">{g.icon}</span>
                  <span className="goal-label">{g.label}</span>
                  <span className="goal-desc">{g.desc}</span>
                </button>
              ))}
            </div>
            <div className="settings-macros">
              <div className="sm-item"><span className="sm-label">Calories</span><span className="sm-val">{goals.calorie_goal}</span></div>
              <div className="sm-item"><span className="sm-label">Protein</span><span className="sm-val">{goals.protein_goal}g</span></div>
              <div className="sm-item"><span className="sm-label">Carbs</span><span className="sm-val">{goals.carbs_goal}g</span></div>
              <div className="sm-item"><span className="sm-label">Fat</span><span className="sm-val">{goals.fat_goal}g</span></div>
            </div>
          </div>

          {user?.id !== 'guest' && (
            <div className="settings-section">
              <h3 className="sec-title">Change Password</h3>
              <div className="settings-row">
                <input type="password" placeholder="New password" value={newPass} onChange={e => setNewPass(e.target.value)} className="auth-input" />
                <button className="settings-save" onClick={changePassword}>Update</button>
              </div>
            </div>
          )}

          {mealHistory.length > 0 && (
            <div className="settings-section">
              <h3 className="sec-title">Recent Meal History</h3>
              <div className="history-list">
                {mealHistory.map((m, i) => {
                  const d = new Date(m.logged_at)
                  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                  return (
                    <div key={i} className="history-item">
                      <div>
                        <div className="log-name">{m.item_name}</div>
                        <div className="log-meta">{m.hall} · {m.calories} cal · {dateStr} {timeStr}</div>
                      </div>
                      <div className="history-macros">
                        <span className="mm-p">{m.protein}g P</span>
                        <span className="mm-f">{m.fat}g F</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="settings-section">
            <h3 className="sec-title">About</h3>
            <div className="settings-about">
              <div className="md-row"><span>Version</span><span>2.0.0</span></div>
              <div className="md-row"><span>Built by</span><span>Sai Ganesh</span></div>
              <div className="md-row"><span>Data source</span><span>Clemson MyDiningHub</span></div>
            </div>
          </div>

          <div className="settings-section">
            {user?.id !== 'guest' && (
              <>
                <button className="btn-outline" onClick={handleLogout}>Log Out</button>
                <button className="btn-danger" onClick={() => setShowDeleteConfirm(true)}>Delete Account</button>
              </>
            )}
            {user?.id === 'guest' && (
              <button className="auth-btn" onClick={() => { setUser(null); setAuthMode('signup') }}>Create Account</button>
            )}
          </div>

          {showDeleteConfirm && (
            <div className="overlay" onClick={() => setShowDeleteConfirm(false)}>
              <div className="modal fade-in" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', padding: '32px 24px' }}>
                <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>Delete Account?</h2>
                <p style={{ color: '#888', fontSize: '.85rem', marginBottom: 20 }}>This will permanently delete your account and all meal history. This can't be undone.</p>
                <button className="btn-danger" onClick={deleteAccount}>Yes, Delete Everything</button>
                <button className="btn-outline" style={{ marginTop: 8 }} onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {showDetail && (
        <div className="overlay" onClick={()=>{setShowDetail(null);setAlternatives([])}}>
          <div className="modal fade-in" onClick={e=>e.stopPropagation()}>
            <button className="modal-x" onClick={()=>{setShowDetail(null);setAlternatives([])}}>✕</button>
            <h2>{showDetail.item_name}</h2>
            <div className="mcard-tags" style={{marginBottom:12}}><span className="tag-hall">{showDetail.hall}</span><span className="tag-meal">{showDetail.meal}</span>{showDetail.station&&<span className="tag-station">{showDetail.station}</span>}</div>
            {showDetail.description&&<p className="modal-desc">{showDetail.description}</p>}
            <div className="modal-cal">{showDetail.calories}<small> cal</small></div>
            {showDetail.serving&&<div className="modal-serving">Serving: {showDetail.serving}</div>}
            <div className="modal-rings">{[{v:showDetail.protein,m:50,c:'#22c55e',l:'Protein'},{v:showDetail.carbs,m:80,c:'#f59e0b',l:'Carbs'},{v:showDetail.fat,m:40,c:'#ef4444',l:'Fat'}].map((d,i)=>(<div key={i} className="mr"><div className="ring-wrap"><ProgressRing value={d.v} max={d.m} color={d.c}/><div className="ring-inner"><span className="ring-pct">{d.v}g</span></div></div><span>{d.l}</span></div>))}</div>
            <div className="modal-details">{showDetail.sodium!=null&&<div className="md-row"><span>Sodium</span><span>{showDetail.sodium}mg</span></div>}{showDetail.fiber!=null&&<div className="md-row"><span>Fiber</span><span>{showDetail.fiber}g</span></div>}{showDetail.sugar!=null&&<div className="md-row"><span>Sugar</span><span>{showDetail.sugar}g</span></div>}{showDetail.saturated_fat!=null&&<div className="md-row"><span>Sat. Fat</span><span>{showDetail.saturated_fat}g</span></div>}{showDetail.cholesterol!=null&&<div className="md-row"><span>Cholesterol</span><span>{showDetail.cholesterol}mg</span></div>}</div>
            {showDetail.allergens&&showDetail.allergens.replace('Contains:','').trim().length>0&&(<div className="modal-allergens">⚠️ {showDetail.allergens}</div>)}
            <button className="mcard-log full" onClick={()=>{addToLog(showDetail);setShowDetail(null);setAlternatives([])}}>+ Log This Meal</button>
            {alternatives.length>0&&(<div style={{marginTop:20}}><h4 style={{marginBottom:8,fontSize:'.85rem',color:'#999',textTransform:'uppercase',letterSpacing:'1px'}}>Healthier Swaps</h4>{alternatives.map((a,i)=>(<div key={i} className="alt-row" onClick={()=>{setShowDetail(a);getHealthier(a)}}><div><div className="mcard-name">{a.item_name}</div><div className="mcard-macros"><span className="mm-p">{a.protein}g P</span><span className="mm-c">{a.carbs}g C</span><span className="mm-f">{a.fat}g F</span></div></div><div className="alt-nums"><div className="alt-cal">{a.calories}<small>cal</small></div><div className="alt-save">-{showDetail.calories-a.calories}</div></div></div>))}</div>)}
          </div>
        </div>
      )}

      <nav className="bnav">
        {[{i:'🏠',l:'Home',t:'home'},{i:'🍽️',l:'Menu',t:'search'}].map(n=>(<button key={n.t} className={activeTab===n.t?'on':''} onClick={()=>setActiveTab(n.t)}><span className="ni">{n.i}</span><span className="nl">{n.l}</span></button>))}
        <button className={'scan-fab'+(activeTab==='scan'?' on':'')} onClick={()=>setActiveTab('scan')}><span>📸</span></button>
        {[{i:'💬',l:'Tiger',t:'chat'},{i:'👤',l:'Profile',t:'settings'}].map(n=>(<button key={n.l} className={activeTab===n.t?'on':''} onClick={()=>setActiveTab(n.t)}><span className="ni">{n.i}</span><span className="nl">{n.l}</span></button>))}
      </nav>
    </div>
  )
}

export default App
