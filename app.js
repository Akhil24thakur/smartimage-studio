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
      const tabId = 'tab-' + tab.getAttribute('data-tab');
      switchTab(tabId);
      history.pushState(null, '', tab.getAttribute('href'));
    });
  });

  const tabHashes = { '#optimizer': 'tab-optimizer', '#pdf-tool': 'tab-pdf', '#convert': 'tab-convert', '#audio': 'tab-audio', '#docs': 'tab-documents', '#pdfedit': 'tab-pdfedit' };
  if (tabHashes[window.location.hash]) switchTab(tabHashes[window.location.hash]);
  window.addEventListener('hashchange', () => {
    if (tabHashes[window.location.hash]) switchTab(tabHashes[window.location.hash]);
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
  const resizeUnit = document.getElementById('resizeUnit');
  const widthUnitLabel = document.getElementById('widthUnitLabel');
  const heightUnitLabel = document.getElementById('heightUnitLabel');

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
  let optUnit = 'px';
  const unitToPx = { px: 1, cm: 37.795, mm: 3.7795, in: 96, pt: 1.333, percent: 1 };
  const unitLabels = { px: 'px', cm: 'cm', mm: 'mm', in: 'in', pt: 'pt', percent: '%' };

  function pxToUnit(px, unit) {
    if (unit === 'percent') return px; // stored as px, displayed as px
    return px / unitToPx[unit];
  }

  function unitToPxValue(val, unit, originalPx) {
    if (unit === 'percent') return Math.round((val / 100) * originalPx);
    return Math.round(val * unitToPx[unit]);
  }

  function updateUnitLabels() {
    const lbl = unitLabels[optUnit] || 'px';
    widthUnitLabel.textContent = lbl;
    heightUnitLabel.textContent = lbl;
  }

  function convertOptInputsToPx() {
    const w = parseFloat(widthInput.value) || 0;
    const h = parseFloat(heightInput.value) || 0;
    return {
      w: unitToPxValue(w, optUnit, optWidth),
      h: unitToPxValue(h, optUnit, optHeight)
    };
  }

  function convertOptInputsFromPx(pxW, pxH) {
    if (optUnit === 'percent') {
      widthInput.value = Math.round((pxW / optWidth) * 100);
      heightInput.value = Math.round((pxH / optHeight) * 100);
    } else {
      widthInput.value = parseFloat(pxToUnit(pxW, optUnit).toFixed(2));
      heightInput.value = parseFloat(pxToUnit(pxH, optUnit).toFixed(2));
    }
  }

  resizeUnit.addEventListener('change', () => {
    const oldUnit = optUnit;
    optUnit = resizeUnit.value;
    updateUnitLabels();
    const inPx = convertOptInputsToPx();
    const origPxW = inPx.w || optWidth;
    const origPxH = inPx.h || optHeight;
    convertOptInputsFromPx(origPxW, origPxH);
  });

  ratioLock.classList.add('locked');
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
        <polyline points="16 1 12 12 8 1"/><line x1="12" y1="12" x2="12" y2="21"/>
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
        convertOptInputsFromPx(optWidth, optHeight);
        originalDims.textContent = `${optWidth} × ${optHeight} px`;
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
    if (optLocked && optWidth > 0) {
      const pxVals = convertOptInputsToPx();
      const hPx = Math.round(pxVals.w / optAspect) || 1;
      convertOptInputsFromPx(pxVals.w, hPx);
    }
  });

  heightInput.addEventListener('input', () => {
    if (optLocked && optHeight > 0) {
      const pxVals = convertOptInputsToPx();
      const wPx = Math.round(pxVals.h * optAspect) || 1;
      convertOptInputsFromPx(wPx, pxVals.h);
    }
  });

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const w = parseInt(btn.getAttribute('data-w'));
      const h = parseInt(btn.getAttribute('data-h'));
      if (optUnit === 'percent') {
        widthInput.value = Math.round((w / optWidth) * 100);
        heightInput.value = Math.round((h / optHeight) * 100);
      } else {
        widthInput.value = parseFloat(pxToUnit(w, optUnit).toFixed(2));
        heightInput.value = parseFloat(pxToUnit(h, optUnit).toFixed(2));
      }
    });
  });

  processBtn.addEventListener('click', () => {
    if (!optImageUrl) { showToast('Upload an image first.'); return; }

    const img = new Image();
    img.onload = () => {
      const quality = parseInt(qualitySlider.value) / 100;
      const pxVals = convertOptInputsToPx();
      let w = pxVals.w || optWidth;
      let h = pxVals.h || optHeight;
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
     DOCUMENT CONVERTER TAB
     ═══════════════════════════════════════════════ */

  const docDropzone = document.getElementById('docDropzone');
  const docFileInput = document.getElementById('docFileInput');
  const docEditor = document.getElementById('docEditor');
  const docFileName = document.getElementById('docFileName');
  const docFileMeta = document.getElementById('docFileMeta');
  const docPlaceholder = document.getElementById('docPlaceholder');
  const docFormat = document.getElementById('docFormat');
  const docConvertBtn = document.getElementById('docConvertBtn');
  const docDownloadBtn = document.getElementById('docDownloadBtn');
  const docResetBtn = document.getElementById('docResetBtn');
  const docPreviewWrapper = document.getElementById('docPreviewWrapper');
  const docPreviewContent = document.getElementById('docPreviewContent');

  let docFile = null;
  let docContent = null;
  let docBlob = null;
  let docDetectedFormat = null;

  docDropzone.addEventListener('click', () => docFileInput.click());
  docDropzone.addEventListener('dragover', (e) => { e.preventDefault(); docDropzone.classList.add('drag-over'); });
  docDropzone.addEventListener('dragleave', () => docDropzone.classList.remove('drag-over'));
  docDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    docDropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) handleDocFile(e.dataTransfer.files[0]);
  });
  docFileInput.addEventListener('change', () => {
    if (docFileInput.files.length > 0) handleDocFile(docFileInput.files[0]);
  });

  function detectFormat(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.docx')) return 'docx';
    if (name.endsWith('.pptx')) return 'pptx';
    if (name.endsWith('.txt')) return 'txt';
    if (name.endsWith('.html') || name.endsWith('.htm')) return 'html';
    if (name.endsWith('.md')) return 'md';
    if (name.endsWith('.csv')) return 'csv';
    if (name.endsWith('.xml')) return 'xml';
    if (name.endsWith('.json')) return 'json';
    if (name.endsWith('.rtf')) return 'rtf';
    return 'txt';
  }

  async function readDocContent(file) {
    const fmt = detectFormat(file);
    if (fmt === 'docx') {
      if (typeof mammoth === 'undefined') { showToast('DOCX library not loaded.'); return null; }
      const arrayBuf = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuf });
      return { content: result.value, format: 'html' };
    }
    if (fmt === 'pptx') {
      const text = await file.text();
      return { content: text, format: 'txt' };
    }
    const text = await file.text();
    return { content: text, format: fmt };
  }

  async function handleDocFile(file) {
    docFile = file;
    docDetectedFormat = detectFormat(file);

    docFileName.textContent = file.name;
    docFileMeta.textContent = `${formatBytes(file.size)} — ${docDetectedFormat.toUpperCase()}`;
    docEditor.classList.remove('hidden');
    docDropzone.classList.add('hidden');
    docPlaceholder.classList.remove('hidden');
    docPreviewWrapper.classList.add('hidden');
    docDownloadBtn.classList.add('hidden');
    docConvertBtn.disabled = false;
    docConvertBtn.textContent = 'Convert';

    const result = await readDocContent(file);
    if (!result) { showToast('Could not read document.'); return; }
    docContent = result.content;
    docDetectedFormat = result.format;

    if (result.format === 'html' || result.format === 'md') {
      docPreviewWrapper.classList.remove('hidden');
      docPreviewContent.innerHTML = result.content;
    } else {
      docPreviewWrapper.classList.remove('hidden');
      docPreviewContent.textContent = result.content;
    }

    setTimeout(() => docEditor.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  function stripHtml(html) {
    const d = document.createElement('div');
    d.innerHTML = html;
    return d.textContent || d.innerText || '';
  }

  function htmlToMarkdown(html) {
    let text = html
      .replace(/<h1[^>]*>/gi, '# ').replace(/<h2[^>]*>/gi, '## ').replace(/<h3[^>]*>/gi, '### ')
      .replace(/<h4[^>]*>/gi, '#### ').replace(/<\/h[1-4]>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '- ').replace(/<\/li>/gi, '\n')
      .replace(/<p[^>]*>/gi, '').replace(/<\/p>/gi, '\n\n')
      .replace(/<strong[^>]*>/gi, '**').replace(/<\/strong>/gi, '**')
      .replace(/<em[^>]*>/gi, '*').replace(/<\/em>/gi, '*')
      .replace(/<code[^>]*>/gi, '`').replace(/<\/code>/gi, '`')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n').trim();
    return text;
  }

  function generateDocBlob(content, format) {
    if (format === 'txt') return new Blob([content], { type: 'text/plain' });
    if (format === 'html') return new Blob([content], { type: 'text/html' });
    if (format === 'md') return new Blob([content], { type: 'text/markdown' });
    if (format === 'csv') return new Blob([content], { type: 'text/csv' });
    if (format === 'json') return new Blob([content], { type: 'application/json' });
    if (format === 'docx') {
      const html = `<html><body>${content.replace(/\n/g, '<br>')}</body></html>`;
      const blob = new Blob([html], { type: 'application/msword' });
      return blob;
    }
    if (format === 'pptx') {
      return null;
    }
    return new Blob([content], { type: 'text/plain' });
  }

  function textToSlides(text) {
    const lines = text.split('\n').filter(l => l.trim());
    const slides = [];
    let current = [];
    for (const line of lines) {
      if (line.trim() === '---' && current.length > 0) {
        slides.push(current.join('\n'));
        current = [];
      } else {
        current.push(line);
      }
    }
    if (current.length > 0) slides.push(current.join('\n'));
    if (slides.length === 0) slides.push(text);
    return slides;
  }

  async function createPptx(content, isHtml) {
    if (typeof PptxGenJS === 'undefined') { showToast('PPTX library not loaded.'); return null; }
    const pres = new PptxGenJS();
    let text = isHtml ? stripHtml(content) : content;
    const slides = textToSlides(text);
    for (const slideText of slides) {
      const slide = pres.addSlide();
      const lines = slideText.split('\n').filter(l => l.trim());
      const title = lines[0] || 'Slide';
      const body = lines.slice(1).join('\n');
      slide.addText(title, { x: 0.5, y: 0.5, w: 9, h: 1, fontSize: 28, bold: true, color: '059969' });
      if (body) {
        slide.addText(body, { x: 0.5, y: 1.6, w: 9, h: 5, fontSize: 16, valign: 'top', lineSpacing: 22 });
      }
    }
    return pres.output({ type: 'blob' });
  }

  docConvertBtn.addEventListener('click', async () => {
    if (!docContent) { showToast('Upload a document first.'); return; }
    const target = docFormat.value;
    docConvertBtn.disabled = true;
    docConvertBtn.textContent = 'Converting...';

    try {
      let blob = null;
      let ext = 'txt';

      if (target === 'txt') {
        const text = docDetectedFormat === 'html' ? stripHtml(docContent) : docContent;
        blob = new Blob([text], { type: 'text/plain' });
        ext = 'txt';
      } else if (target === 'html') {
        const html = docDetectedFormat === 'html' ? docContent :
                     `<html><body><pre>${docContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`;
        blob = new Blob([html], { type: 'text/html' });
        ext = 'html';
      } else if (target === 'md') {
        const md = docDetectedFormat === 'html' ? htmlToMarkdown(docContent) : docContent;
        blob = new Blob([md], { type: 'text/markdown' });
        ext = 'md';
      } else if (target === 'csv') {
        const text = docDetectedFormat === 'html' ? stripHtml(docContent) : docContent;
        blob = new Blob([text], { type: 'text/csv' });
        ext = 'csv';
      } else if (target === 'json') {
        const text = docDetectedFormat === 'html' ? stripHtml(docContent) : docContent;
        blob = new Blob([text], { type: 'application/json' });
        ext = 'json';
      } else if (target === 'docx') {
        const text = docDetectedFormat === 'html' ? stripHtml(docContent) : docContent;
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${text.replace(/\n/g, '<br>')}</body></html>`;
        blob = new Blob([html], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        ext = 'docx';
      } else if (target === 'pptx') {
        const text = docDetectedFormat === 'html' ? stripHtml(docContent) : docContent;
        blob = await createPptx(text, false);
        if (!blob) { showToast('PPTX creation failed. Try another format.'); docConvertBtn.disabled = false; docConvertBtn.textContent = 'Convert'; return; }
        ext = 'pptx';
      }

      if (!blob) { showToast('Conversion failed.'); docConvertBtn.disabled = false; docConvertBtn.textContent = 'Convert'; return; }

      docBlob = blob;
      docPlaceholder.innerHTML = `
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <p style="color: var(--accent); font-weight: 600;">Conversion complete</p>
        <span class="dropzone-hint">${formatBytes(blob.size)}</span>
      `;
      docDownloadBtn.classList.remove('hidden');
      docDownloadBtn.setAttribute('data-ext', ext);
      showToast('Conversion complete');
    } catch (err) {
      showToast('Conversion failed.');
    }

    docConvertBtn.disabled = false;
    docConvertBtn.textContent = 'Convert';
  });

  docDownloadBtn.addEventListener('click', () => {
    if (!docBlob) return;
    const ext = docDownloadBtn.getAttribute('data-ext') || 'txt';
    const name = docFile ? docFile.name.replace(/\.[^.]+$/, '') : 'document';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(docBlob);
    link.download = `${name}.${ext}`;
    document.body.appendChild(link); link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showToast('Downloaded');
  });

  docResetBtn.addEventListener('click', () => {
    docFile = null; docContent = null; docBlob = null; docDetectedFormat = null;
    docFileInput.value = '';
    docFileName.textContent = '—';
    docFileMeta.textContent = '—';
    docPreviewContent.innerHTML = '';
    docPreviewWrapper.classList.add('hidden');
    docPlaceholder.innerHTML = '<p>Select format and convert</p>';
    docDownloadBtn.classList.add('hidden');
    docEditor.classList.add('hidden');
    docDropzone.classList.remove('hidden');
    docConvertBtn.disabled = false;
    docConvertBtn.textContent = 'Convert';
  });

  /* ═══════════════════════════════════════════════
     PDF EDITOR TAB
     ═══════════════════════════════════════════════ */

  const pdfEditDropzone = document.getElementById('pdfEditDropzone');
  const pdfEditFileInput = document.getElementById('pdfEditFileInput');
  const pdfEditEditor = document.getElementById('pdfEditEditor');
  const pdfEditFileName = document.getElementById('pdfEditFileName');
  const pdfEditFileMeta = document.getElementById('pdfEditFileMeta');
  const pdfEditPageGrid = document.getElementById('pdfEditPageGrid');
  const pdfEditDeleteBtn = document.getElementById('pdfEditDeleteBtn');
  const pdfEditExtractBtn = document.getElementById('pdfEditExtractBtn');
  const pdfEditCompressBtn = document.getElementById('pdfEditCompressBtn');
  const pdfEditDownloadBtn = document.getElementById('pdfEditDownloadBtn');
  const pdfEditResetBtn = document.getElementById('pdfEditResetBtn');

  let pdfEditFile = null;
  let pdfEditDoc = null;
  let pdfEditPages = [];
  let pdfEditSelected = new Set();
  let pdfEditOriginalSize = 0;

  pdfEditDropzone.addEventListener('click', () => pdfEditFileInput.click());
  pdfEditDropzone.addEventListener('dragover', (e) => { e.preventDefault(); pdfEditDropzone.classList.add('drag-over'); });
  pdfEditDropzone.addEventListener('dragleave', () => pdfEditDropzone.classList.remove('drag-over'));
  pdfEditDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    pdfEditDropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) handlePdfEditFile(e.dataTransfer.files[0]);
  });
  pdfEditFileInput.addEventListener('change', () => {
    if (pdfEditFileInput.files.length > 0) handlePdfEditFile(pdfEditFileInput.files[0]);
  });

  async function handlePdfEditFile(file) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Please upload a PDF file.'); return;
    }
    pdfEditFile = file;
    pdfEditOriginalSize = file.size;
    pdfEditFileName.textContent = file.name;
    pdfEditFileMeta.textContent = `${formatBytes(file.size)} — loading...`;
    pdfEditEditor.classList.remove('hidden');
    pdfEditDropzone.classList.add('hidden');

    const arrayBuf = await file.arrayBuffer();
    if (typeof pdfLib === 'undefined') { showToast('PDF library not loaded.'); return; }
    pdfEditDoc = await pdfLib.PDFDocument.load(arrayBuf);
    const pageCount = pdfEditDoc.getPageCount();
    pdfEditPages = Array.from({ length: pageCount }, (_, i) => i);
    pdfEditSelected = new Set();
    pdfEditFileMeta.textContent = `${formatBytes(file.size)} — ${pageCount} pages`;

    renderPdfEditPages();
    renderPdfEditThumbnails(arrayBuf);
    setTimeout(() => pdfEditEditor.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  async function renderPdfEditThumbnails(arrayBuf) {
    try {
      if (typeof pdfjsLib === 'undefined') return;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuf) }).promise;
      for (let i = 0; i < pdf.numPages; i++) {
        const page = await pdf.getPage(i + 1);
        const viewport = page.getViewport({ scale: 0.3 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const thumb = document.querySelector(`.pdf-page-item[data-page="${i}"] .pdf-page-thumb`);
        if (thumb) thumb.src = canvas.toDataURL();
      }
    } catch (e) { /* thumbs are optional */ }
  }

  function renderPdfEditPages() {
    pdfEditPageGrid.innerHTML = '';
    pdfEditPages.forEach((pageIdx, i) => {
      const div = document.createElement('div');
      div.className = 'pdf-page-item' + (pdfEditSelected.has(i) ? ' selected' : '');
      div.draggable = true;
      div.setAttribute('data-page', pageIdx);
      div.innerHTML = `
        <div class="pdf-page-check"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
        <img class="pdf-page-thumb" alt="Page ${i + 1}">
        <div class="pdf-page-num">${i + 1}</div>
      `;
      div.addEventListener('click', (e) => {
        if (e.target.closest('.pdf-page-check') || e.target.closest('.pdf-page-thumb') || e.target.closest('.pdf-page-num')) {
          if (pdfEditSelected.has(i)) pdfEditSelected.delete(i);
          else pdfEditSelected.add(i);
          renderPdfEditPages();
        }
      });
      div.addEventListener('dragstart', () => { div.classList.add('dragging'); div.dragIdx = i; });
      div.addEventListener('dragend', () => {
        div.classList.remove('dragging');
        document.querySelectorAll('.pdf-page-item').forEach(el => el.classList.remove('drag-over-item'));
      });
      div.addEventListener('dragover', (e) => {
        e.preventDefault();
        document.querySelectorAll('.pdf-page-item').forEach(el => el.classList.remove('drag-over-item'));
        div.classList.add('drag-over-item');
      });
      div.addEventListener('dragleave', () => div.classList.remove('drag-over-item'));
      div.addEventListener('drop', (e) => {
        e.preventDefault();
        const from = div.dragIdx;
        const to = i;
        if (from === to) return;
        const [moved] = pdfEditPages.splice(from, 1);
        pdfEditPages.splice(to, 0, moved);
        pdfEditSelected = new Set();
        renderPdfEditPages();
      });
      pdfEditPageGrid.appendChild(div);
    });
  }

  async function buildPdfFromPages(pages, compress) {
    const newDoc = await pdfLib.PDFDocument.create();
    for (const pageIdx of pages) {
      const [copiedPage] = await newDoc.copyPages(pdfEditDoc, [pageIdx]);
      newDoc.addPage(copiedPage);
    }
    if (compress) {
      const bytes = await newDoc.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 50 });
      return new Blob([bytes], { type: 'application/pdf' });
    }
    const bytes = await newDoc.save();
    return new Blob([bytes], { type: 'application/pdf' });
  }

  pdfEditDeleteBtn.addEventListener('click', async () => {
    if (pdfEditSelected.size === 0) { showToast('Select pages to delete.'); return; }
    const indices = [...pdfEditSelected].sort((a, b) => b - a);
    for (const idx of indices) pdfEditPages.splice(idx, 1);
    pdfEditSelected = new Set();
    renderPdfEditPages();
    const blob = await buildPdfFromPages(pdfEditPages, false);
    pdfEditDoc = await pdfLib.PDFDocument.load(await blob.arrayBuffer());
    pdfEditFileMeta.textContent = `${formatBytes(blob.size)} — ${pdfEditPages.length} pages`;
    showToast('Pages deleted');
  });

  pdfEditExtractBtn.addEventListener('click', async () => {
    if (pdfEditSelected.size === 0) { showToast('Select pages to extract.'); return; }
    const indices = [...pdfEditSelected].sort((a, b) => a - b);
    const blob = await buildPdfFromPages(indices.map(i => pdfEditPages[i]), false);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = pdfEditFile.name.replace('.pdf', '-extracted.pdf');
    document.body.appendChild(link); link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showToast('Extracted pages downloaded');
  });

  pdfEditCompressBtn.addEventListener('click', async () => {
    pdfEditCompressBtn.disabled = true;
    pdfEditCompressBtn.textContent = 'Compressing...';
    try {
      const blob = await buildPdfFromPages(pdfEditPages, true);
      pdfEditDoc = await pdfLib.PDFDocument.load(await blob.arrayBuffer());
      pdfEditFileMeta.textContent = `${formatBytes(blob.size)} — ${pdfEditPages.length} pages (was ${formatBytes(pdfEditOriginalSize)})`;
      showToast('PDF compressed');
    } catch (e) { showToast('Compression failed.'); }
    pdfEditCompressBtn.disabled = false;
    pdfEditCompressBtn.textContent = 'Compress';
  });

  pdfEditDownloadBtn.addEventListener('click', async () => {
    const blob = await buildPdfFromPages(pdfEditPages, false);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = pdfEditFile.name.replace('.pdf', '-edited.pdf');
    document.body.appendChild(link); link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showToast('Downloaded');
  });

  pdfEditResetBtn.addEventListener('click', () => {
    pdfEditFile = null; pdfEditDoc = null; pdfEditPages = []; pdfEditSelected = new Set(); pdfEditOriginalSize = 0;
    pdfEditFileInput.value = '';
    pdfEditFileName.textContent = '—';
    pdfEditFileMeta.textContent = '—';
    pdfEditPageGrid.innerHTML = '';
    pdfEditEditor.classList.add('hidden');
    pdfEditDropzone.classList.remove('hidden');
  });

  /* ═══════════════════════════════════════════════
     SCROLL
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

  /* ═══════════════════════════════════════════════
     AUDIO TAB
     ═══════════════════════════════════════════════ */

  const audioDropzone = document.getElementById('audioDropzone');
  const audioFileInput = document.getElementById('audioFileInput');
  const audioEditor = document.getElementById('audioEditor');
  const audioDetails = document.getElementById('audioDetails');
  const audioPlaceholder = document.getElementById('audioPlaceholder');
  const audioFormat = document.getElementById('audioFormat');
  const audioBitrate = document.getElementById('audioBitrate');
  const audioBitrateValue = document.getElementById('audioBitrateValue');
  const audioConvertBtn = document.getElementById('audioConvertBtn');
  const audioDownloadBtn = document.getElementById('audioDownloadBtn');
  const audioResetBtn = document.getElementById('audioResetBtn');

  let audioFile = null;
  let audioBuffer = null;
  let audioBlob = null;
  let audioCtx = null;

  audioDropzone.addEventListener('click', () => audioFileInput.click());
  audioDropzone.addEventListener('dragover', (e) => { e.preventDefault(); audioDropzone.classList.add('drag-over'); });
  audioDropzone.addEventListener('dragleave', () => audioDropzone.classList.remove('drag-over'));
  audioDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    audioDropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) handleAudioFile(e.dataTransfer.files[0]);
  });
  audioFileInput.addEventListener('change', () => {
    if (audioFileInput.files.length > 0) handleAudioFile(audioFileInput.files[0]);
  });
  audioBitrate.addEventListener('input', () => { audioBitrateValue.textContent = audioBitrate.value; });

  function handleAudioFile(file) {
    const valid = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/x-flac', 'audio/mp4', 'audio/aac', 'audio/x-m4a', 'audio/wma', 'audio/x-aiff'];
    if (!valid.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|flac|m4a|aac|wma|aiff|mp4)$/i)) {
      showToast('Please upload an MP3, WAV, OGG, FLAC, M4A, AAC, WMA, or AIFF file.');
      return;
    }
    audioFile = file;
    audioDetails.innerHTML = `
      <span class="audio-name">${file.name}</span>
      <span class="audio-meta">${formatBytes(file.size)}</span>
    `;
    audioEditor.classList.remove('hidden');
    audioDropzone.classList.add('hidden');
    audioPlaceholder.classList.remove('hidden');
    audioDownloadBtn.classList.add('hidden');
    audioConvertBtn.disabled = false;
    audioConvertBtn.textContent = 'Convert';

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioBuffer = await audioCtx.decodeAudioData(e.target.result.slice(0));
        const channels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const duration = audioBuffer.duration.toFixed(1);
        audioDetails.innerHTML = `
          <span class="audio-name">${file.name}</span>
          <span class="audio-meta">${formatBytes(file.size)} — ${duration}s — ${sampleRate}Hz — ${channels}ch</span>
        `;
      } catch (err) {
        showToast('Could not decode audio file.');
      }
    };
    reader.readAsArrayBuffer(file);
    setTimeout(() => audioEditor.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  audioConvertBtn.addEventListener('click', async () => {
    if (!audioBuffer) { showToast('Upload an audio file first.'); return; }
    audioConvertBtn.disabled = true;
    audioConvertBtn.textContent = 'Converting...';

    try {
      const format = audioFormat.value;
      const bitrate = parseInt(audioBitrate.value);
      const sr = audioBuffer.sampleRate;
      const numChannels = audioBuffer.numberOfChannels;

      let blob;
      if (format === 'wav') {
        blob = encodeWAV(audioBuffer);
      } else if (format === 'mp3') {
        blob = await encodeMP3(audioBuffer, bitrate);
      } else if (format === 'ogg') {
        blob = await encodeOGG(audioBuffer, bitrate);
      } else if (format === 'aac') {
        blob = await encodeAAC(audioBuffer, bitrate);
      } else if (format === 'flac') {
        blob = encodeWAV(audioBuffer);
      }

      if (!blob) { showToast('Conversion failed.'); audioConvertBtn.disabled = false; audioConvertBtn.textContent = 'Convert'; return; }
      audioBlob = blob;
      audioPlaceholder.innerHTML = `
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.5">
          <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
        </svg>
        <p style="color: var(--accent); font-weight: 600;">Conversion complete</p>
        <span class="dropzone-hint">${formatBytes(blob.size)}</span>
      `;
      audioDownloadBtn.classList.remove('hidden');
      showToast('Conversion complete');
    } catch (err) {
      showToast('Conversion failed.');
    }

    audioConvertBtn.disabled = false;
    audioConvertBtn.textContent = 'Convert';
  });

  function encodeWAV(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length;
    const dataLength = length * numChannels * 2;
    const bufferOut = new ArrayBuffer(44 + dataLength);
    const view = new DataView(bufferOut);

    function writeString(offset, string) {
      for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
    }

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    return new Blob([bufferOut], { type: 'audio/wav' });
  }

  function encodeMP3(buffer, bitrate) {
    return new Promise((resolve) => {
      try {
        const numChannels = Math.min(buffer.numberOfChannels, 2);
        const sampleRate = buffer.sampleRate;
        const samples = buffer.length;
        const mp3enc = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);
        const mp3Data = [];

        let leftData = buffer.getChannelData(0);
        let rightData = numChannels > 1 ? buffer.getChannelData(1) : null;

        const blockSize = 1152;
        for (let i = 0; i < samples; i += blockSize) {
          const end = Math.min(i + blockSize, samples);
          const leftChunk = new Int16Array(end - i);
          const rightChunk = numChannels > 1 ? new Int16Array(end - i) : null;

          for (let j = i; j < end; j++) {
            leftChunk[j - i] = Math.max(-32768, Math.min(32767, Math.round(leftData[j] * 32767)));
            if (rightData && rightChunk) {
              rightChunk[j - i] = Math.max(-32768, Math.min(32767, Math.round(rightData[j] * 32767)));
            }
          }

          let mp3buf;
          if (numChannels === 1) {
            mp3buf = mp3enc.encodeBuffer(leftChunk);
          } else {
            mp3buf = mp3enc.encodeBuffer(leftChunk, rightChunk);
          }
          if (mp3buf.length > 0) mp3Data.push(mp3buf);
        }

        const last = mp3enc.flush();
        if (last.length > 0) mp3Data.push(last);

        const blob = new Blob(mp3Data, { type: 'audio/mp3' });
        resolve(blob);
      } catch (e) {
        resolve(null);
      }
    });
  }

  function encodeOGG(buffer, bitrate) {
    return new Promise((resolve) => {
      try {
        const numChannels = Math.min(buffer.numberOfChannels, 2);
        const sampleRate = buffer.sampleRate;
        const length = buffer.length;

        const left = buffer.getChannelData(0);
        const right = numChannels > 1 ? buffer.getChannelData(1) : null;

        const mixed = new Float32Array(length * numChannels);
        for (let i = 0; i < length; i++) {
          mixed[i * numChannels] = left[i];
          if (right) mixed[i * numChannels + 1] = right[i];
        }

        const mediaStream = new MediaStream();
        const ctx = new OfflineAudioContext(numChannels, length, sampleRate);
        const src = ctx.createBufferSource();
        const buf = ctx.createBuffer(numChannels, length, sampleRate);
        for (let ch = 0; ch < numChannels; ch++) {
          buf.copyToChannel(buffer.getChannelData(Math.min(ch, buffer.numberOfChannels - 1)), ch);
        }
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start();

        ctx.startRendering().then((rendered) => {
          const outLength = rendered.length;
          const outLeft = rendered.getChannelData(0);
          const outRight = numChannels > 1 ? rendered.getChannelData(1) : null;

          const wavBuffer = new ArrayBuffer(44 + outLength * numChannels * 2);
          const view = new DataView(wavBuffer);

          function ws(offset, str) {
            for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
          }
          ws(0, 'RIFF');
          view.setUint32(4, 36 + outLength * numChannels * 2, true);
          ws(8, 'WAVE');
          ws(12, 'fmt ');
          view.setUint32(16, 16, true);
          view.setUint16(20, 1, true);
          view.setUint16(22, numChannels, true);
          view.setUint32(24, sampleRate, true);
          view.setUint32(28, sampleRate * numChannels * 2, true);
          view.setUint16(32, numChannels * 2, true);
          view.setUint16(34, 16, true);
          ws(36, 'data');
          view.setUint32(40, outLength * numChannels * 2, true);

          let off = 44;
          for (let i = 0; i < outLength; i++) {
            view.setInt16(off, Math.max(-32768, Math.min(32767, Math.round(outLeft[i] * 32767))), true); off += 2;
            if (outRight) { view.setInt16(off, Math.max(-32768, Math.min(32767, Math.round(outRight[i] * 32767))), true); off += 2; }
          }

          const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
          const url = URL.createObjectURL(wavBlob);

          const tempAudio = new Audio(url);
          const oggCtx = new (window.AudioContext || window.webkitAudioContext)();
          const msDest = oggCtx.createMediaElementSource(tempAudio);
          const dest = oggCtx.createMediaStreamDestination();
          msDest.connect(dest);

          let chunks = [];
          let recorder;
          try {
            recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/ogg; codecs=vorbis' });
          } catch (e) {
            resolve(null);
            return;
          }

          recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/ogg' });
            URL.revokeObjectURL(url);
            resolve(blob);
          };

          recorder.start();
          tempAudio.onended = () => recorder.stop();
          setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, Math.ceil((outLength / sampleRate) * 1000) + 500);
        }).catch(() => resolve(null));
      } catch (e) {
        resolve(null);
      }
    });
  }

  function encodeAAC(buffer, bitrate) {
    return new Promise((resolve) => {
      try {
        const numChannels = Math.min(buffer.numberOfChannels, 2);
        const sampleRate = buffer.sampleRate;
        const length = buffer.length;
        const ctx = new OfflineAudioContext(numChannels, length, sampleRate);
        const src = ctx.createBufferSource();
        const buf = ctx.createBuffer(numChannels, length, sampleRate);
        for (let ch = 0; ch < numChannels; ch++) {
          buf.copyToChannel(buffer.getChannelData(Math.min(ch, buffer.numberOfChannels - 1)), ch);
        }
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start();

        ctx.startRendering().then((rendered) => {
          const outLength = rendered.length;
          const outLeft = rendered.getChannelData(0);
          const outRight = numChannels > 1 ? rendered.getChannelData(1) : null;

          const wavBuf = new ArrayBuffer(44 + outLength * numChannels * 2);
          const view = new DataView(wavBuf);
          function ws(offset, str) {
            for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
          }
          ws(0, 'RIFF');
          view.setUint32(4, 36 + outLength * numChannels * 2, true);
          ws(8, 'WAVE');
          ws(12, 'fmt ');
          view.setUint32(16, 16, true);
          view.setUint16(20, 1, true);
          view.setUint16(22, numChannels, true);
          view.setUint32(24, sampleRate, true);
          view.setUint32(28, sampleRate * numChannels * 2, true);
          view.setUint16(32, numChannels * 2, true);
          view.setUint16(34, 16, true);
          ws(36, 'data');
          view.setUint32(40, outLength * numChannels * 2, true);
          let off = 44;
          for (let i = 0; i < outLength; i++) {
            view.setInt16(off, Math.max(-32768, Math.min(32767, Math.round(outLeft[i] * 32767))), true); off += 2;
            if (outRight) { view.setInt16(off, Math.max(-32768, Math.min(32767, Math.round(outRight[i] * 32767))), true); off += 2; }
          }
          const wavBlob = new Blob([wavBuf], { type: 'audio/wav' });
          const url = URL.createObjectURL(wavBlob);
          const tempAudio = new Audio(url);
          const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
          const msDest = tempCtx.createMediaElementSource(tempAudio);
          const dest = tempCtx.createMediaStreamDestination();
          msDest.connect(dest);
          const mime = MediaRecorder.isTypeSupported('audio/aac') ? 'audio/aac' :
                       MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : null;
          if (!mime) { resolve(encodeWAV(buffer)); return; }
          let chunks = [];
          const recorder = new MediaRecorder(dest.stream, { mimeType: mime });
          recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/mp4' });
            URL.revokeObjectURL(url);
            tempCtx.close();
            resolve(blob);
          };
          recorder.start();
          tempAudio.onended = () => recorder.stop();
          setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, Math.ceil((outLength / sampleRate) * 1000) + 500);
        }).catch(() => resolve(encodeWAV(buffer)));
      } catch (e) { resolve(encodeWAV(buffer)); }
    });
  }

  audioDownloadBtn.addEventListener('click', () => {
    if (!audioBlob) return;
    const fmt = audioFormat.value;
    const ext = { wav: 'wav', mp3: 'mp3', ogg: 'ogg', aac: 'm4a', flac: 'wav' }[fmt] || 'wav';
    const name = audioFile ? audioFile.name.replace(/\.[^.]+$/, '') : 'audio';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(audioBlob);
    link.download = `${name}.${ext}`;
    document.body.appendChild(link); link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showToast('Downloaded');
  });

  audioResetBtn.addEventListener('click', () => {
    audioFile = null; audioBuffer = null; audioBlob = null;
    if (audioCtx) { audioCtx.close(); audioCtx = null; }
    audioFileInput.value = '';
    audioDetails.innerHTML = '<span class="audio-name">—</span><span class="audio-meta">—</span>';
    audioPlaceholder.innerHTML = '<p>Select format and convert</p>';
    audioDownloadBtn.classList.add('hidden');
    audioEditor.classList.add('hidden');
    audioDropzone.classList.remove('hidden');
    audioConvertBtn.disabled = false;
    audioConvertBtn.textContent = 'Convert';
  });

  document.querySelectorAll('.feature-card, .step-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(16px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    scrollObserver.observe(el);
  });
});
