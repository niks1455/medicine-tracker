import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function App() {
  const [screen, setScreen] = useState('login')
  const [user, setUser] = useState(null)
  const [medicines, setMedicines] = useState([])
  const [doseLogs, setDoseLogs] = useState([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMsg, setAuthMsg] = useState('')
  const [medName, setMedName] = useState('')
  const [endDate, setEndDate] = useState('')
  const [freq, setFreq] = useState('daily')
  const [selectedDays, setSelectedDays] = useState([])
  const [selectedDates, setSelectedDates] = useState([])
  const [doseEntries, setDoseEntries] = useState([])
  const [editingMed, setEditingMed] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setUser(session.user); setScreen('home') }
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) { setUser(session.user); setScreen('home') }
      else { setUser(null); setScreen('login') }
    })
  }, [])

  useEffect(() => {
    if (user) { fetchMedicines(); fetchLogs() }
  }, [user])

  const today = () => new Date().toISOString().slice(0, 10)

  const todayDayName = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return days[new Date().getDay()]
  }

  const todayDate = () => new Date().getDate()

  function isMedicineDueToday(med) {
    if (med.frequency === 'daily') return true
    if (med.frequency === 'weekly') {
      return (med.days || []).includes(todayDayName())
    }
    if (med.frequency === 'monthly') {
      return (med.dates || []).includes(todayDate())
    }
    return true
  }

  async function fetchMedicines() {
    const { data: meds } = await supabase.from('medicines').select('*, doses(*)')
    setMedicines(meds || [])
  }

  async function fetchLogs() {
    const { data: logs } = await supabase.from('dose_logs').select('*').eq('taken_date', today())
    setDoseLogs(logs || [])
  }

  async function signUp() {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setAuthMsg(error.message)
    else setAuthMsg('Account created! Please sign in.')
  }

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setAuthMsg(error.message)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function saveMedicine() {
    if (!medName.trim()) { alert('Please enter a medicine name'); return }
    const confirmedDoses = doseEntries.filter(d => !d.editing)
    if (!confirmedDoses.length) { alert('Please add at least one dose time'); return }

    let medId
    if (editingMed) {
      await supabase.from('medicines').update({
        name: medName, frequency: freq, days: selectedDays,
        dates: selectedDates, end_date: endDate || null
      }).eq('id', editingMed.id)
      await supabase.from('doses').delete().eq('medicine_id', editingMed.id)
      medId = editingMed.id
    } else {
      const { data } = await supabase.from('medicines').insert({
        name: medName, frequency: freq, days: selectedDays,
        dates: selectedDates, end_date: endDate || null, user_id: user.id
      }).select().single()
      medId = data.id
    }

    await supabase.from('doses').insert(
      confirmedDoses.map(d => ({ medicine_id: medId, time: d.time, ampm: d.ampm }))
    )
    await fetchMedicines()
    resetForm()
    setScreen('home')
  }

  async function deleteMedicine(id) {
    if (!confirm('Delete this medicine?')) return
    await supabase.from('medicines').delete().eq('id', id)
    await fetchMedicines()
  }

  async function toggleTaken(med, dose) {
    const existing = doseLogs.find(l => l.dose_id === dose.id)
    if (existing) {
      await supabase.from('dose_logs').update({ taken: !existing.taken }).eq('id', existing.id)
    } else {
      await supabase.from('dose_logs').insert({
        user_id: user.id, medicine_id: med.id, dose_id: dose.id,
        taken_date: today(), taken: true
      })
    }
    await fetchLogs()
  }

  function isTaken(doseId) {
    const log = doseLogs.find(l => l.dose_id === doseId)
    return log?.taken || false
  }

  function resetForm() {
    setMedName(''); setEndDate(''); setFreq('daily')
    setSelectedDays([]); setSelectedDates([]); setDoseEntries([])
    setEditingMed(null)
  }

  function startEdit(med) {
    setEditingMed(med)
    setMedName(med.name)
    setEndDate(med.end_date || '')
    setFreq(med.frequency)
    setSelectedDays(med.days || [])
    setSelectedDates(med.dates || [])
    setDoseEntries((med.doses || []).map(d => ({ time: d.time, ampm: d.ampm, editing: false })))
    setScreen('add')
  }

  function toggleDay(day) {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  function toggleDate(date) {
    setSelectedDates(prev => prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date])
  }

  function addDoseEntry() {
    setDoseEntries(prev => [...prev, { time: '08:00', ampm: 'AM', editing: true }])
  }

  function confirmDose(i) {
    setDoseEntries(prev => prev.map((d, idx) => idx === i ? { ...d, editing: false } : d))
  }

  function updateDose(i, field, value) {
    setDoseEntries(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: value } : d))
  }

  function editDose(i) {
    setDoseEntries(prev => prev.map((d, idx) => idx === i ? { ...d, editing: true } : d))
  }

  function deleteDose(i) {
    setDoseEntries(prev => prev.filter((_, idx) => idx !== i))
  }

  const daysList = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const dayLabels = ['M', 'T', 'W', 'Th', 'F', 'S', 'Su']

  const dueMedicines = medicines.filter(isMedicineDueToday)

  const s = {
    container: { maxWidth: 400, margin: '0 auto', fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#fff' },
    topbar: { padding: '14px 16px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 17, fontWeight: 600, margin: 0 },
    iconBtn: { width: 34, height: 34, borderRadius: 8, border: '1px solid #ddd', background: 'transparent', cursor: 'pointer', fontSize: 16 },
    screen: { padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
    label: { fontSize: 12, color: '#888', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' },
    input: { height: 38, border: '1px solid #ddd', borderRadius: 8, padding: '0 10px', fontSize: 14, width: '100%', boxSizing: 'border-box' },
    card: { border: '1px solid #eee', borderRadius: 12, padding: 14 },
    row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f5f5f5' },
    medName: { fontSize: 15, fontWeight: 600 },
    medTime: { fontSize: 13, color: '#888' },
    tickBtn: (taken) => ({ width: 34, height: 34, borderRadius: '50%', border: taken ? '2px solid #1D9E75' : '2px solid #ddd', background: taken ? '#E1F5EE' : 'transparent', cursor: 'pointer', fontSize: 16, color: taken ? '#1D9E75' : 'transparent', flexShrink: 0 }),
    freqTabs: { display: 'flex', gap: 6 },
    freqTab: (active) => ({ flex: 1, height: 34, border: active ? '1px solid #378ADD' : '1px solid #ddd', borderRadius: 8, background: active ? '#E6F1FB' : 'transparent', cursor: 'pointer', fontSize: 13, color: active ? '#185FA5' : '#888', fontWeight: active ? 600 : 400 }),
    dayBtn: (sel) => ({ width: 38, height: 38, borderRadius: '50%', border: sel ? '1px solid #378ADD' : '1px solid #ddd', background: sel ? '#378ADD' : 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: sel ? '#fff' : '#888' }),
    dateBtn: (sel) => ({ width: 34, height: 34, borderRadius: 8, border: sel ? '1px solid #378ADD' : '1px solid #ddd', background: sel ? '#378ADD' : 'transparent', cursor: 'pointer', fontSize: 12, color: sel ? '#fff' : '#888' }),
    doseRow: { display: 'flex', alignItems: 'center', gap: 8, background: '#f9f9f9', borderRadius: 8, padding: '8px 10px' },
    btnPrimary: { height: 38, background: '#185FA5', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%' },
    btnSecondary: { height: 38, background: 'transparent', color: '#888', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, cursor: 'pointer', width: '100%' },
    btnAdd: { display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px dashed #ddd', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: '#888', width: '100%' },
    authBox: { maxWidth: 400, margin: '60px auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 },
    manageRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f9f9f9', borderRadius: 8, padding: '10px 12px' },
  }

  if (screen === 'login') return (
    <div style={s.authBox}>
      <h2 style={{ textAlign: 'center', marginBottom: 8 }}>Medicine Tracker</h2>
      <p style={{ textAlign: 'center', color: '#888', fontSize: 14, marginBottom: 8 }}>Sign in or create an account</p>
      <input style={s.input} placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} type="email" />
      <input style={s.input} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} type="password" />
      {authMsg && <p style={{ color: authMsg.includes('created') ? 'green' : 'red', fontSize: 13 }}>{authMsg}</p>}
      <button style={s.btnPrimary} onClick={signIn}>Sign in</button>
      <button style={s.btnSecondary} onClick={signUp}>Create account</button>
    </div>
  )

  if (screen === 'home') return (
    <div style={s.container}>
      <div style={s.topbar}>
        <h2 style={s.title}>My medicines</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.iconBtn} onClick={() => { resetForm(); setScreen('add') }}>+</button>
          <button style={s.iconBtn} onClick={() => setScreen('manage')}>✏️</button>
          <button style={s.iconBtn} onClick={signOut} title="Sign out">↩</button>
        </div>
      </div>
      <div style={s.screen}>
        {dueMedicines.length === 0
          ? <div style={{ textAlign: 'center', padding: '40px 20px', color: '#aaa' }}>
              {medicines.length === 0 ? 'No medicines yet. Tap + to add one.' : 'No medicines due today!'}
            </div>
          : <div style={s.card}>
              {dueMedicines.flatMap(med =>
                (med.doses || []).map(dose => (
                  <div key={dose.id} style={s.row}>
                    <div>
                      <div style={s.medName}>{med.name}</div>
                      <div style={s.medTime}>{dose.time} {dose.ampm}</div>
                    </div>
                    <button style={s.tickBtn(isTaken(dose.id))} onClick={() => toggleTaken(med, dose)}>✓</button>
                  </div>
                ))
              )}
            </div>
        }
      </div>
    </div>
  )

  if (screen === 'manage') return (
    <div style={s.container}>
      <div style={s.topbar}>
        <h2 style={s.title}>Manage medicines</h2>
      </div>
      <div style={s.screen}>
        {medicines.length === 0
          ? <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>No medicines added yet.</div>
          : medicines.map(med => (
            <div key={med.id} style={s.manageRow}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{med.name}</div>
                <div style={{ fontSize: 13, color: '#888' }}>{med.frequency} · {(med.doses || []).length} dose(s)</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ ...s.iconBtn, fontSize: 14 }} onClick={() => startEdit(med)}>✏️</button>
                <button style={{ ...s.iconBtn, fontSize: 14, color: '#c00' }} onClick={() => deleteMedicine(med.id)}>🗑</button>
              </div>
            </div>
          ))
        }
        <button style={s.btnSecondary} onClick={() => setScreen('home')}>Back</button>
      </div>
    </div>
  )

  if (screen === 'add') return (
    <div style={s.container}>
      <div style={s.topbar}>
        <h2 style={s.title}>{editingMed ? 'Edit medicine' : 'Add medicine'}</h2>
      </div>
      <div style={s.screen}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={s.label}>Medicine name</span>
          <input style={s.input} placeholder="e.g. Metformin 500mg" value={medName} onChange={e => setMedName(e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={s.label}>End date</span>
          <input style={s.input} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={s.label}>Frequency</span>
          <div style={s.freqTabs}>
            {['daily', 'weekly', 'monthly'].map(f => (
              <button key={f} style={s.freqTab(freq === f)} onClick={() => setFreq(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {freq === 'weekly' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={s.label}>Select days</span>
            <div style={{ display: 'flex', gap: 5 }}>
              {daysList.map((day, i) => (
                <button key={day} style={s.dayBtn(selectedDays.includes(day))} onClick={() => toggleDay(day)}>
                  {dayLabels[i]}
                </button>
              ))}
            </div>
          </div>
        )}

        {freq === 'monthly' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={s.label}>Select dates</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                <button key={d} style={s.dateBtn(selectedDates.includes(d))} onClick={() => toggleDate(d)}>{d}</button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={s.label}>Dose times</span>
          {doseEntries.map((dose, i) => (
            <div key={i}>
              {dose.editing ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#f9f9f9', borderRadius: 8, padding: 10 }}>
                  <input style={{ ...s.input, width: 80, textAlign: 'center' }} placeholder="HH:MM" value={dose.time} onChange={e => updateDose(i, 'time', e.target.value)} />
                  <select style={{ ...s.input, width: 76 }} value={dose.ampm} onChange={e => updateDose(i, 'ampm', e.target.value)}>
                    <option>AM</option><option>PM</option>
                  </select>
                  <button style={{ ...s.btnPrimary, width: 'auto', padding: '0 14px', flexShrink: 0 }} onClick={() => confirmDose(i)}>Add</button>
                </div>
              ) : (
                <div style={s.doseRow}>
                  <span style={{ flex: 1, fontSize: 14, color: '#555' }}>{dose.time} {dose.ampm}</span>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15 }} onClick={() => editDose(i)}>✏️</button>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15 }} onClick={() => deleteDose(i)}>🗑</button>
                </div>
              )}
            </div>
          ))}
          <button style={s.btnAdd} onClick={addDoseEntry}><span style={{ fontSize: 16 }}>+</span> Add another dose</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button style={s.btnSecondary} onClick={() => { resetForm(); setScreen('home') }}>Cancel</button>
          <button style={s.btnPrimary} onClick={saveMedicine}>Save medicine</button>
        </div>
      </div>
    </div>
  )
}
