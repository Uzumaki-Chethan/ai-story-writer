import { useState, useRef, useEffect } from 'react'
import { jsPDF } from 'jspdf'

export default function StoryWriter({ onBackToHome }){
  const [text, setText] = useState('')
  const [suggestions, setSuggestions] = useState(null)
  const [suggestDone, setSuggestDone] = useState([])
  const [loadingSuggest, setLoadingSuggest] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [completionStreamText, setCompletionStreamText] = useState('')
  const [completionDone, setCompletionDone] = useState(false)
  const [characters, setCharacters] = useState([])
  const [error, setError] = useState('')
  const [wordCount, setWordCount] = useState(0)
  const [charCount, setCharCount] = useState(0)

  const suggestionsRef = useRef(suggestions)
  suggestionsRef.current = suggestions
  const suggestDoneRef = useRef(suggestDone)
  suggestDoneRef.current = suggestDone

  useEffect(() => {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    const chars = text.length
    setWordCount(words)
    setCharCount(chars)
  }, [text])

  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (!loadingSuggest && text.trim()) suggestThreeStream()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && e.shiftKey) {
        e.preventDefault()
        if (!completing && text.trim()) completeStoryStream()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [text, loadingSuggest, completing])

  async function detectCharacters() {
    setError('')
    try {
      const res = await fetch('http://localhost:8000/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: text })
      })
      const data = await res.json()
      
      const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'were', 'are', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once']
      
      let chars = Array.isArray(data.characters) ? data.characters.filter(Boolean) : []
      
      chars = chars.filter(name => {
        const lowerName = name.toLowerCase()
        return name.length > 0 && 
               name[0] === name[0].toUpperCase() && 
               !commonWords.includes(lowerName) &&
               name.length > 1
      })
      
      const uniqueChars = []
      const seen = new Set()
      chars.forEach(char => {
        const lower = char.toLowerCase()
        if (!seen.has(lower)) {
          seen.add(lower)
          uniqueChars.push(char)
        }
      })
      
      setCharacters(uniqueChars)
    } catch (e) {
      setError('Error: ' + e.message)
    }
  }

  async function suggestThreeStream() {
    if (!text.trim()) return
    setError('')
    setLoadingSuggest(true)
    setSuggestions(['', '', ''])
    setSuggestDone([false, false, false])
    
    try {
      const res = await fetch('http://localhost:8000/suggestions_stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: text })
      })
      
      if (!res.ok || !res.body) {
        const errText = await res.text()
        setError('Stream error: ' + errText)
        setLoadingSuggest(false)
        return
      }
      
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        
        let idx
        while ((idx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, idx).trim()
          buffer = buffer.slice(idx + 1)
          if (!line) continue
          
          try {
            const ev = JSON.parse(line)
            if (ev.type === 'chunk') {
              const i = ev.idx
              if (!suggestionsRef.current || suggestionsRef.current[i] === null) continue
              const prev = suggestionsRef.current[i]
              const updated = prev + ev.text
              setSuggestions(prevArr => {
                const base = [...prevArr]
                base[i] = updated
                return base
              })
            } else if (ev.type === 'done') {
              const i = ev.idx
              setSuggestDone(prev => {
                const copy = [...prev]
                copy[i] = true
                return copy
              })
            } else if (ev.type === 'error') {
              const i = ev.idx
              setSuggestions(prevArr => {
                const copy = [...prevArr]
                copy[i] = 'Error: ' + ev.text
                return copy
              })
              setSuggestDone(prev => {
                const copy = [...prev]
                copy[i] = true
                return copy
              })
            }
          } catch (err) {
            console.error('Malformed line:', line, err)
          }
        }
      }
      setLoadingSuggest(false)
    } catch (e) {
      setLoadingSuggest(false)
      setError('Streaming failed: ' + e.message)
    }
  }

  function acceptSuggestion(idx) {
    const s = suggestions?.[idx]
    if (!s) return
    setText(prev => (prev ? prev + '\n\n' + s : s))
    setSuggestions(prev => {
      const copy = [...prev]
      copy[idx] = null
      return copy
    })
    setSuggestDone(prev => {
      const copy = [...prev]
      copy[idx] = false
      return copy
    })
  }

  function discardSuggestion(idx) {
    setSuggestions(prev => {
      const copy = [...prev]
      copy[idx] = null
      return copy
    })
    setSuggestDone(prev => {
      const copy = [...prev]
      copy[idx] = false
      return copy
    })
  }

  async function completeStoryStream() {
    if (!text.trim()) return
    setError('')
    setCompleting(true)
    setCompletionStreamText('')
    setCompletionDone(false)
    
    try {
      const res = await fetch('http://localhost:8000/complete_stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: text })
      })
      
      if (!res.ok || !res.body) {
        const errText = await res.text()
        setError('Stream error: ' + errText)
        setCompleting(false)
        return
      }
      
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        
        let idx
        while ((idx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, idx).trim()
          buffer = buffer.slice(idx + 1)
          if (!line) continue
          
          try {
            const ev = JSON.parse(line)
            if (ev.type === 'chunk') {
              setCompletionStreamText(prev => prev + ev.text)
            } else if (ev.type === 'done') {
              setCompletionDone(true)
            } else if (ev.type === 'error') {
              setCompletionStreamText('Error: ' + ev.text)
              setCompletionDone(true)
            }
          } catch (err) {
            console.error('Malformed line:', line, err)
          }
        }
      }
      setCompleting(false)
    } catch (e) {
      setCompleting(false)
      setError('Streaming failed: ' + e.message)
    }
  }

  function acceptCompletion() {
    if (!completionStreamText) return
    setText(prev => (prev ? prev + '\n\n' + completionStreamText : completionStreamText))
    setCompletionStreamText('')
    setCompletionDone(false)
  }

  function discardCompletion() {
    setCompletionStreamText('')
    setCompletionDone(false)
  }

  function clearTextOnly() {
    setText('')
  }

  function clearSuggestionsOnly() {
    setSuggestions(null)
    setSuggestDone([])
    setCompletionStreamText('')
    setCompletionDone(false)
  }

  function saveAsPdf() {
    if (!text?.trim()) return
    
    const doc = new jsPDF()
    
    doc.setProperties({
      title: 'My Story',
      subject: 'AI Generated Story',
      author: 'AI Co-Story Writer',
      keywords: 'story, AI, creative writing',
      creator: 'AI Co-Story Writer'
    })
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('My Story', 20, 20)
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const date = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
    doc.text(date, 20, 28)
    
    doc.setFontSize(12)
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 20
    const maxWidth = pageWidth - (margin * 2)
    
    const lines = doc.splitTextToSize(text, maxWidth)
    
    let yPosition = 40
    const lineHeight = 7
    const pageHeight = doc.internal.pageSize.getHeight()
    
    lines.forEach((line) => {
      if (yPosition + lineHeight > pageHeight - margin) {
        doc.addPage()
        yPosition = margin
      }
      
      doc.text(line, margin, yPosition)
      yPosition += lineHeight
    })
    
    const totalPages = doc.internal.pages.length - 1
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(9)
      doc.setTextColor(128, 128, 128)
      doc.text(
        `Page ${i} of ${totalPages} • ${wordCount} words`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      )
    }
    
    const filename = `story-${new Date().toISOString().replace(/:/g, '-').split('.')[0]}.pdf`
    doc.save(filename)
  }

  const hasActiveSuggestions = suggestions && suggestions.some(s => s !== null)

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: 'linear-gradient(135deg, #f5f5f4 0%, #e7e5e4 100%)',
      color: '#292524',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: 0,
      margin: 0,
      position: 'relative',
      overflow: 'hidden',
      boxSizing: 'border-box'
    }}>
      {/* Layer 1: Rotating gradient orbs */}
