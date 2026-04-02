import { motion } from 'framer-motion';

export default function PetForm({ onSubmit }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    onSubmit({
      name: formData.get('name'),
      vibe: formData.get('vibe')
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={formContainerStyle}
    >
      <h2 style={{ color: '#20E2FF' }}>CREATE PET PROFILE</h2>
      <form onSubmit={handleSubmit} style={formStyle}>
        <input name="name" placeholder="Pet Name" required style={inputStyle} />
        <select name="vibe" style={inputStyle}>
          <option value="chill">Chill / 佛系</option>
          <option value="energetic">Energetic / 拆家狂</option>
          <option value="grumpy">Grumpy / 傲娇</option>
          <option value="mysterious">Mysterious / 高冷</option>
        </select>
        <button type="submit" style={btnStyle}>GENERATE BOX</button>
      </form>
    </motion.div>
  );
}

// 样式：复古漫画感 (Style: Retro Indie Comic)
const formContainerStyle = {
  position: 'absolute', zIndex: 100, top: '50%', left: '50%', 
  transform: 'translate(-50%, -50%)', background: '#000', 
  border: '4px solid #fff', padding: '40px', textAlign: 'center'
};
const inputStyle = {
  display: 'block', width: '100%', margin: '15px 0', padding: '10px',
  background: '#111', color: '#fff', border: '2px solid #20E2FF'
};
const btnStyle = {
  background: '#20E2FF', color: '#000', fontWeight: 'bold', 
  padding: '10px 20px', border: 'none', cursor: 'pointer'
};