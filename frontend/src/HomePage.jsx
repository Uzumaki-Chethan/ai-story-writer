export default function HomePage({ onStartWriting }) {
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
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* Layer 1: Rotating gradient orbs - FASTER & SMALLER */}
<div style={{
  position: 'fixed',
  top: '-25%',
  left: '-25%',
  width: '150%',
  height: '150%',
  background: 'radial-gradient(circle at 30% 50%, rgba(22, 163, 74, 0.35) 0%, transparent 40%), radial-gradient(circle at 70% 50%, rgba(59, 130, 246, 0.28) 0%, transparent 40%), radial-gradient(circle at 50% 80%, rgba(234, 88, 12, 0.25) 0%, transparent 40%)',
  animation: 'float 10s ease-in-out infinite',
  pointerEvents: 'none',
  zIndex: 0
}}></div>

{/* Layer 2: Pulsing waves - FASTER & SMALLER */}
<div style={{
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: 'radial-gradient(ellipse at 20% 30%, rgba(22, 163, 74, 0.28) 0%, transparent 45%), radial-gradient(ellipse at 80% 70%, rgba(59, 130, 246, 0.25) 0%, transparent 45%)',
  animation: 'pulse 5s ease-in-out infinite',
  pointerEvents: 'none',
  zIndex: 0
}}></div>

{/* Layer 3: Drifting particles - FASTER & SMALLER */}
<div style={{
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: 'radial-gradient(circle at 60% 40%, rgba(234, 88, 12, 0.22) 0%, transparent 30%), radial-gradient(circle at 40% 60%, rgba(22, 163, 74, 0.18) 0%, transparent 30%)',
  animation: 'drift 7s ease-in-out infinite reverse',
  pointerEvents: 'none',
  zIndex: 0
}}></div>
    <div style={{
        position: 'relative',
        zIndex: 1,
        textAlign: 'center',
        maxWidth: '900px',
        padding: '48px',
        animation: 'fadeInUp 0.8s ease-out'
      }}>
        <div style={{
          fontSize: '100px',
          marginBottom: '32px',
          animation: 'floatIcon 3s ease-in-out infinite',
          filter: 'drop-shadow(0 0 20px rgba(22, 163, 74, 0.3))'
        }}>✨</div>
        
        <h1 style={{
          fontSize: '72px',
          fontWeight: '900',
          background: 'linear-gradient(135deg, #166534 0%, #15803d 50%, #16a34a 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: '0 0 28px 0',
          animation: 'fadeIn 1s ease-out',
          letterSpacing: '-2px',
          lineHeight: '1.1'
        }}>
          AI Co-Story Writer
        </h1>
        
        <p style={{
          fontSize: '26px',
          color: '#57534e',
          marginBottom: '56px',
          lineHeight: '1.7',
          animation: 'fadeIn 1.2s ease-out',
          fontWeight: '400'
        }}>
          Unleash your creativity with AI-powered storytelling.<br/>
          <span style={{color: '#78716c', fontSize: '22px'}}>Get suggestions, complete your stories, and bring your characters to life.</span>
        </p>

        <div style={{
          display: 'flex',
          gap: '24px',
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginBottom: '64px',
          animation: 'fadeIn 1.4s ease-out'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            padding: '32px 40px',
            borderRadius: '20px',
            border: '2px solid rgba(22, 163, 74, 0.2)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(22, 163, 74, 0.12)',
            transition: 'all 0.4s ease',
            cursor: 'pointer'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)'
            e.currentTarget.style.boxShadow = '0 16px 48px rgba(22, 163, 74, 0.2)'
            e.currentTarget.style.borderColor = 'rgba(22, 163, 74, 0.4)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)'
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(22, 163, 74, 0.12)'
            e.currentTarget.style.borderColor = 'rgba(22, 163, 74, 0.2)'
          }}
          >
            <div style={{fontSize: '48px', marginBottom: '16px'}}>💡</div>
            <div style={{fontSize: '18px', fontWeight: '700', color: '#166534', marginBottom: '8px'}}>Smart Suggestions</div>
            <div style={{fontSize: '14px', color: '#78716c'}}>AI-powered story ideas</div>
          </div>
          
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            padding: '32px 40px',
            borderRadius: '20px',
            border: '2px solid rgba(37, 99, 235, 0.2)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(37, 99, 235, 0.12)',
            transition: 'all 0.4s ease',
            cursor: 'pointer'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)'
            e.currentTarget.style.boxShadow = '0 16px 48px rgba(37, 99, 235, 0.2)'
            e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.4)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)'
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(37, 99, 235, 0.12)'
            e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.2)'
          }}
          >
            <div style={{fontSize: '48px', marginBottom: '16px'}}>✍️</div>
            <div style={{fontSize: '18px', fontWeight: '700', color: '#1e40af', marginBottom: '8px'}}>Auto-Complete</div>
            <div style={{fontSize: '14px', color: '#78716c'}}>Finish your story instantly</div>
          </div>
          
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            padding: '32px 40px',
            borderRadius: '20px',
            border: '2px solid rgba(234, 88, 12, 0.2)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(234, 88, 12, 0.12)',
            transition: 'all 0.4s ease',
            cursor: 'pointer'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)'
            e.currentTarget.style.boxShadow = '0 16px 48px rgba(234, 88, 12, 0.2)'
            e.currentTarget.style.borderColor = 'rgba(234, 88, 12, 0.4)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)'
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(234, 88, 12, 0.12)'
            e.currentTarget.style.borderColor = 'rgba(234, 88, 12, 0.2)'
          }}
          >
            <div style={{fontSize: '48px', marginBottom: '16px'}}>👥</div>
            <div style={{fontSize: '18px', fontWeight: '700', color: '#c2410c', marginBottom: '8px'}}>Character Detection</div>
            <div style={{fontSize: '14px', color: '#78716c'}}>Track your story's cast</div>
          </div>
        </div>

        <button
          onClick={onStartWriting}
          style={{
            padding: '24px 64px',
            background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '18px',
            fontSize: '24px',
            fontWeight: '800',
            cursor: 'pointer',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 16px 48px rgba(22, 163, 74, 0.4)',
            animation: 'fadeIn 1.6s ease-out',
            letterSpacing: '0.5px'
          }}
          onMouseEnter={e => {
            e.target.style.transform = 'translateY(-6px) scale(1.05)'
            e.target.style.boxShadow = '0 20px 60px rgba(22, 163, 74, 0.5)'
          }}
          onMouseLeave={e => {
            e.target.style.transform = 'translateY(0) scale(1)'
            e.target.style.boxShadow = '0 16px 48px rgba(22, 163, 74, 0.4)'
          }}
        >
          🚀 Start Writing Now
        </button>

        <p style={{
          marginTop: '40px',
          fontSize: '15px',
          color: '#78716c',
          animation: 'fadeIn 2s ease-out'
        }}>
          No sign-up required • Free forever • Powered by AI
        </p>
      </div>

     <style>{`
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(40px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes floatIcon {
    0%, 100% { 
      transform: translateY(0px) rotate(0deg);
    }
    50% { 
      transform: translateY(-20px) rotate(5deg);
    }
  }
  
  @keyframes float {
    0%, 100% { transform: translate(0, 0) rotate(0deg); }
    33% { transform: translate(40px, -40px) rotate(120deg); }
    66% { transform: translate(-30px, 30px) rotate(240deg); }
  }
  
  /* NEW ANIMATION 1: Pulsing effect */
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
  
  /* NEW ANIMATION 2: Drifting effect */
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
