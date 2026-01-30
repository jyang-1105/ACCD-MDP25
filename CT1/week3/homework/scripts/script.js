// 选中缩略图们和大图
const thumbs = document.querySelectorAll('.thumb');
const viewerImg = document.getElementById('viewerImg');

// 点击缩略图 => 更新大图
thumbs.forEach(btn => {
  btn.addEventListener('click', () => selectImage(btn));
  btn.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectImage(btn);
    }
  });
});

// 左右键切换（可选）
document.addEventListener('keydown', e => {
  const list = Array.from(thumbs);
  const currentIdx = list.findIndex(b => b.getAttribute('aria-current') === 'true');
  if (currentIdx < 0) return;

  if (e.key === 'ArrowRight') {
    const next = list[(currentIdx + 1) % list.length];
    next.focus();
    selectImage(next);
  } else if (e.key === 'ArrowLeft') {
    const prev = list[(currentIdx - 1 + list.length) % list.length];
    prev.focus();
    selectImage(prev);
  }
});

function selectImage(btn) {
  // 改 aria-current 高亮边框
  thumbs.forEach(b => b.setAttribute('aria-current', 'false'));
  btn.setAttribute('aria-current', 'true');

  // 平滑过渡加载大图
  const fullSrc = btn.getAttribute('data-full');
  const alt = btn.getAttribute('aria-label') || 'Selected image';
  viewerImg.style.opacity = 0;

  const temp = new Image();
  temp.onload = () => {
    viewerImg.src = fullSrc;
    viewerImg.alt = `${alt} (displayed)`;
    viewerImg.style.opacity = 1;
  };
  temp.src = fullSrc;
}
