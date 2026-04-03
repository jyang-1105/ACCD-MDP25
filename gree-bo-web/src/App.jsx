import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Stars, Float, MeshWobbleMaterial, useTexture } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';

// --- 错误边界 ---
class BoxErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return <FallbackBox {...this.props} />;
    return this.props.children;
  }
}

const neonGlowColors = {
  chill: '#20E2FF',
  energetic: '#FFD700',
  grumpy: '#FF4D4D',
  mysterious: '#A020F0'
};

const rarityColors = {
  Legendary: '#FFD700',
  Rare: '#FF007A',
  Common: '#20E2FF'
};

// --- 3D 组件 ---
const FallbackBox = ({ vibe, isUnboxing, onOpen }) => (
  <Float speed={2} rotationIntensity={1} floatIntensity={1}>
    <mesh onClick={onOpen} castShadow>
      <boxGeometry args={[2, 2, 2]} />
      <MeshWobbleMaterial
        color={neonGlowColors[vibe]}
        emissive={neonGlowColors[vibe]}
        emissiveIntensity={1.2}
        factor={isUnboxing ? 2.5 : 0.1}
        speed={isUnboxing ? 10 : 0.8}
        roughness={0.15}
        metalness={0.6}
      />
    </mesh>
  </Float>
);

const TexturedBox = ({ vibe, isUnboxing, onOpen }) => {
  const textureMap = {
    chill: '/textures/chill_vibe.png',
    energetic: '/textures/energetic_vibe.png',
    grumpy: '/textures/grumpy_vibe.png',
    mysterious: '/textures/mysterious_vibe.png'
  };
  const texture = useTexture(textureMap[vibe] || textureMap.chill);
  if (texture) texture.anisotropy = 16;

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={1}>
      <mesh onClick={onOpen} castShadow>
        <boxGeometry args={[2, 2, 2]} />
        <MeshWobbleMaterial
          map={texture}
          emissive={neonGlowColors[vibe]}
          emissiveIntensity={0.3}
          factor={isUnboxing ? 2.5 : 0.1}
          speed={isUnboxing ? 10 : 0.8}
          roughness={0.3}
          metalness={0.4}
        />
      </mesh>
    </Float>
  );
};

const GreeBoBox = (props) => (
  <BoxErrorBoundary {...props}>
    <TexturedBox {...props} />
  </BoxErrorBoundary>
);

const RewardItem = ({ rarity }) => {
  const config = {
    Legendary: { color: '#FFD700', speed: 8 },
    Rare: { color: '#FF007A', speed: 4 },
    Common: { color: '#20E2FF', speed: 2 }
  };
  const current = config[rarity] || config.Common;
  return (
    <Float speed={current.speed} rotationIntensity={3}>
      <mesh>
        {rarity === 'Legendary'
          ? <torusKnotGeometry args={[0.7, 0.2, 128, 32]} />
          : <octahedronGeometry args={[0.8, 0]} />}
        <meshStandardMaterial
          color={current.color}
          emissive={current.color}
          emissiveIntensity={1.5}
          wireframe
        />
      </mesh>
    </Float>
  );
};

// --- UI 组件 ---
const vibeLabels = {
  chill: { label: 'CHILL', sub: 'calm · cool · collected', color: '#20E2FF' },
  energetic: { label: 'ENERGETIC', sub: 'wild · bright · unstoppable', color: '#FFD700' },
  grumpy: { label: 'GRUMPY', sub: 'fierce · sharp · chaotic', color: '#FF4D4D' },
  mysterious: { label: 'MYSTERIOUS', sub: 'deep · quiet · unknown', color: '#A020F0' },
};

