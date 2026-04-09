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
  const [onboardStep, setOnboardStep] = useState(0)
  const [onboardGender, setOnboardGender] = useState('')
  const [onboardAge, setOnboardAge] = useState('')
  const [onboardFt, setOnboardFt] = useState('')
  const [onboardIn, setOnboardIn] = useState('')
  const [onboardLbs, setOnboardLbs] = useState('')
  const [onboardActivity, setOnboardActivity] = useState('moderate')
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
  const [userStats, setUserStats] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [allRatings, setAllRatings] = useState({})
  const [myRatings, setMyRatings] = useState({})
  const [favorites, setFavorites] = useState({})
  const [isAdminRoute, setIsAdminRoute] = useState(window.location.hash === '#admin')
  const [adminStats, setAdminStats] = useState(null)
  const [adminTopItems, setAdminTopItems] = useState([])
  const [adminRecentUsers, setAdminRecentUsers] = useState([])

  useEffect(() => {
    const handler = () => setIsAdminRoute(window.location.hash === '#admin')
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])
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

  const calculateMacros = (gender, age, heightCm, weightKg, activity, goal) => {
    // Mifflin-St Jeor BMR
    const bmr = gender === 'male'
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161
    const activityMult = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, athlete: 1.9 }[activity] || 1.55
    const tdee = bmr * activityMult
    const goalAdjust = { cut: -500, maintain: 0, bulk: 400 }[goal] || 0
    const cals = Math.round(tdee + goalAdjust)
    // Protein: 1g per lb bodyweight (cut/bulk), 0.8g maintain
    const proteinPerLb = goal === 'maintain' ? 0.8 : 1.0
    const protein = Math.round(weightKg * 2.205 * proteinPerLb)
    // Fat: 25% of calories
    const fat = Math.round((cals * 0.25) / 9)
    // Carbs: remainder
    const carbs = Math.round((cals - (protein * 4) - (fat * 9)) / 4)
    return { calorie_goal: cals, protein_goal: protein, carbs_goal: carbs, fat_goal: fat }
  }

  const handleOnboarding = async () => {
    const heightCm = Math.round((parseInt(onboardFt) * 12 + parseInt(onboardIn)) * 2.54)
    const weightKg = parseFloat(onboardLbs) / 2.205
    const macros = calculateMacros(onboardGender, parseInt(onboardAge), heightCm, weightKg, onboardActivity, onboardGoal)
    await supabase.from('profiles').update({
      name: authName || null,
      goal: onboardGoal,
      gender: onboardGender,
      age: parseInt(onboardAge),
      height_cm: heightCm,
      weight_kg: weightKg,
      activity: onboardActivity,
      ...macros
    }).eq('id', user.id)
    setProfile({ ...profile, name: authName, goal: onboardGoal, gender: onboardGender, age: parseInt(onboardAge), height_cm: heightCm, weight_kg: weightKg, activity: onboardActivity, ...macros })
    setAuthMode('done')
  }

  const handleLogout = async () => { await supabase.auth.signOut(); setUser(null); setProfile(null); setDailyLog([]); setActiveTab('home') }

  const updateGoal = async (newGoal) => {
    let macros
    if (profile?.height_cm && profile?.weight_kg && profile?.age && profile?.gender) {
      macros = calculateMacros(profile.gender, profile.age, profile.height_cm, profile.weight_kg, profile.activity || 'moderate', newGoal)
    } else {
      macros = { cut: { calorie_goal: 1800, protein_goal: 180, carbs_goal: 150, fat_goal: 60 }, maintain: { calorie_goal: 2200, protein_goal: 150, carbs_goal: 250, fat_goal: 70 }, bulk: { calorie_goal: 2800, protein_goal: 180, carbs_goal: 350, fat_goal: 80 } }[newGoal]
    }
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
    const { data } = await supabase.from('meal_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }).limit(500)
    if (data) {
      setMealHistory(data.slice(0, 50))
      
      // Calculate stats
      const totalMeals = data.length
      const totalCal = data.reduce((s, m) => s + (m.calories || 0), 0)
      const totalPro = data.reduce((s, m) => s + (m.protein || 0), 0)
      const avgCal = totalMeals > 0 ? Math.round(totalCal / totalMeals) : 0
      
      // Days logged (unique dates)
      const uniqueDays = new Set(data.map(m => m.logged_at?.split('T')[0])).size
      const avgCalPerDay = uniqueDays > 0 ? Math.round(totalCal / uniqueDays) : 0
      const avgProPerDay = uniqueDays > 0 ? Math.round(totalPro / uniqueDays) : 0
      
      // Current streak — consecutive days with at least one logged meal, ending today or yesterday
      const dateSet = new Set(data.map(m => m.logged_at?.split('T')[0]))
      let streak = 0
      const today = new Date()
      let checkDate = new Date(today)
      // Allow streak to start from today or yesterday
      const todayStr = today.toISOString().split('T')[0]
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]
      if (!dateSet.has(todayStr) && !dateSet.has(yesterdayStr)) {
        streak = 0
      } else {
        if (!dateSet.has(todayStr)) checkDate = yesterday
        while (dateSet.has(checkDate.toISOString().split('T')[0])) {
          streak++
          checkDate.setDate(checkDate.getDate() - 1)
        }
      }
      
      // Top hall and top item
      const hallCount = {}
      const itemCount = {}
      data.forEach(m => {
        hallCount[m.hall] = (hallCount[m.hall] || 0) + 1
        itemCount[m.item_name] = (itemCount[m.item_name] || 0) + 1
      })
      const topHall = Object.entries(hallCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
      const topItem = Object.entries(itemCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
      
      setUserStats({ totalMeals, avgCal, avgCalPerDay, avgProPerDay, streak, totalPro, uniqueDays, topHall, topItem })
    }
  }

  useEffect(() => { if (activeTab === 'settings') { setSettingsGoal(profile?.goal || 'maintain'); setSettingsName(profile?.name || ''); loadHistory() } }, [activeTab])

  // Load all ratings (community averages) and user's own ratings
  const loadRatings = async () => {
    const { data: all } = await supabase.from('ratings').select('item_name, rating')
    if (all) {
      const agg = {}
      all.forEach(r => {
        if (!agg[r.item_name]) agg[r.item_name] = { sum: 0, count: 0 }
        agg[r.item_name].sum += r.rating
        agg[r.item_name].count += 1
      })
      const result = {}
      Object.entries(agg).forEach(([k, v]) => { result[k] = { avg: v.sum / v.count, count: v.count } })
      setAllRatings(result)
    }
    if (user && user.id !== 'guest') {
      const { data: mine } = await supabase.from('ratings').select('item_name, rating').eq('user_id', user.id)
      if (mine) {
        const m = {}
        mine.forEach(r => { m[r.item_name] = r.rating })
        setMyRatings(m)
      }
    }
  }

  useEffect(() => { if (user) loadRatings() }, [user])

  const loadFavorites = async () => {
    if (!user || user.id === 'guest') return
    const { data } = await supabase.from('favorites').select('item_name, hall').eq('user_id', user.id)
    if (data) {
      const f = {}
      data.forEach(fav => { f[fav.item_name] = { hall: fav.hall } })
      setFavorites(f)
    }
  }

  useEffect(() => { if (user) loadFavorites() }, [user])

  const toggleFavorite = async (meal) => {
    if (!user || user.id === 'guest') { setLogToast('Sign up to save favorites'); setTimeout(()=>setLogToast(null),2000); return }
    const isFav = !!favorites[meal.item_name]
    if (isFav) {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('item_name', meal.item_name)
      setFavorites(prev => { const next = {...prev}; delete next[meal.item_name]; return next })
    } else {
      await supabase.from('favorites').insert({ user_id: user.id, item_name: meal.item_name, hall: meal.hall })
      setFavorites(prev => ({ ...prev, [meal.item_name]: { hall: meal.hall } }))
      setLogToast('Added to favorites'); setTimeout(()=>setLogToast(null),1500)
    }
  }

  const loadAdminData = async () => {
    const { data: stats } = await supabase.from('admin_stats').select('*').single()
    if (stats) setAdminStats(stats)

    const { data: logs } = await supabase.from('meal_logs').select('item_name, hall, calories').limit(1000)
    if (logs) {
      const itemCount = {}
      logs.forEach(l => { itemCount[l.item_name] = (itemCount[l.item_name] || 0) + 1 })
      const top = Object.entries(itemCount).sort((a,b)=>b[1]-a[1]).slice(0, 10).map(([name, count]) => ({ name, count }))
      setAdminTopItems(top)
    }

    const { data: profiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(10)
    if (profiles) setAdminRecentUsers(profiles)
  }

  useEffect(() => { if (isAdminRoute && user) loadAdminData() }, [isAdminRoute, user])

  const submitRating = async (itemName, hall, rating) => {
    if (!user || user.id === 'guest') { setLogToast('Sign up to rate meals'); setTimeout(()=>setLogToast(null),2000); return }
    setMyRatings(prev => ({ ...prev, [itemName]: rating }))
    // Update local community average optimistically
    setAllRatings(prev => {
      const existing = prev[itemName] || { avg: 0, count: 0 }
      const oldMine = myRatings[itemName]
      let newSum, newCount
      if (oldMine) {
        newSum = (existing.avg * existing.count) - oldMine + rating
        newCount = existing.count
      } else {
        newSum = (existing.avg * existing.count) + rating
        newCount = existing.count + 1
      }
      return { ...prev, [itemName]: { avg: newSum / newCount, count: newCount } }
    })
    await supabase.from('ratings').upsert({ user_id: user.id, item_name: itemName, hall, rating }, { onConflict: 'user_id,item_name' })
  }

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

  const StarRating = ({ itemName, hall, size = 'lg' }) => {
    const myRating = myRatings[itemName] || 0
    const community = allRatings[itemName]
    return (
      <div className="rating-block">
        <div className="rating-row">
          <span className="rating-label">Your rating</span>
          <div className={'stars ' + size}>
            {[1,2,3,4,5].map(n => (
              <button key={n} className={'star' + (n <= myRating ? ' on' : '')} onClick={(e) => { e.stopPropagation(); submitRating(itemName, hall, n) }}>★</button>
            ))}
          </div>
        </div>
        {community && community.count > 0 && (
          <div className="rating-row">
            <span className="rating-label">Community</span>
            <div className="community-rating">
              <span className="cr-stars">{'★'.repeat(Math.round(community.avg))}{'☆'.repeat(5 - Math.round(community.avg))}</span>
              <span className="cr-num">{community.avg.toFixed(1)}</span>
              <span className="cr-count">({community.count})</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (showSplash) return (<div className="splash"><div className="splash-bg"></div><div className="splash-content"><div className="splash-icon">🐾</div><h1>Tiger<span>Plate</span></h1><p>eat smarter at clemson</p><div className="splash-loader"><div className="splash-bar"></div></div></div></div>)
  if (checkingAuth) return (<div className="splash"><div className="splash-content"><div className="splash-icon">🐾</div><p>Loading...</p></div></div>)

  if (isAdminRoute) {
    if (!user || user.id === 'guest' || user.email !== 'prasanna1549@icloud.com') {
      return (<div className="splash"><div className="splash-content"><div className="splash-icon">🔒</div><h1>Admin Only</h1><p>{!user ? 'Log in first' : user.email !== 'prasanna1549@icloud.com' ? 'Not authorized' : 'Loading...'}</p><button className="auth-btn" style={{marginTop:20,maxWidth:200}} onClick={()=>{window.location.hash='';window.location.reload()}}>← Back to app</button></div></div>)
    }
    return (
      <div className="app">
        <div className="fade-in">
          <header className="home-header">
            <div>
              <p className="greeting">Admin Dashboard</p>
              <h1 className="home-title">Tiger<span>Plate</span></h1>
            </div>
            <button className="btn-outline" style={{padding:'8px 14px',width:'auto'}} onClick={()=>{window.location.hash='';window.location.reload()}}>Exit</button>
          </header>

          {adminStats && (
            <>
              <div className="admin-grid">
                <div className="admin-stat">
                  <div className="as-icon">👥</div>
                  <div className="as-num">{adminStats.total_users}</div>
                  <div className="as-label">Total Users</div>
                </div>
                <div className="admin-stat">
                  <div className="as-icon">🍽️</div>
                  <div className="as-num">{adminStats.total_meals_logged}</div>
                  <div className="as-label">Meals Logged</div>
                </div>
                <div className="admin-stat">
                  <div className="as-icon">🔥</div>
                  <div className="as-num">{adminStats.active_users_24h}</div>
                  <div className="as-label">Active 24h</div>
                </div>
                <div className="admin-stat">
                  <div className="as-icon">📊</div>
                  <div className="as-num">{adminStats.active_users_7d}</div>
                  <div className="as-label">Active 7d</div>
                </div>
                <div className="admin-stat">
                  <div className="as-icon">📝</div>
                  <div className="as-num">{adminStats.meals_logged_24h}</div>
                  <div className="as-label">Logs 24h</div>
                </div>
                <div className="admin-stat">
                  <div className="as-icon">⭐</div>
                  <div className="as-num">{adminStats.total_ratings}</div>
                  <div className="as-label">Ratings</div>
                </div>
                <div className="admin-stat">
                  <div className="as-icon">♥</div>
                  <div className="as-num">{adminStats.total_favorites}</div>
                  <div className="as-label">Favorites</div>
                </div>
              </div>

              {adminTopItems.length > 0 && (
                <div className="prof-card">
                  <h3 className="prof-section-title">Top Items (All Time)</h3>
                  {adminTopItems.map((t, i) => (
                    <div key={i} className="admin-row">
                      <span className="admin-rank">{i+1}</span>
                      <span className="admin-name">{t.name}</span>
                      <span className="admin-count">{t.count}×</span>
                    </div>
                  ))}
                </div>
              )}

              {adminRecentUsers.length > 0 && (
                <div className="prof-card">
                  <h3 className="prof-section-title">Recent Signups</h3>
                  {adminRecentUsers.map((u, i) => (
                    <div key={i} className="admin-row">
                      <span className="admin-rank">{i+1}</span>
                      <span className="admin-name">{u.name || 'Unnamed'}</span>
                      <span className="admin-count">{u.goal || '—'}</span>
                    </div>
                  ))}
                </div>
              )}

              <button className="auth-btn" style={{marginBottom:20}} onClick={loadAdminData}>🔄 Refresh</button>
            </>
          )}
        </div>
      </div>
    )
  }

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

  if (user && user.id !== 'guest' && profile && !profile.goal) {
    const steps = ['name', 'gender', 'age', 'height', 'weight', 'activity', 'goal']
    const currentStep = steps[onboardStep]
    const canAdvance = () => {
      if (currentStep === 'name') return true
      if (currentStep === 'gender') return !!onboardGender
      if (currentStep === 'age') return parseInt(onboardAge) >= 13 && parseInt(onboardAge) <= 100
      if (currentStep === 'height') return parseInt(onboardFt) >= 3 && parseInt(onboardFt) <= 8
      if (currentStep === 'weight') return parseFloat(onboardLbs) >= 50 && parseFloat(onboardLbs) <= 500
      if (currentStep === 'activity') return !!onboardActivity
      return true
    }
    return (
    <div className="app auth-page">
      <div className="auth-header"><div className="splash-icon">🐾</div><h1 className="home-title">Tiger<span>Plate</span></h1><p className="auth-sub">step {onboardStep + 1} of {steps.length}</p></div>
      <div className="onboard-progress"><div className="onboard-bar" style={{width: ((onboardStep + 1) / steps.length * 100) + '%'}}></div></div>
      <div className="auth-card">
        {currentStep === 'name' && (<>
          <p className="onboard-q">What should we call you?</p>
          <input type="text" placeholder="Your name (or leave blank)" value={authName} onChange={e=>setAuthName(e.target.value)} className="auth-input" autoFocus />
        </>)}
        {currentStep === 'gender' && (<>
          <p className="onboard-q">Gender</p>
          <p className="onboard-sub">For accurate calorie calculations</p>
          <div className="goal-grid">
            {[{key:'male',icon:'♂️',label:'Male'},{key:'female',icon:'♀️',label:'Female'}].map(g=>(
              <button key={g.key} className={'goal-btn'+(onboardGender===g.key?' on':'')} onClick={()=>setOnboardGender(g.key)}>
                <span className="goal-icon">{g.icon}</span><span className="goal-label">{g.label}</span>
              </button>
            ))}
          </div>
        </>)}
        {currentStep === 'age' && (<>
          <p className="onboard-q">How old are you?</p>
          <input type="number" placeholder="Age" value={onboardAge} onChange={e=>setOnboardAge(e.target.value)} className="auth-input big-num" autoFocus />
        </>)}
        {currentStep === 'height' && (<>
          <p className="onboard-q">How tall are you?</p>
          <div className="height-row">
            <div className="hr-input"><input type="number" placeholder="5" value={onboardFt} onChange={e=>setOnboardFt(e.target.value)} className="auth-input big-num" autoFocus /><span>ft</span></div>
            <div className="hr-input"><input type="number" placeholder="10" value={onboardIn} onChange={e=>setOnboardIn(e.target.value)} className="auth-input big-num" /><span>in</span></div>
          </div>
        </>)}
        {currentStep === 'weight' && (<>
          <p className="onboard-q">What's your weight?</p>
          <div className="hr-input"><input type="number" placeholder="160" value={onboardLbs} onChange={e=>setOnboardLbs(e.target.value)} className="auth-input big-num" autoFocus /><span>lbs</span></div>
        </>)}
        {currentStep === 'activity' && (<>
          <p className="onboard-q">Activity level</p>
          <p className="onboard-sub">Be honest — this matters</p>
          <div className="goal-grid">
            {[
              {key:'sedentary',icon:'🛋️',label:'Sedentary',desc:'Little or no exercise'},
              {key:'light',icon:'🚶',label:'Light',desc:'1-3 days a week'},
              {key:'moderate',icon:'🏃',label:'Moderate',desc:'3-5 days a week'},
              {key:'active',icon:'💪',label:'Active',desc:'6-7 days a week'},
              {key:'athlete',icon:'🔥',label:'Athlete',desc:'Twice a day, intense'},
            ].map(a=>(
              <button key={a.key} className={'goal-btn'+(onboardActivity===a.key?' on':'')} onClick={()=>setOnboardActivity(a.key)}>
                <span className="goal-icon">{a.icon}</span><span className="goal-label">{a.label}</span><span className="goal-desc">{a.desc}</span>
              </button>
            ))}
          </div>
        </>)}
        {currentStep === 'goal' && (<>
          <p className="onboard-q">What's your goal?</p>
          <div className="goal-grid">
            {[{key:'cut',icon:'🔥',label:'Cut',desc:'Lose fat (-500 cal)'},{key:'maintain',icon:'⚖️',label:'Maintain',desc:'Stay where you are'},{key:'bulk',icon:'💪',label:'Bulk',desc:'Build muscle (+400 cal)'}].map(g=>(
              <button key={g.key} className={'goal-btn'+(onboardGoal===g.key?' on':'')} onClick={()=>setOnboardGoal(g.key)}>
                <span className="goal-icon">{g.icon}</span><span className="goal-label">{g.label}</span><span className="goal-desc">{g.desc}</span>
              </button>
            ))}
          </div>
        </>)}
        <div className="onboard-nav">
          {onboardStep > 0 && <button className="btn-outline" onClick={()=>setOnboardStep(s=>s-1)}>← Back</button>}
          {onboardStep < steps.length - 1 && <button className="auth-btn" disabled={!canAdvance()} onClick={()=>setOnboardStep(s=>s+1)}>Next →</button>}
          {onboardStep === steps.length - 1 && <button className="auth-btn" onClick={handleOnboarding}>Calculate My Macros 🎯</button>}
        </div>
      </div>
    </div>
    )
  }

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
          {(() => {
            const favOnMenu = []
            const seenFavs = new Set()
            meals.forEach(m => { if (favorites[m.item_name] && !seenFavs.has(m.item_name)) { seenFavs.add(m.item_name); favOnMenu.push(m) } })
            if (favOnMenu.length === 0) return null
            return (
              <div className="section">
                <div className="picks-header">
                  <div>
                    <h3 className="sec-title" style={{margin:0}}>Your Favorites — Live Now</h3>
                    <p className="picks-sub">{favOnMenu.length} on the menu today</p>
                  </div>
                  <span className="picks-badge">♥</span>
                </div>
                {favOnMenu.slice(0, 5).map((m,i) => (
                  <div key={i} className="fav-card" onClick={() => getHealthier(m)}>
                    <span className="fav-heart">♥</span>
                    <div className="pick-info">
                      <div className="pick-name">{m.item_name}</div>
                      <div className="pick-meta">{m.hall} · {m.station}</div>
                    </div>
                    <div className="pick-cal">{m.calories}<small>cal</small></div>
                  </div>
                ))}
              </div>
            )
          })()}
          {(() => {
            const remCal = goals.calorie_goal - dailyTotals.calories
            const remPro = goals.protein_goal - dailyTotals.protein
            if (remCal < 100 || meals.length === 0) return null
            const targetCal = Math.min(remCal, remCal / 2 + 100)
            const picks = meals
              .filter(m => m.calories > 100 && m.calories < remCal && m.meal?.toLowerCase() === currentMealTime().toLowerCase())
              .map(m => ({ ...m, _score: (m.protein * 4) - Math.abs(m.calories - targetCal) * 0.3 + (m.protein >= remPro * 0.3 ? 50 : 0) }))
              .sort((a, b) => b._score - a._score)
              .slice(0, 3)
            if (picks.length === 0) return null
            return (
              <div className="section">
                <div className="picks-header">
                  <div>
                    <h3 className="sec-title" style={{margin:0}}>Smart Picks for You</h3>
                    <p className="picks-sub">{remCal} cal · {remPro}g protein left today</p>
                  </div>
                  <span className="picks-badge">🎯</span>
                </div>
                {picks.map((m,i) => (
                  <div key={i} className="pick-card" onClick={() => getHealthier(m)}>
                    <div className="pick-rank">{i+1}</div>
                    <div className="pick-info">
                      <div className="pick-name">{m.item_name}</div>
                      <div className="pick-meta">{m.hall} · {m.station}</div>
                      <div className="mcard-macros" style={{marginTop:4}}>
                        <span className="mm-p">{m.protein}g P</span>
                        <span className="mm-c">{m.carbs}g C</span>
                        <span className="mm-f">{m.fat}g F</span>
                      </div>
                    </div>
                    <div className="pick-cal">{m.calories}<small>cal</small></div>
                  </div>
                ))}
              </div>
            )
          })()}
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
                  {items.map(m=>{const i=idx++;const cr=allRatings[m.item_name];return(<div key={i} className="mcard" style={{animationDelay:Math.min(i*0.02,0.4)+'s'}}><div className="mcard-top" onClick={()=>getHealthier(m)}><div><div className="mcard-name">{m.item_name}{cr&&cr.count>0&&<span className="inline-rating">★ {cr.avg.toFixed(1)}</span>}</div>{m.description&&<div className="mcard-desc">{m.description}</div>}</div><div className="mcard-cal">{m.calories}<small>cal</small></div></div><div className="mcard-bar"><div className="mb-p" style={{flex:m.protein||1}}></div><div className="mb-c" style={{flex:m.carbs||1}}></div><div className="mb-f" style={{flex:m.fat||1}}></div></div><div className="mcard-bottom"><div className="mcard-macros"><span className="mm-p">{m.protein}g P</span><span className="mm-c">{m.carbs}g C</span><span className="mm-f">{m.fat}g F</span></div><button className="mcard-log" onClick={e=>{e.stopPropagation();addToLog(m)}}>+ Log</button></div></div>)})}</div>))}
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

      {/* ─── PROFILE ─── */}
      {activeTab === 'settings' && (
        <div className="fade-in">
          {settingsMsg && <div className="toast fade-in">{settingsMsg}</div>}

          {/* Hero profile card */}
          <div className="prof-hero">
            <div className="prof-hero-bg"></div>
            <div className="prof-avatar-lg">{(profile?.name || user?.email || '?')[0].toUpperCase()}</div>
            <h2 className="prof-name">{profile?.name || 'Tiger'}</h2>
            <p className="prof-email">{user?.id === 'guest' ? 'Guest Mode' : user?.email}</p>
            <div className="prof-badge-row">
              <span className="prof-badge">{profile?.goal === 'cut' ? '🔥 Cutting' : profile?.goal === 'bulk' ? '💪 Bulking' : '⚖️ Maintaining'}</span>
              <span className="prof-badge">🐾 Clemson</span>
            </div>
          </div>

          {/* Stats grid */}
          <div className="prof-stats">
            <div className="ps-item">
              <span className="ps-num">{userStats?.streak || 0}<small>🔥</small></span>
              <span className="ps-label">Day Streak</span>
            </div>
            <div className="ps-divider"></div>
            <div className="ps-item">
              <span className="ps-num">{userStats?.totalMeals || 0}</span>
              <span className="ps-label">Meals Logged</span>
            </div>
            <div className="ps-divider"></div>
            <div className="ps-item">
              <span className="ps-num">{userStats?.uniqueDays || 0}</span>
              <span className="ps-label">Days Tracked</span>
            </div>
          </div>

          {userStats && userStats.totalMeals > 0 && (
            <div className="prof-card">
              <h3 className="prof-section-title">Your Stats</h3>
              <div className="stats-grid">
                <div className="stat-tile">
                  <span className="st-icon">📊</span>
                  <div>
                    <div className="st-val">{userStats.avgCalPerDay}</div>
                    <div className="st-label">avg cal / day</div>
                  </div>
                </div>
                <div className="stat-tile">
                  <span className="st-icon">💪</span>
                  <div>
                    <div className="st-val">{userStats.avgProPerDay}g</div>
                    <div className="st-label">avg protein / day</div>
                  </div>
                </div>
                <div className="stat-tile">
                  <span className="st-icon">🏛️</span>
                  <div>
                    <div className="st-val" style={{fontSize:'.85rem'}}>{userStats.topHall}</div>
                    <div className="st-label">favorite hall</div>
                  </div>
                </div>
                <div className="stat-tile">
                  <span className="st-icon">🍽️</span>
                  <div>
                    <div className="st-val" style={{fontSize:'.75rem',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{userStats.topItem}</div>
                    <div className="st-label">most logged</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Macro targets visual */}
          <div className="prof-macros-card">
            <h3 className="prof-section-title">Daily Targets</h3>
            <div className="prof-macro-bars">
              {[
                { l: 'Calories', v: goals.calorie_goal, max: 3000, c: '#F56600', unit: '' },
                { l: 'Protein', v: goals.protein_goal, max: 200, c: '#22c55e', unit: 'g' },
                { l: 'Carbs', v: goals.carbs_goal, max: 400, c: '#f59e0b', unit: 'g' },
                { l: 'Fat', v: goals.fat_goal, max: 100, c: '#ef4444', unit: 'g' },
              ].map((m, i) => (
                <div key={i} className="pmb-row">
                  <span className="pmb-label">{m.l}</span>
                  <div className="pmb-track"><div className="pmb-fill" style={{ width: (m.v / m.max * 100) + '%', background: m.c }}></div></div>
                  <span className="pmb-val" style={{ color: m.c }}>{m.v}{m.unit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Goal selector */}
          <div className="prof-card">
            <h3 className="prof-section-title">Change Goal</h3>
            <div className="prof-goal-pills">
              {[
                { key: 'cut', icon: '🔥', label: 'Cut' },
                { key: 'maintain', icon: '⚖️', label: 'Maintain' },
                { key: 'bulk', icon: '💪', label: 'Bulk' },
              ].map(g => (
                <button key={g.key} className={'pgp' + (settingsGoal === g.key ? ' on' : '')} onClick={() => updateGoal(g.key)}>
                  <span>{g.icon}</span><span>{g.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recent meals */}
          {mealHistory.length > 0 && (
            <div className="prof-card">
              <h3 className="prof-section-title">Recent Activity</h3>
              <div className="prof-history">
                {mealHistory.slice(0, 10).map((m, i) => {
                  const d = new Date(m.logged_at)
                  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                  return (
                    <div key={i} className="ph-item">
                      <div className="ph-dot" style={{ background: m.calories > goals.calorie_goal * 0.3 ? '#F56600' : '#22c55e' }}></div>
                      <div className="ph-info">
                        <div className="ph-name">{m.item_name}</div>
                        <div className="ph-meta">{m.hall} · {dateStr} · {timeStr}</div>
                      </div>
                      <div className="ph-cals">{m.calories}<small>cal</small></div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Account settings */}
          <div className="prof-card">
            <h3 className="prof-section-title">Account</h3>
            {user?.id !== 'guest' && (
              <>
                <div className="prof-field">
                  <label>Display Name</label>
                  <div className="settings-row">
                    <input type="text" placeholder="Your name" value={settingsName} onChange={e => setSettingsName(e.target.value)} className="auth-input" />
                    <button className="settings-save" onClick={updateName}>Save</button>
                  </div>
                </div>
                <div className="prof-field">
                  <label>Password</label>
                  <div className="settings-row">
                    <input type="password" placeholder="New password" value={newPass} onChange={e => setNewPass(e.target.value)} className="auth-input" />
                    <button className="settings-save" onClick={changePassword}>Update</button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* About */}
          <div className="prof-card">
            <h3 className="prof-section-title">About TigerPlate</h3>
            <div className="prof-about">
              <div className="pa-row"><span>Version</span><span>2.0.0</span></div>
              <div className="pa-row"><span>Data</span><span>Live from Clemson Dining</span></div>
              <div className="pa-row"><span>AI</span><span>Gemini 2.5 Flash</span></div>
              <div className="pa-row"><span>Built by</span><span style={{ color: 'var(--o)' }}>Sai Ganesh</span></div>
            </div>
          </div>

          {/* Actions */}
          <div className="prof-actions">
            {user?.id !== 'guest' ? (
              <>
                <button className="prof-logout" onClick={handleLogout}>Log Out</button>
                <button className="prof-delete" onClick={() => setShowDeleteConfirm(true)}>Delete Account</button>
              </>
            ) : (
              <button className="auth-btn" onClick={() => { setUser(null); setAuthMode('signup') }}>Create Account to Save Progress</button>
            )}
          </div>

          {showDeleteConfirm && (
            <div className="overlay" onClick={() => setShowDeleteConfirm(false)}>
              <div className="modal fade-in" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', padding: '32px 24px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
                <h2 style={{ fontSize: '1.1rem', marginBottom: 8 }}>Delete Account?</h2>
                <p style={{ color: '#888', fontSize: '.8rem', marginBottom: 20, lineHeight: 1.5 }}>This permanently deletes your account, meal history, and all data. This can't be undone.</p>
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
            <button className={'modal-fav'+(favorites[showDetail.item_name]?' on':'')} onClick={()=>toggleFavorite(showDetail)}>{favorites[showDetail.item_name]?'♥':'♡'}</button>
            <h2>{showDetail.item_name}</h2>
            <div className="mcard-tags" style={{marginBottom:12}}><span className="tag-hall">{showDetail.hall}</span><span className="tag-meal">{showDetail.meal}</span>{showDetail.station&&<span className="tag-station">{showDetail.station}</span>}</div>
            {showDetail.description&&<p className="modal-desc">{showDetail.description}</p>}
            <div className="modal-cal">{showDetail.calories}<small> cal</small></div>
            {showDetail.serving&&<div className="modal-serving">Serving: {showDetail.serving}</div>}
            <div className="modal-rings">{[{v:showDetail.protein,m:50,c:'#22c55e',l:'Protein'},{v:showDetail.carbs,m:80,c:'#f59e0b',l:'Carbs'},{v:showDetail.fat,m:40,c:'#ef4444',l:'Fat'}].map((d,i)=>(<div key={i} className="mr"><div className="ring-wrap"><ProgressRing value={d.v} max={d.m} color={d.c}/><div className="ring-inner"><span className="ring-pct">{d.v}g</span></div></div><span>{d.l}</span></div>))}</div>
            <div className="modal-details">{showDetail.sodium!=null&&<div className="md-row"><span>Sodium</span><span>{showDetail.sodium}mg</span></div>}{showDetail.fiber!=null&&<div className="md-row"><span>Fiber</span><span>{showDetail.fiber}g</span></div>}{showDetail.sugar!=null&&<div className="md-row"><span>Sugar</span><span>{showDetail.sugar}g</span></div>}{showDetail.saturated_fat!=null&&<div className="md-row"><span>Sat. Fat</span><span>{showDetail.saturated_fat}g</span></div>}{showDetail.cholesterol!=null&&<div className="md-row"><span>Cholesterol</span><span>{showDetail.cholesterol}mg</span></div>}</div>
            {showDetail.allergens&&showDetail.allergens.replace('Contains:','').trim().length>0&&(<div className="modal-allergens">⚠️ {showDetail.allergens}</div>)}
            <StarRating itemName={showDetail.item_name} hall={showDetail.hall} />
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