<div style={{
  position: 'fixed',
  top: '-25%',
  left: '-25%',
  width: '150%',
  height: '150%',
  background: 'radial-gradient(circle at 30% 50%, rgba(22, 163, 74, 0.25) 0%, transparent 40%), radial-gradient(circle at 70% 50%, rgba(59, 130, 246, 0.18) 0%, transparent 40%), radial-gradient(circle at 50% 80%, rgba(234, 88, 12, 0.15) 0%, transparent 40%)',
  animation: 'float 10s ease-in-out infinite',
  pointerEvents: 'none',
  zIndex: 0
}}></div>

{/* Layer 2: Pulsing waves */}
<div style={{
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: 'radial-gradient(ellipse at 20% 30%, rgba(22, 163, 74, 0.18) 0%, transparent 45%), radial-gradient(ellipse at 80% 70%, rgba(59, 130, 246, 0.15) 0%, transparent 45%)',
  animation: 'pulse 5s ease-in-out infinite',
  pointerEvents: 'none',
  zIndex: 0
}}></div>

{/* Layer 3: Drifting particles */}
<div style={{
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: 'radial-gradient(circle at 60% 40%, rgba(234, 88, 12, 0.12) 0%, transparent 30%), radial-gradient(circle at 40% 60%, rgba(22, 163, 74, 0.08) 0%, transparent 30%)',
  animation: 'drift 7s ease-in-out infinite reverse',
  pointerEvents: 'none',
  zIndex: 0
}}></div>


      <header style={{
        background: 'rgba(255, 255, 255, 0.7)',
        borderBottom: '1px solid rgba(168, 162, 158, 0.3)',
        padding: '20px 48px',
        backdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: '0 4px 30px rgba(22, 163, 74, 0.1)',
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{
          maxWidth: '1600px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{display: 'flex', alignItems: 'center', gap: '24px'}}>
  <button
    onClick={onBackToHome}
    style={{
      padding: '8px 16px',
      background: 'white',
      color: '#166534',
      border: '2px solid #16a34a',
      borderRadius: '10px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s ease'
    }}
    onMouseEnter={e => {
      e.target.style.background = '#166534'
      e.target.style.color = 'white'
    }}
    onMouseLeave={e => {
      e.target.style.background = 'white'
      e.target.style.color = '#166534'
    }}
  >
    ← Home
  </button>
  
  <h1 style={{

              fontSize: '28px',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #166534 0%, #15803d 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              animation: 'fadeIn 0.6s ease-out'
            }}>
              <span style={{fontSize: '32px', animation: 'pulse 2s ease-in-out infinite'}}>✨</span>
              AI Co-Story Writer
            </h1>
            
            {text.trim() && (
              <div style={{
                display: 'flex',
                gap: '16px',
                padding: '8px 16px',
                background: 'rgba(22, 163, 74, 0.08)',
                borderRadius: '12px',
                border: '1px solid rgba(22, 163, 74, 0.2)',
                fontSize: '13px',
                color: '#166534',
                backdropFilter: 'blur(10px)',
                animation: 'slideIn 0.4s ease-out'
              }}>
                <span style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                  <span>📊</span>
                  {wordCount} words
                </span>
                <span style={{color: 'rgba(22, 163, 74, 0.3)'}}>•</span>
                <span>{charCount} characters</span>
              </div>
            )}
          </div>
          
          <button
            onClick={saveAsPdf}
            disabled={!text?.trim()}
            style={{
              padding: '12px 28px',
              background: text?.trim() 
                ? 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)' 
                : '#e5e7eb',
              color: text?.trim() ? 'white' : '#9ca3af',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: text?.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: text?.trim() 
                ? '0 8px 32px rgba(22, 163, 74, 0.3)' 
                : 'none'
            }}
            onMouseEnter={e => {
              if (text?.trim()) {
                e.target.style.transform = 'translateY(-3px) scale(1.02)'
                e.target.style.boxShadow = '0 12px 40px rgba(22, 163, 74, 0.4)'
              }
            }}
            onMouseLeave={e => {
              e.target.style.transform = 'translateY(0) scale(1)'
              if (text?.trim()) {
                e.target.style.boxShadow = '0 8px 32px rgba(22, 163, 74, 0.3)'
              }
            }}
          >
            📄 Save as PDF
          </button>
        </div>
      </header>

      <main style={{
        maxWidth: '1600px',
        margin: '0 auto',
        padding: '32px 48px',
        display: 'grid',
        gridTemplateColumns: '1fr 500px',
        gap: '32px',
        alignItems: 'start',
        position: 'relative',
        zIndex: 1,
        boxSizing: 'border-box'
      }}>
        <div style={{display: 'flex', flexDirection: 'column', gap: '24px', animation: 'slideInLeft 0.5s ease-out'}}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid rgba(168, 162, 158, 0.2)',
            borderRadius: '24px',
            padding: '32px',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(22, 163, 74, 0.12)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#14532d',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{fontSize: '20px'}}>📝</span>
                Your Story
              </h2>
              <div style={{
                display: 'flex',
                gap: '8px',
                fontSize: '12px',
                color: '#57534e',
                background: 'rgba(22, 163, 74, 0.06)',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(22, 163, 74, 0.15)'
              }}>
                <kbd style={{
                  background: 'white',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  border: '1px solid rgba(168, 162, 158, 0.3)',
                  color: '#16a34a'
                }}>Ctrl+↵</kbd>
                <span>Suggest</span>
                <span style={{color: 'rgba(22, 163, 74, 0.3)'}}>•</span>
                <kbd style={{
                  background: 'white',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  border: '1px solid rgba(168, 162, 158, 0.3)',
                  color: '#16a34a'
                }}>Ctrl+Shift+↵</kbd>
                <span>Complete</span>
              </div>
            </div>

            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Once upon a time, in a land far away..."
              style={{
                width: '100%',
                minHeight: '450px',
                background: 'rgba(245, 245, 244, 0.5)',
                color: '#171717',
                fontSize: '17px',
                padding: '24px',
                borderRadius: '16px',
                border: '2px solid rgba(168, 162, 158, 0.2)',
                fontFamily: "'Merriweather', Georgia, serif",
                lineHeight: '1.8',
                resize: 'none',
                transition: 'all 0.3s ease',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              onFocus={e => {
                e.target.style.border = '2px solid #16a34a'
                e.target.style.boxShadow = '0 0 0 4px rgba(22, 163, 74, 0.1)'
                e.target.style.background = 'white'
              }}
              onBlur={e => {
                e.target.style.border = '2px solid rgba(168, 162, 158, 0.2)'
                e.target.style.boxShadow = 'none'
                e.target.style.background = 'rgba(245, 245, 244, 0.5)'
              }}
            />

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginTop: '20px'
            }}>
              <button
                onClick={suggestThreeStream}
                disabled={loadingSuggest || !text.trim()}
                style={{
                  padding: '16px 24px',
                  background: (loadingSuggest || !text.trim()) 
                    ? '#e5e7eb' 
                    : 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                  color: (loadingSuggest || !text.trim()) ? '#9ca3af' : 'white',
                  border: 'none',
                  borderRadius: '14px',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: (loadingSuggest || !text.trim()) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: (loadingSuggest || !text.trim()) 
                    ? 'none' 
                    : '0 8px 32px rgba(22, 163, 74, 0.3)'
                }}
                onMouseEnter={e => {
                  if (!loadingSuggest && text.trim()) {
                    e.target.style.transform = 'translateY(-3px) scale(1.02)'
                    e.target.style.boxShadow = '0 12px 40px rgba(22, 163, 74, 0.4)'
                  }
                }}
                onMouseLeave={e => {
                  e.target.style.transform = 'translateY(0) scale(1)'
                  if (!loadingSuggest && text.trim()) {
                    e.target.style.boxShadow = '0 8px 32px rgba(22, 163, 74, 0.3)'
                  }
                }}
              >
                {loadingSuggest ? (
                  <span style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
                    <span className="spinner"></span>
                    Generating...
                  </span>
                ) : '💡 Get Suggestions'}
              </button>

              <button
                onClick={completeStoryStream}
                disabled={completing || !text.trim()}
                style={{
                  padding: '16px 24px',
                  background: (completing || !text.trim()) 
                    ? '#e5e7eb' 
                    : 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                  color: (completing || !text.trim()) ? '#9ca3af' : 'white',
                  border: 'none',
                  borderRadius: '14px',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: (completing || !text.trim()) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: (completing || !text.trim()) 
                    ? 'none' 
                    : '0 8px 32px rgba(59, 130, 246, 0.3)'
                }}
                onMouseEnter={e => {
                  if (!completing && text.trim()) {
                    e.target.style.transform = 'translateY(-3px) scale(1.02)'
                    e.target.style.boxShadow = '0 12px 40px rgba(59, 130, 246, 0.4)'
                  }
                }}
                onMouseLeave={e => {
                  e.target.style.transform = 'translateY(0) scale(1)'
                  if (!completing && text.trim()) {
                    e.target.style.boxShadow = '0 8px 32px rgba(59, 130, 246, 0.3)'
                  }
                }}
              >
                {completing ? (
                  <span style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
                    <span className="spinner"></span>
                    Completing...
                  </span>
                ) : '✍️ Complete Story'}
              </button>

              <button
                onClick={detectCharacters}
                disabled={!text.trim()}
                style={{
                  padding: '16px 24px',
                  background: !text.trim() ? '#e5e7eb' : 'white',
                  color: !text.trim() ? '#9ca3af' : '#166534',
                  border: !text.trim() ? '2px solid #e5e7eb' : '2px solid #16a34a',
                  borderRadius: '14px',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: !text.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={e => {
                  if (text.trim()) {
                    e.target.style.background = '#166534'
                    e.target.style.color = 'white'
                    e.target.style.transform = 'translateY(-2px)'
                  }
                }}
                onMouseLeave={e => {
                  if (text.trim()) {
                    e.target.style.background = 'white'
                    e.target.style.color = '#166534'
                    e.target.style.transform = 'translateY(0)'
                  }
                }}
              >
                🔍 Detect Characters
              </button>

              <button
                onClick={clearTextOnly}
                style={{
                  padding: '16px 24px',
                  background: 'white',
                  color: '#6b7280',
                  border: '2px solid #e5e7eb',
                  borderRadius: '14px',
                  fontSize: '15px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={e => {
                  e.target.style.borderColor = '#9ca3af'
                  e.target.style.color = '#374151'
                  e.target.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={e => {
                  e.target.style.borderColor = '#e5e7eb'
                  e.target.style.color = '#6b7280'
                  e.target.style.transform = 'translateY(0)'
                }}
              >
                🗑️ Clear
              </button>
            </div>
          </div>

          {(completionStreamText || completing) && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.9)',
              border: '2px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '24px',
              padding: '32px',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(59, 130, 246, 0.15)',
              animation: 'slideInUp 0.4s ease-out'
            }}>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1e3a8a',
                marginTop: 0,
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{fontSize: '20px'}}>📖</span>
                Story Completion
              </h3>

              <div style={{
                background: 'rgba(239, 246, 255, 0.5)',
                borderRadius: '16px',
                padding: '24px',
                minHeight: '200px',
                marginBottom: '20px',
                border: '1px solid rgba(59, 130, 246, 0.15)'
              }}>
                <div style={{
                  whiteSpace: 'pre-wrap',
                  fontSize: '16px',
                  lineHeight: '1.8',
                  color: '#171717',
                  fontFamily: "'Merriweather', Georgia, serif"
                }}>
                  {completionStreamText || (
                    <span style={{color: '#6b7280', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '12px'}}>
                      <span className="spinner"></span>
                      Generating your story completion...
                    </span>
                  )}
                </div>
              </div>

              <div style={{display: 'flex', gap: '12px'}}>
                <button
                  onClick={acceptCompletion}
                  disabled={!completionDone || !completionStreamText}
                  style={{
                    flex: 1,
                    padding: '14px 20px',
                    background: (!completionDone || !completionStreamText) 
                      ? '#e5e7eb' 
                      : 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                    color: (!completionDone || !completionStreamText) ? '#9ca3af' : 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: '700',
                    cursor: (!completionDone || !completionStreamText) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: (!completionDone || !completionStreamText) 
                      ? 'none' 
                      : '0 8px 24px rgba(22, 163, 74, 0.3)'
                  }}
                  onMouseEnter={e => {
                    if (completionDone && completionStreamText) {
                      e.target.style.transform = 'translateY(-2px) scale(1.01)'
                      e.target.style.boxShadow = '0 12px 32px rgba(22, 163, 74, 0.4)'
                    }
                  }}
                  onMouseLeave={e => {
                    e.target.style.transform = 'translateY(0) scale(1)'
                    if (completionDone && completionStreamText) {
                      e.target.style.boxShadow = '0 8px 24px rgba(22, 163, 74, 0.3)'
                    }
                  }}
                >
                  ✓ Accept & Add to Story
                </button>
                <button
                  onClick={discardCompletion}
                  disabled={!completionStreamText}
                  style={{
                    flex: 1,
                    padding: '14px 20px',
                    background: !completionStreamText ? '#e5e7eb' : 'white',
                    color: !completionStreamText ? '#9ca3af' : '#6b7280',
                    border: !completionStreamText ? '2px solid #e5e7eb' : '2px solid #d1d5db',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: '700',
                    cursor: !completionStreamText ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={e => {
                    if (completionStreamText) {
                      e.target.style.borderColor = '#9ca3af'
                      e.target.style.color = '#374151'
                    }
                  }}
                  onMouseLeave={e => {
                    if (completionStreamText) {
                      e.target.style.borderColor = '#d1d5db'
                      e.target.style.color = '#6b7280'
                    }
                  }}
                >
                  ✗ Discard
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{display: 'flex', flexDirection: 'column', gap: '24px', position: 'sticky', top: '32px', animation: 'slideInRight 0.5s ease-out'}}>
          {characters.length > 0 && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid rgba(168, 162, 158, 0.2)',
              borderRadius: '20px',
              padding: '24px',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(22, 163, 74, 0.1)',
              animation: 'scaleIn 0.3s ease-out'
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#14532d',
                marginTop: 0,
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{fontSize: '18px'}}>👥</span>
                Characters
              </h3>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
                {characters.map((c, i) => (
                  <span key={i} style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                    color: 'white',
                    borderRadius: '20px',
                    fontSize: '14px',
                    fontWeight: '600',
                    boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
                    animation: `fadeInUp 0.3s ease-out ${i * 0.1}s backwards`,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => {
                    e.target.style.transform = 'translateY(-2px) scale(1.05)'
                    e.target.style.boxShadow = '0 6px 16px rgba(22, 163, 74, 0.4)'
                  }}
                  onMouseLeave={e => {
                    e.target.style.transform = 'translateY(0) scale(1)'
                    e.target.style.boxShadow = '0 4px 12px rgba(22, 163, 74, 0.3)'
                  }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid rgba(168, 162, 158, 0.2)',
            borderRadius: '20px',
            padding: '24px',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(22, 163, 74, 0.1)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#14532d',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{fontSize: '18px'}}>💭</span>
                AI Suggestions
              </h3>
              {hasActiveSuggestions && (
                <button
                  onClick={clearSuggestionsOnly}
                  style={{
                    padding: '6px 14px',
                    background: 'white',
                    color: '#6b7280',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => {
                    e.target.style.borderColor = '#9ca3af'
                    e.target.style.color = '#374151'
                  }}
                  onMouseLeave={e => {
                    e.target.style.borderColor = '#d1d5db'
                    e.target.style.color = '#6b7280'
                  }}
                >
                  Clear All
                </button>
              )}
            </div>

            {suggestions === null ? (
              <div style={{
                textAlign: 'center',
                color: '#6b7280',
                fontStyle: 'italic',
                padding: '60px 20px',
                fontSize: '14px',
                background: 'rgba(245, 245, 244, 0.5)',
                borderRadius: '12px',
                border: '1px dashed rgba(22, 163, 74, 0.3)'
              }}>
                <div style={{fontSize: '48px', marginBottom: '16px', opacity: 0.3}}>💡</div>
                Click "Get Suggestions" to see three AI-generated story continuations
              </div>
            ) : (
              <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
                {suggestions.map((s, idx) => (
                  s !== null && (
                    <div key={`suggestion-${idx}-${s?.slice(0,20)}`} style={{
                      background: 'rgba(245, 245, 244, 0.5)',
                      border: '1px solid rgba(22, 163, 74, 0.15)',
                      borderRadius: '14px',
                      padding: '20px',
                      transition: 'all 0.3s ease',
                      animation: `slideInRight 0.4s ease-out ${idx * 0.1}s backwards`
                    }}
                    onMouseEnter={e => {
                      e.target.style.borderColor = 'rgba(22, 163, 74, 0.4)'
                      e.target.style.boxShadow = '0 4px 16px rgba(22, 163, 74, 0.1)'
                    }}
                    onMouseLeave={e => {
                      e.target.style.borderColor = 'rgba(22, 163, 74, 0.15)'
                      e.target.style.boxShadow = 'none'
                    }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px'
                      }}>
                        <span style={{
                          fontSize: '11px',
                          color: '#6b7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          fontWeight: '600'
                        }}>
                          Option {idx + 1}
                        </span>
                        {suggestDone[idx] && s && (
                          <span style={{
                            fontSize: '11px',
                            background: 'rgba(22, 163, 74, 0.1)',
                            color: '#166534',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid rgba(22, 163, 74, 0.2)'
                          }}>
                            ✓ Ready
                          </span>
                        )}
                      </div>
                      
                      <div style={{
                        marginBottom: '16px',
                        minHeight: '80px',
                        fontSize: '15px',
                        lineHeight: '1.7',
                        color: '#171717',
                        fontFamily: "'Merriweather', Georgia, serif"
                      }}>
                        {s || (
                          <div style={{color: '#6b7280', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '12px'}}>
                            <span className="spinner"></span>
                            {suggestDone[idx] ? 'No suggestion generated' : 'Generating suggestion...'}
                          </div>
                        )}
                      </div>
                      
                      <div style={{display: 'flex', gap: '8px'}}>
                        <button
                          onClick={() => acceptSuggestion(idx)}
                          disabled={!suggestDone[idx] || !suggestions[idx]}
                          style={{
                            flex: 1,
                            padding: '10px 16px',
                            background: (!suggestDone[idx] || !suggestions[idx]) 
                              ? '#e5e7eb' 
                              : 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                            color: (!suggestDone[idx] || !suggestions[idx]) ? '#9ca3af' : 'white',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '14px',
                            fontWeight: '700',
                            cursor: (!suggestDone[idx] || !suggestions[idx]) ? 'not-allowed' : 'pointer',
                            transition: 'box-shadow 0.3s ease',
                            boxShadow: (!suggestDone[idx] || !suggestions[idx]) 
                              ? 'none' 
                              : '0 4px 16px rgba(22, 163, 74, 0.3)',
                            position: 'relative',
                            zIndex: 10,
                            isolation: 'isolate'
                          }}
                          onMouseEnter={e => {
                            if (suggestDone[idx] && suggestions[idx]) {
                              e.target.style.boxShadow = '0 6px 20px rgba(22, 163, 74, 0.4)'
                            }
                          }}
                          onMouseLeave={e => {
                            if (suggestDone[idx] && suggestions[idx]) {
                              e.target.style.boxShadow = '0 4px 16px rgba(22, 163, 74, 0.3)'
                            }
                          }}
                        >
                          ✓ Accept
                        </button>
                        <button
                          onClick={() => discardSuggestion(idx)}
                          style={{
                            flex: 1,
                            padding: '10px 16px',
                            background: 'white',
                            color: '#6b7280',
                            border: '1px solid #d1d5db',
                            borderRadius: '10px',
                            fontSize: '14px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease'
                          }}
                          onMouseEnter={e => {
                            e.target.style.borderColor = '#9ca3af'
                            e.target.style.color = '#374151'
                          }}
                          onMouseLeave={e => {
                            e.target.style.borderColor = '#d1d5db'
                            e.target.style.color = '#6b7280'
                          }}
                        >
                          ✗ Discard
                        </button>
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              color: '#dc2626',
              fontSize: '14px',
              fontWeight: '500',
              animation: 'shake 0.5s ease-in-out'
            }}>
              ⚠️ {error}
            </div>
          )}
        </div>
      </main>

      <style>{`
        * {
          box-sizing: border-box;
        }
        
        html, body {
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }
        
        .spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(22, 163, 74, 0.3);
          border-top-color: #16a34a;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
        
        @keyframes float {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(30px, -30px) rotate(120deg); }
          66% { transform: translate(-20px, 20px) rotate(240deg); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
          @keyframes pulse {
  0%, 100% { 
    transform: scale(1);
    opacity: 0.8;
  }
  50% { 
    transform: scale(1.1);
    opacity: 1;
  }
}

@keyframes drift {
  0%, 100% { 
    transform: translate(0, 0) scale(1);
  }
  25% { 
    transform: translate(30px, -30px) scale(1.05);
  }
  50% { 
    transform: translate(-20px, 20px) scale(0.95);
  }
  75% { 
    transform: translate(20px, 30px) scale(1.02);
  }
}

      `}</style>
    </div>
  )
}