const PetForm = ({ onSubmit }) => {
  const [selectedVibe, setSelectedVibe] = useState('chill');

  return (
    <div className="form-overlay">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -40 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="glass-panel"
      >
        <div className="form-header">
          <div className="form-tag">BLIND BOX SYSTEM v2.4</div>
          <h2 className="form-title">INITIALIZE<br />YOUR PET</h2>
        </div>

        <form onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          onSubmit({ name: fd.get('name'), vibe: selectedVibe });
        }}>
          <div className="input-group">
            <label className="input-label">PET NAME</label>
            <input
              name="name"
              placeholder="enter designation..."
              required
              className="retro-input"
              autoComplete="off"
            />
          </div>

          <div className="input-group">
            <label className="input-label">VIBE TYPE</label>
            <div className="vibe-grid">
              {Object.entries(vibeLabels).map(([key, val]) => (
                <button
                  key={key}
                  type="button"
                  className={`vibe-btn ${selectedVibe === key ? 'active' : ''}`}
                  style={{ '--vibe-color': val.color }}
                  onClick={() => setSelectedVibe(key)}
                >
                  <span className="vibe-name">{val.label}</span>
                  <span className="vibe-sub">{val.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="submit-btn">
            <span>INITIALIZE BOX</span>
            <span className="btn-arrow">→</span>
          </button>
        </form>
      </motion.div>
    </div>
  );
};

// --- 主应用 ---
export default function App() {
  const [stage, setStage] = useState('form');
  const [petData, setPetData] = useState(null);
  const [reward, setReward] = useState(null);

  const handleStart = (data) => {
    setPetData(data);
    setStage('box');
  };

  const handleUnbox = () => {
    if (stage !== 'box') return;
    setStage('unboxing');
    setTimeout(() => {
      const rand = Math.random() * 100;
      if (rand < 10) setReward('Legendary');
      else if (rand < 40) setReward('Rare');
      else setReward('Common');
      setStage('reward');
    }, 2000);
  };

  const handleReset = () => {
    setStage('form');
    setReward(null);
    setPetData(null);
  };

  const accentColor = petData ? neonGlowColors[petData.vibe] : '#20E2FF';

  return (
    <div className="app-container">
      {/* 3D 画布（始终在后面） */}
      <div className="canvas-wrapper">
        <Canvas shadows>
          <PerspectiveCamera makeDefault position={[0, 0, 6]} />
          <Stars radius={100} depth={50} count={6000} factor={4} fade speed={0.8} />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1.5} color={accentColor} />
          <pointLight position={[-10, -10, -10]} intensity={0.4} color="#ffffff" />

          <Suspense fallback={null}>
            {(stage === 'box' || stage === 'unboxing') && (
              <GreeBoBox
                vibe={petData?.vibe || 'chill'}
                isUnboxing={stage === 'unboxing'}
                onOpen={handleUnbox}
              />
            )}
            {stage === 'reward' && <RewardItem rarity={reward} />}
          </Suspense>

          <OrbitControls enableZoom={false} autoRotate={stage === 'reward'} autoRotateSpeed={2} />
        </Canvas>
      </div>

      {/* 顶部导航栏 */}
      <div className="topbar">
        <div className="topbar-left">
          <h1 className="logo">GREE-BO™</h1>
          <span className="logo-version">BLIND BOX SYSTEM</span>
        </div>
        {petData && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="topbar-right"
          >
            <span className="pet-tag" style={{ borderColor: accentColor, color: accentColor }}>
              ◈ {petData.name.toUpperCase()}
            </span>
            <span className="vibe-tag" style={{ color: accentColor }}>
              {petData.vibe.toUpperCase()}
            </span>
          </motion.div>
        )}
      </div>

      {/* 表单层 */}
      <AnimatePresence mode="wait">
        {stage === 'form' && <PetForm key="form" onSubmit={handleStart} />}
      </AnimatePresence>

      {/* 点击提示 */}
      <AnimatePresence>
        {stage === 'box' && (
          <motion.div
            key="hint"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bottom-hint"
          >
            <div className="hint-dot" style={{ background: accentColor }} />
            <span>CLICK THE BOX TO UNVEIL</span>
            <div className="hint-dot" style={{ background: accentColor }} />
          </motion.div>
        )}

        {stage === 'unboxing' && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bottom-hint analyzing"
          >
            <span className="blink-text">■ ANALYZING RARITY...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 结果层 */}
      <AnimatePresence>
        {stage === 'reward' && reward && (
          <>
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="reward-display"
            >
              <div className="reward-rarity" style={{ color: rarityColors[reward] }}>
                {reward.toUpperCase()}
              </div>
              <div className="reward-label" style={{ color: rarityColors[reward] }}>
                {reward === 'Legendary' ? '✦ GOLDEN TAG' : reward === 'Rare' ? '✦ CYBER COLLAR' : '✦ NEON SNACK'}
              </div>
              <div className="reward-bar" style={{ background: rarityColors[reward] }} />
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="reset-btn"
              onClick={handleReset}
            >
              ↺ &nbsp;OPEN ANOTHER BOX
            </motion.button>
          </>
        )}
      </AnimatePresence>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .app-container {
          width: 100vw; height: 100vh;
          background: #000;
          overflow: hidden; position: relative;
          font-family: 'Courier New', monospace;
        }

        /* Canvas */
        .canvas-wrapper {
          position: absolute; inset: 0; z-index: 1;
        }

        /* Topbar */
        .topbar {
          position: absolute; top: 0; left: 0; right: 0;
          z-index: 10; padding: 24px 32px;
          display: flex; align-items: center; justify-content: space-between;
          pointer-events: none;
          background: linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%);
        }
        .topbar-left { display: flex; align-items: baseline; gap: 14px; }
        .logo {
          font-size: 2rem; letter-spacing: 6px; color: #fff;
          text-shadow: 0 0 20px rgba(255,255,255,0.4), 2px 2px 0 #FF007A;
        }
        .logo-version {
          font-size: 0.6rem; letter-spacing: 3px; color: #555;
        }
        .topbar-right { display: flex; align-items: center; gap: 12px; }
        .pet-tag {
          font-size: 0.75rem; letter-spacing: 2px;
          border: 1px solid; padding: 4px 10px;
        }
        .vibe-tag { font-size: 0.65rem; letter-spacing: 3px; opacity: 0.7; }

        /* Form overlay */
        .form-overlay {
          position: absolute; inset: 0; z-index: 50;
          display: flex; align-items: center; justify-content: center;
        }

        /* Glass panel */
        .glass-panel {
          background: rgba(0, 0, 0, 0.88);
          border: 1px solid rgba(255,255,255,0.15);
          padding: 48px 44px;
          width: 480px;
          max-width: 90vw;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.05),
            0 40px 80px rgba(0,0,0,0.8),
            inset 0 1px 0 rgba(255,255,255,0.08);
          backdrop-filter: blur(20px);
        }

        .form-header { margin-bottom: 36px; }
        .form-tag {
          font-size: 0.6rem; letter-spacing: 4px;
          color: #444; margin-bottom: 12px;
        }
        .form-title {
          font-size: 1.8rem; letter-spacing: 4px;
          color: #fff; line-height: 1.2;
          font-weight: normal;
        }

        /* Inputs */
        .input-group { margin-bottom: 28px; }
        .input-label {
          display: block; font-size: 0.6rem;
          letter-spacing: 3px; color: #555;
          margin-bottom: 10px;
        }
        .retro-input {
          display: block; width: 100%; padding: 14px 16px;
          background: rgba(255,255,255,0.04);
          color: #fff; border: 1px solid rgba(255,255,255,0.12);
          border-radius: 0; outline: none;
          font-family: 'Courier New', monospace;
          font-size: 0.85rem; letter-spacing: 2px;
          transition: border-color 0.2s;
        }
        .retro-input:focus { border-color: rgba(255,255,255,0.4); }
        .retro-input::placeholder { color: #333; }

        /* Vibe grid */
        .vibe-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .vibe-btn {
          padding: 14px 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          color: #666; cursor: pointer;
          text-align: left; transition: all 0.2s;
          display: flex; flex-direction: column; gap: 4px;
        }
        .vibe-btn:hover {
          border-color: var(--vibe-color);
          color: var(--vibe-color);
          background: rgba(255,255,255,0.05);
        }
        .vibe-btn.active {
          border-color: var(--vibe-color);
          color: var(--vibe-color);
          background: rgba(255,255,255,0.06);
          box-shadow: inset 0 0 20px rgba(0,0,0,0.3);
        }
        .vibe-name {
          font-size: 0.7rem; letter-spacing: 2px; font-weight: bold;
        }
        .vibe-sub {
          font-size: 0.55rem; letter-spacing: 1px; opacity: 0.5;
          font-family: 'Courier New', monospace;
        }

        /* Submit button */
        .submit-btn {
          width: 100%; padding: 16px;
          background: #fff; color: #000;
          border: none; cursor: pointer;
          font-family: 'Courier New', monospace;
          font-size: 0.8rem; letter-spacing: 4px; font-weight: bold;
          display: flex; align-items: center; justify-content: space-between;
          margin-top: 8px;
          transition: all 0.2s;
        }
        .submit-btn:hover {
          background: #20E2FF;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(32, 226, 255, 0.3);
        }
        .btn-arrow { font-size: 1.1rem; }

        /* Bottom hint */
        .bottom-hint {
          position: absolute; bottom: 48px; left: 0; right: 0;
          z-index: 10; text-align: center;
          display: flex; align-items: center; justify-content: center; gap: 16px;
          font-size: 0.65rem; letter-spacing: 4px; color: rgba(255,255,255,0.5);
        }
        .hint-dot {
          width: 5px; height: 5px; border-radius: 50%;
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.6); }
        }
        .analyzing { color: rgba(255,255,255,0.7); }
        .blink-text { animation: blink 0.8s step-end infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

        /* Reward display */
        .reward-display {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          z-index: 10; text-align: center;
          pointer-events: none;
          margin-top: -160px;
        }
        .reward-rarity {
          font-size: 3rem; letter-spacing: 12px;
          text-shadow: 0 0 40px currentColor;
          margin-bottom: 8px;
        }
        .reward-label {
          font-size: 0.75rem; letter-spacing: 5px; opacity: 0.8;
          margin-bottom: 20px;
        }
        .reward-bar {
          width: 60px; height: 2px; margin: 0 auto;
          box-shadow: 0 0 12px currentColor;
        }

        /* Reset button */
        .reset-btn {
          position: absolute; bottom: 48px; left: 50%;
          transform: translateX(-50%);
          z-index: 10;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.25);
          color: #fff; cursor: pointer;
          font-family: 'Courier New', monospace;
          font-size: 0.7rem; letter-spacing: 4px;
          padding: 14px 32px;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .reset-btn:hover {
          border-color: #fff;
          background: rgba(255,255,255,0.05);
          transform: translateX(-50%) translateY(-2px);
        }
      `}</style>
    </div>
  );
}