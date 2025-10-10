const thumbs = document.querySelectorAll('.thumb');
const viewerImg = document.getElementById('viewerImg');

thumbs.forEach(btn => {
  btn.addEventListener('click', () => selectImage(btn));
});

function selectImage(btn) {
  thumbs.forEach(b => b.setAttribute('aria-current', 'false'));
  btn.setAttribute('aria-current', 'true');

  const fullSrc = btn.getAttribute('data-full');
  viewerImg.style.opacity = 0;

  const tempImg = new Image();
  tempImg.onload = () => {
    viewerImg.src = fullSrc;
    viewerImg.alt = btn.getAttribute('aria-label') + ' (displayed)';
    viewerImg.style.opacity = 1;
  };
  tempImg.src = fullSrc;
}
