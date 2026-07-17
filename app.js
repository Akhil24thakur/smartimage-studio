document.addEventListener('DOMContentLoaded', () => {

  /* ─── Theme ──────────────────────────────────── */

  const themeToggle = document.getElementById('themeToggle');
  const html = document.documentElement;

  const stored = localStorage.getItem('theme');
  if (stored) {
    html.setAttribute('data-theme', stored);
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }

  themeToggle.addEventListener('click', () => {
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });

  /* ─── Mobile Menu ────────────────────────────── */

  const mobileBtn = document.getElementById('mobileMenu');
  const navLinks = document.getElementById('navLinks');

  mobileBtn.addEventListener('click', () => navLinks.classList.toggle('open'));
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => navLinks.classList.remove('open'));
  });

  /* ─── Tab Switching ─────────────────────────── */

  function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tool-tab').forEach(t => t.classList.remove('active'));

    const content = document.getElementById(tabId);
    const tab = document.querySelector(`.tool-tab[data-tab="${tabId.replace('tab-', '')}"]`);
    if (content) content.classList.add('active');
    if (tab) tab.classList.add('active');
  }

  document.querySelectorAll('.tool-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('tab-' + tab.getAttribute('data-tab'));
    });
  });

  if (window.location.hash === '#pdf-tool') switchTab('tab-pdf');
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#pdf-tool') switchTab('tab-pdf');
    else switchTab('tab-optimizer');
  });

  /* ─── Helpers ────────────────────────────────── */

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /* ─── Toast ──────────────────────────────────── */

  let toastTimer;
  function showToast(message) {
    const toast = document.getElementById('toast');
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.style.display = 'block';
    toast.style.opacity = '1';
    toastTimer = setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => { toast.style.display = 'none'; }, 300);
    }, 3000);
  }

  /* ═══════════════════════════════════════════════
     OPTIMIZER TAB
     ═══════════════════════════════════════════════ */

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const dropzoneContent = document.getElementById('dropzoneContent');
  const editor = document.getElementById('editor');

  const previewOriginal = document.getElementById('previewOriginal');
  const previewCompressed = document.getElementById('previewCompressed');
  const originalDims = document.getElementById('originalDims');
  const compressedDims = document.getElementById('compressedDims');
  const resultPlaceholder = document.getElementById('resultPlaceholder');

  const qualitySlider = document.getElementById('qualitySlider');
  const qualityValue = document.getElementById('qualityValue');
  const formatSelect = document.getElementById('formatSelect');
  const widthInput = document.getElementById('widthInput');
  const heightInput = document.getElementById('heightInput');
  const ratioLock = document.getElementById('ratioLock');

  const originalSize = document.getElementById('originalSize');
  const compressedSize = document.getElementById('compressedSize');
  const savings = document.getElementById('savings');
  const statsRow = document.getElementById('statsRow');

  const processBtn = document.getElementById('processBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const resetBtn = document.getElementById('resetBtn');

  let optFile = null;
  let optFileSize = 0;
  let optImageUrl = null;
  let optWidth = 0;
  let optHeight = 0;
  let optAspect = 1;
  let optBlob = null;
  let optBlobSize = 0;
  let optLocked = true;

  ratioLock.classList.add('locked');

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) handleOptFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) handleOptFile(fileInput.files[0]);
  });

  function handleOptFile(file) {
    const valid = ['image/png', 'image/jpeg', 'image/webp'];
    if (!valid.includes(file.type)) {
      showToast('Please upload a PNG, JPG, or WebP image.');
      return;
    }
    optFile = file;
    optFileSize = file.size;

    dropzoneContent.innerHTML = `
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">
        <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
        <polyline points="16 16 12 12 8 16"/>
      </svg>
      <p><strong>${file.name}</strong></p>
      <span class="dropzone-hint">${formatBytes(file.size)}</span>
    `;

    const reader = new FileReader();
    reader.onload = (e) => {
      optImageUrl = e.target.result;
      previewOriginal.src = optImageUrl;
      const img = new Image();
      img.onload = () => {
        optWidth = img.width;
        optHeight = img.height;
        optAspect = optWidth / optHeight;
        widthInput.value = optWidth;
        heightInput.value = optHeight;
        originalDims.textContent = `${optWidth} × ${optHeight}`;
      };
      img.src = optImageUrl;
    };
    reader.readAsDataURL(file);

    dropzone.classList.add('hidden');
    editor.classList.remove('hidden');
    resetOptResults();
    setTimeout(() => editor.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  function resetOptResults() {
    previewCompressed.classList.add('hidden');
    compressedDims.classList.add('hidden');
    resultPlaceholder.classList.remove('hidden');
    statsRow.classList.add('hidden');
    downloadBtn.classList.add('hidden');
    optBlob = null;
    optBlobSize = 0;
  }

  ratioLock.addEventListener('click', () => {
    optLocked = !optLocked;
    ratioLock.classList.toggle('locked', optLocked);
  });

  widthInput.addEventListener('input', () => {
    if (optLocked && optWidth > 0) heightInput.value = Math.round(parseInt(widthInput.value) / optAspect);
  });

  heightInput.addEventListener('input', () => {
    if (optLocked && optHeight > 0) widthInput.value = Math.round(parseInt(heightInput.value) * optAspect);
  });

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      widthInput.value = parseInt(btn.getAttribute('data-w'));
      heightInput.value = parseInt(btn.getAttribute('data-h'));
    });
  });

  processBtn.addEventListener('click', () => {
    if (!optImageUrl) { showToast('Upload an image first.'); return; }

    const img = new Image();
    img.onload = () => {
      const quality = parseInt(qualitySlider.value) / 100;
      let w = parseInt(widthInput.value) || optWidth;
      let h = parseInt(heightInput.value) || optHeight;
      if (w < 1) w = 1;
      if (h < 1) h = 1;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob((blob) => {
        if (!blob) { showToast('Processing failed.'); return; }
        optBlob = blob;
        optBlobSize = blob.size;

        previewCompressed.src = URL.createObjectURL(blob);
        previewCompressed.classList.remove('hidden');
        compressedDims.textContent = `${w} × ${h}`;
        compressedDims.classList.remove('hidden');
        resultPlaceholder.classList.add('hidden');

        originalSize.textContent = formatBytes(optFileSize);
        compressedSize.textContent = formatBytes(optBlobSize);
        const pct = optFileSize > 0 ? Math.round(((optFileSize - optBlobSize) / optFileSize) * 100) : 0;
        savings.textContent = pct > 0 ? `${pct}%` : '0%';
        savings.style.color = pct > 0 ? 'var(--accent)' : 'var(--text-tertiary)';
        statsRow.classList.remove('hidden');
        downloadBtn.classList.remove('hidden');
        showToast('Processing complete');
      }, formatSelect.value, quality);
    };
    img.src = optImageUrl;
  });

  downloadBtn.addEventListener('click', () => {
    if (!optBlob) return;
    const mime = formatSelect.value;
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mime] || 'jpg';
    const name = optFile ? optFile.name.replace(/\.[^.]+$/, '') : 'image';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(optBlob);
    link.download = `${name}-shrink.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showToast('Downloaded');
  });

  resetBtn.addEventListener('click', () => {
    optFile = null; optFileSize = 0; optWidth = 0; optHeight = 0; optBlob = null; optBlobSize = 0;
    if (optImageUrl) { URL.revokeObjectURL(optImageUrl); optImageUrl = null; }
    fileInput.value = '';
    qualitySlider.value = 80; qualityValue.textContent = '80';
    widthInput.value = ''; heightInput.value = '';
    previewOriginal.src = ''; previewCompressed.src = '';
    originalDims.textContent = ''; compressedDims.textContent = '';
    originalSize.textContent = '—'; compressedSize.textContent = '—'; savings.textContent = '—';
    resetOptResults();
    dropzone.classList.remove('hidden');
    editor.classList.add('hidden');
    dropzoneContent.innerHTML = `
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      <p><strong>Click to upload</strong> or drag and drop</p>
      <span class="dropzone-hint">PNG, JPG, or WebP up to 50MB</span>
    `;
  });

  /* ═══════════════════════════════════════════════
     CONVERT TAB
     ═══════════════════════════════════════════════ */

  const convertDropzone = document.getElementById('convertDropzone');
  const convertFileInput = document.getElementById('convertFileInput');
  const convertEditor = document.getElementById('convertEditor');
  const convertPreview = document.getElementById('convertPreview');
  const convertResult = document.getElementById('convertResult');
  const convertPlaceholder = document.getElementById('convertPlaceholder');
  const convertFormat = document.getElementById('convertFormat');
  const convertQuality = document.getElementById('convertQuality');
  const convertQualityValue = document.getElementById('convertQualityValue');
  const convertBtn = document.getElementById('convertBtn');
  const convertDownloadBtn = document.getElementById('convertDownloadBtn');
  const convertResetBtn = document.getElementById('convertResetBtn');

  let convFile = null;
  let convImageUrl = null;
  let convBlob = null;

  convertDropzone.addEventListener('click', () => convertFileInput.click());
  convertDropzone.addEventListener('dragover', (e) => { e.preventDefault(); convertDropzone.classList.add('drag-over'); });
  convertDropzone.addEventListener('dragleave', () => convertDropzone.classList.remove('drag-over'));
  convertDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    convertDropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) handleConvFile(e.dataTransfer.files[0]);
  });
  convertFileInput.addEventListener('change', () => {
    if (convertFileInput.files.length > 0) handleConvFile(convertFileInput.files[0]);
  });
  convertQuality.addEventListener('input', () => { convertQualityValue.textContent = convertQuality.value; });

  function handleConvFile(file) {
    const valid = ['image/png', 'image/jpeg', 'image/webp'];
    if (!valid.includes(file.type)) { showToast('Please upload a PNG, JPG, or WebP image.'); return; }
    convFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      convImageUrl = e.target.result;
      convertPreview.src = convImageUrl;
      convertEditor.classList.remove('hidden');
      convertDropzone.classList.add('hidden');
      convertResult.classList.add('hidden');
      convertPlaceholder.classList.remove('hidden');
      convertDownloadBtn.classList.add('hidden');
      setTimeout(() => convertEditor.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    };
    reader.readAsDataURL(file);
  }

  convertBtn.addEventListener('click', () => {
    if (!convImageUrl) { showToast('Upload an image first.'); return; }
    const img = new Image();
    img.onload = () => {
      const quality = parseInt(convertQuality.value) / 100;
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) { showToast('Conversion failed.'); return; }
        convBlob = blob;
        convertResult.src = URL.createObjectURL(blob);
        convertResult.classList.remove('hidden');
        convertPlaceholder.classList.add('hidden');
        convertDownloadBtn.classList.remove('hidden');
        showToast('Conversion complete');
      }, convertFormat.value, quality);
    };
    img.src = convImageUrl;
  });

  convertDownloadBtn.addEventListener('click', () => {
    if (!convBlob) return;
    const mime = convertFormat.value;
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mime] || 'jpg';
    const name = convFile ? convFile.name.replace(/\.[^.]+$/, '') : 'image';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(convBlob);
    link.download = `${name}.${ext}`;
    document.body.appendChild(link); link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showToast('Downloaded');
  });

  convertResetBtn.addEventListener('click', () => {
    convFile = null; convBlob = null;
    if (convImageUrl) { URL.revokeObjectURL(convImageUrl); convImageUrl = null; }
    convertFileInput.value = '';
    convertPreview.src = ''; convertResult.src = '';
    convertResult.classList.add('hidden');
    convertPlaceholder.classList.remove('hidden');
    convertDownloadBtn.classList.add('hidden');
    convertEditor.classList.add('hidden');
    convertDropzone.classList.remove('hidden');
  });

  /* ═══════════════════════════════════════════════
     PDF TAB
     ═══════════════════════════════════════════════ */

  const pdfDropzone = document.getElementById('pdfDropzone');
  const pdfFileInput = document.getElementById('pdfFileInput');
  const pdfEditor = document.getElementById('pdfEditor');
  const pdfList = document.getElementById('pdfList');
  const pdfDownloadBtn = document.getElementById('pdfDownloadBtn');
  const pdfPageSize = document.getElementById('pdfPageSize');
  const pdfOrientation = document.getElementById('pdfOrientation');
  const pdfFit = document.getElementById('pdfFit');

  let pdfImages = [];

  pdfDropzone.addEventListener('click', () => pdfFileInput.click());
  pdfDropzone.addEventListener('dragover', (e) => { e.preventDefault(); pdfDropzone.classList.add('drag-over'); });
  pdfDropzone.addEventListener('dragleave', () => pdfDropzone.classList.remove('drag-over'));
  pdfDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    pdfDropzone.classList.remove('drag-over');
    Array.from(e.dataTransfer.files).forEach(f => handlePdfFile(f));
  });
  pdfFileInput.addEventListener('change', () => {
    Array.from(pdfFileInput.files).forEach(f => handlePdfFile(f));
    pdfFileInput.value = '';
  });

  function handlePdfFile(file) {
    const valid = ['image/png', 'image/jpeg', 'image/webp'];
    if (!valid.includes(file.type)) { showToast(`${file.name} is not supported.`); return; }
    if (pdfImages.some(i => i.name === file.name && i.size === file.size)) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      pdfImages.push({ name: file.name, size: file.size, dataUrl: e.target.result, file });
      renderPdfList();
      pdfEditor.classList.remove('hidden');
      pdfDropzone.classList.add('hidden');
    };
    reader.readAsDataURL(file);
  }

  function renderPdfList() {
    pdfList.innerHTML = '';
    pdfImages.forEach((img, i) => {
      const div = document.createElement('div');
      div.className = 'pdf-item';
      div.draggable = true;
      div.innerHTML = `
        <span class="pdf-item-order">${i + 1}</span>
        <img class="pdf-item-thumb" src="${img.dataUrl}" alt="${img.name}">
        <div class="pdf-item-info">
          <div class="pdf-item-name">${img.name}</div>
          <div class="pdf-item-size">${formatBytes(img.size)}</div>
        </div>
        <button class="pdf-item-remove" data-index="${i}" aria-label="Remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;

      div.querySelector('.pdf-item-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        pdfImages.splice(parseInt(e.currentTarget.getAttribute('data-index')), 1);
        renderPdfList();
        if (pdfImages.length === 0) { pdfEditor.classList.add('hidden'); pdfDropzone.classList.remove('hidden'); }
      });

      div.addEventListener('dragstart', () => { div.classList.add('dragging'); div.dragIdx = i; });
      div.addEventListener('dragend', () => {
        div.classList.remove('dragging');
        document.querySelectorAll('.pdf-item').forEach(el => el.classList.remove('drag-over-item'));
      });
      div.addEventListener('dragover', (e) => {
        e.preventDefault();
        document.querySelectorAll('.pdf-item').forEach(el => el.classList.remove('drag-over-item'));
        div.classList.add('drag-over-item');
      });
      div.addEventListener('dragleave', () => div.classList.remove('drag-over-item'));
      div.addEventListener('drop', (e) => {
        e.preventDefault();
        const from = div.dragIdx;
        const to = i;
        if (from === to) return;
        const [moved] = pdfImages.splice(from, 1);
        pdfImages.splice(to, 0, moved);
        renderPdfList();
      });
      pdfList.appendChild(div);
    });
  }

  pdfDownloadBtn.addEventListener('click', async () => {
    if (pdfImages.length === 0) { showToast('Add at least one image.'); return; }
    if (typeof window.jspdf === 'undefined') { showToast('PDF library loading. Try again.'); return; }

    const { jsPDF } = window.jspdf;
    const size = pdfPageSize.value;
    const orientation = pdfOrientation.value;
    const fit = pdfFit.value;
    const sizes = { a4: [210, 297], letter: [215.9, 279.4], legal: [215.9, 355.6] };
    const [pw, ph] = sizes[size] || sizes.a4;
    const pdf = new jsPDF({ orientation, unit: 'mm', format: size });

    for (let i = 0; i < pdfImages.length; i++) {
      if (i > 0) pdf.addPage();
      const img = await loadImage(pdfImages[i].dataUrl);
      const iw = img.width;
      const ih = img.height;
      const iRatio = iw / ih;
      const pRatio = pw / ph;

      let dw, dh;
      if (fit === 'contain') {
        if (iRatio > pRatio) { dw = pw; dh = pw / iRatio; }
        else { dh = ph; dw = ph * iRatio; }
      } else {
        if (iRatio > pRatio) { dh = ph; dw = ph * iRatio; }
        else { dw = pw; dh = pw / iRatio; }
      }
      const dx = (pw - dw) / 2;
      const dy = (ph - dh) / 2;
      pdf.addImage(img, 'JPEG', dx, dy, dw, dh, undefined, 'FAST');
    }
    pdf.save('images-combined.pdf');
    showToast('PDF downloaded');
  });

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  /* ═══════════════════════════════════════════════
     BILLING / NEWSLETTER / SCROLL
     ═══════════════════════════════════════════════ */

  const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        scrollObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.feature-card, .step-card, .testimonial-card, .pricing-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    scrollObserver.observe(el);
  });
});
