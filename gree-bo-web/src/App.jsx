import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Stars, Float, MeshWobbleMaterial } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';

// --- 1. 3D 组件 ---

const GreeBoBox = ({ vibe, isUnboxing, onOpen }) => {
  const neonGlowColors = {
    chill: '#20E2FF',
    energetic: '#FFD700',
    grumpy: '#FF4D4D',
    mysterious: '#A020F0'
  };

  return (
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
};

const RewardItem = ({ rarity }) => {
  const config = {
    Legendary: { color: '#FFD700', speed: 8 },
    Rare:      { color: '#FF007A', speed: 4 },
    Common:    { color: '#20E2FF', speed: 2 }
  };
  const current = config[rarity] || config.Common;

  return (
    <Float speed={current.speed} rotationIntensity={3}>
      <mesh>
        {rarity === 'Legendary'
          ? <torusKnotGeometry args={[0.7, 0.2, 128, 32]} />
          : <octahedronGeometry args={[0.8, 0]} />
        }
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

// --- 2. UI 组件 ---

const PetForm = ({ onSubmit }) => (
  <motion.div
    initial={{ x: -100, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    exit={{ x: 100, opacity: 0 }}
    className="glass-panel"
  >
    <h2 style={{ color: '#20E2FF', marginBottom: '20px' }}>GREE-BO PROFILE</h2>
    <form onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      onSubmit({ name: fd.get('name'), vibe: fd.get('vibe') });
    }}>
      <input name="name" placeholder="PET NAME" required className="retro-input" />
      <select name="vibe" className="retro-input">
        <option value="chill">CHILL (BLUE)</option>
        <option value="energetic">ENERGETIC (GOLD)</option>
        <option value="grumpy">GRUMPY (RED)</option>
        <option value="mysterious">MYSTERIOUS (PURPLE)</option>
      </select>
      <button type="submit" className="retro-btn">INITIALIZE BOX</button>
    </form>
  </motion.div>
);

// --- 3. 主应用 ---

const vibeColors = {
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
      if (rand < 10)      setReward('Legendary');
      else if (rand < 40) setReward('Rare');
      else                setReward('Common');
      setStage('reward');
    }, 2000);
  };

  const handleReset = () => {
    setStage('form');
    setReward(null);
    setPetData(null);
  };

  return (
    <div className="app-container">
      {/* 顶部状态栏 */}
      <div className="header">
        <h1 className="logo">GREE-BO™</h1>
        {petData && (
          <span className="pet-tag" style={{ background: vibeColors[petData.vibe] }}>
            TARGET: {petData.name.toUpperCase()}
          </span>
        )}
      </div>

      {/* 表单 */}
      <AnimatePresence mode="wait">
        {stage === 'form' && <PetForm key="form" onSubmit={handleStart} />}
      </AnimatePresence>

      {/* 稀有度结果标签 */}
      <AnimatePresence>
        {stage === 'reward' && reward && (
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="reward-label"
            style={{ color: rarityColors[reward] }}
          >
            [ {reward.toUpperCase()} FOUND ]
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D 画布 */}
      <div className="canvas-wrapper">
        <Canvas shadows>
          <PerspectiveCamera makeDefault position={[0, 0, 6]} />
          <Stars radius={100} depth={50} count={5000} factor={4} fade speed={1} />
          <ambientLight intensity={0.4} />
          <pointLight
            position={[10, 10, 10]}
            intensity={1.5}
            color={petData ? vibeColors[petData.vibe] : '#fff'}
          />

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

          <OrbitControls enableZoom={false} autoRotate={stage === 'reward'} />
        </Canvas>
      </div>

      {/* 底部提示 */}
      {stage === 'box' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="footer-hint">
          <p>SCAN COMPLETE. CLICK THE BOX TO UNVEIL SURPRISE.</p>
        </motion.div>
      )}

      {stage === 'unboxing' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="footer-hint">
          <p>ANALYZING...</p>
        </motion.div>
      )}

      {stage === 'reward' && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="retro-btn reset-btn"
          onClick={handleReset}
        >
          REORDER ANOTHER BOX
        </motion.button>
      )}

      <style>{`
        * { box-sizing: border-box; }
        .app-container {
          width: 100vw; height: 100vh; background: #000;
          overflow: hidden; position: relative;
          font-family: 'Courier New', monospace;
        }
        .canvas-wrapper { position: absolute; inset: 0; z-index: 1; }
        .header {
          position: absolute; top: 30px; left: 30px;
          z-index: 10; pointer-events: none;
          display: flex; align-items: center; gap: 16px;
        }
        .logo {
          color: #fff; margin: 0; font-size: 2.5rem;
          letter-spacing: 5px; text-shadow: 2px 2px #FF007A;
        }
        .pet-tag {
          color: #000; padding: 3px 10px;
          font-size: 0.8rem; font-weight: bold; letter-spacing: 1px;
        }
        .glass-panel {
          position: absolute; z-index: 100;
          top: 50%; left: 50%; transform: translate(-50%, -50%);
          background: rgba(0,0,0,0.9); border: 4px solid #fff;
          padding: 40px; min-width: 320px;
          box-shadow: 10px 10px 0px #20E2FF;
        }
        .retro-input {
          display: block; width: 100%; margin: 15px 0; padding: 12px;
          background: #111; color: #20E2FF; border: 2px solid #fff;
          border-radius: 0; outline: none;
          font-family: 'Courier New', monospace;
        }
        .retro-btn {
          background: #fff; color: #000; border: none;
          padding: 15px 30px; font-weight: bold; cursor: pointer;
          letter-spacing: 2px; width: 100%; transition: 0.2s;
          font-family: 'Courier New', monospace;
        }
        .retro-btn:hover {
          background: #20E2FF;
          transform: translate(-2px, -2px);
          box-shadow: 4px 4px 0 #fff;
        }
        .reset-btn {
          position: absolute; bottom: 10%; left: 50%;
          transform: translateX(-50%); width: auto; z-index: 10;
        }
        .reset-btn:hover { transform: translateX(-52%) translateY(-2px); }
        .reward-label {
          position: absolute; top: 18%; width: 100%;
          text-align: center; z-index: 10;
          font-size: 1.6rem; letter-spacing: 6px;
          text-shadow: 0 0 20px currentColor;
        }
        .footer-hint {
          position: absolute; bottom: 40px; width: 100%;
          text-align: center; z-index: 10; color: #fff;
          letter-spacing: 2px; animation: blink 1.5s infinite;
        }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}