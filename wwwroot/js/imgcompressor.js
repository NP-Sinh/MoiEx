(function () {
    const fileInput = document.getElementById('fileInput');
    const selectBtn = document.getElementById('selectFilesBtn');
    const addMoreBtn = document.getElementById('addMoreBtn');
    const dropzone = document.getElementById('dropzone');
    const fileList = document.getElementById('fileList');
    const fileGrid = document.getElementById('fileGrid');
    const fileListTitle = document.getElementById('fileListTitle');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const compressBtn = document.getElementById('compressBtn');
    const qualitySlider = document.getElementById('qualitySlider');
    const qualityVal = document.getElementById('qualityVal');
    const progressWrap = document.getElementById('progressWrap');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const progressPct = document.getElementById('progressPct');
    const statCount = document.getElementById('statCount');
    const statSize = document.getElementById('statSize');
    const statSaved = document.getElementById('statSaved');
    const formatBtns = document.querySelectorAll('.tool-format-btn');

    const MAX_FILES = 10;
    let files = [];
    let selectedFormat = 'jpg';

    // ---- Format selector ----
    formatBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            formatBtns.forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            selectedFormat = btn.dataset.fmt;
        });
    });

    // ---- Quality slider ----
    qualitySlider.addEventListener('input', () => {
        qualityVal.textContent = qualitySlider.value + '%';
    });

    // ---- File picking ----
    selectBtn.addEventListener('click', () => fileInput.click());
    addMoreBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => addFiles(fileInput.files));

    // ---- Drag & drop ----
    ['dragenter', 'dragover'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add('drag-over'); }));
    ['dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove('drag-over'); }));
    dropzone.addEventListener('drop', e => addFiles(e.dataTransfer.files));

    function addFiles(newFiles) {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        const arr = Array.from(newFiles).filter(f => allowed.includes(f.type));
        const remaining = MAX_FILES - files.length;
        if (remaining <= 0) { alert('Đã đạt giới hạn 10 ảnh.'); return; }
        arr.slice(0, remaining).forEach(f => files.push(f));
        renderFileList();
        fileInput.value = '';
    }

    function renderFileList() {
        fileGrid.innerHTML = '';
        files.forEach((f, idx) => {
            const url = URL.createObjectURL(f);
            const item = document.createElement('div');
            item.className = 'tool-file-item';
            item.innerHTML = `
                <img class="tool-file-thumb" src="${url}" alt="${f.name}" />
                <div class="tool-file-overlay">
                    <span class="tool-file-name">${f.name}</span>
                    <span class="tool-file-size">${fmtSize(f.size)}</span>
                </div>
                <button class="tool-file-remove" data-idx="${idx}" title="Xóa ảnh">
                    <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>`;
            fileGrid.appendChild(item);
        });

        // Remove handlers
        fileGrid.querySelectorAll('.tool-file-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                files.splice(parseInt(btn.dataset.idx), 1);
                renderFileList();
            });
        });

        const visible = files.length > 0;
        dropzone.style.display = visible ? 'none' : 'flex';
        fileList.style.display = visible ? 'block' : 'none';
        fileListTitle.textContent = `${files.length} ảnh đã chọn`;
        compressBtn.disabled = files.length === 0;

        // Stats
        const totalBytes = files.reduce((s, f) => s + f.size, 0);
        statCount.textContent = files.length;
        statSize.textContent = fmtSize(totalBytes);
        statSaved.textContent = '—';

        if (files.length === 0) {
            dropzone.style.display = 'flex';
            fileList.style.display = 'none';
        }
    }

    clearAllBtn.addEventListener('click', () => { files = []; renderFileList(); });

    // ---- Compress ----
    compressBtn.addEventListener('click', async () => {
        if (files.length === 0) return;
        const quality = parseInt(qualitySlider.value);
        const format = selectedFormat;
        const keepSize = document.getElementById('keepSizeToggle').checked;
        const stripExif = document.getElementById('stripExifToggle').checked;

        compressBtn.disabled = true;
        compressBtn.innerHTML = '<span class="btn-spinner"></span> Đang nén…';
        progressWrap.style.display = 'block';

        const formData = new FormData();
        files.forEach(f => formData.append('images', f));
        formData.append('quality', quality);
        formData.append('outputFormat', format);
        formData.append('keepOriginalSize', keepSize);
        formData.append('stripExif', stripExif);

        try {
            // Fake progress animation
            let pct = 0;
            const ticker = setInterval(() => {
                pct = Math.min(pct + Math.random() * 12, 88);
                updateProgress(pct, 'Đang nén…');
            }, 200);

            const res = await fetch('/api/ImageCompression/compress', {
                method: 'POST',
                body: formData
            });

            clearInterval(ticker);

            if (!res.ok) throw new Error(await res.text());

            updateProgress(100, 'Hoàn tất!');

            const contentDisp = res.headers.get('Content-Disposition') || '';
            const fileName = contentDisp.match(/filename="?([^";]+)"?/)?.[1]
                || (files.length > 1 ? 'compressed_images.zip' : `compressed.${format === 'original' ? files[0].name.split('.').pop() : format}`);

            const blob = await res.blob();
            const origSize = files.reduce((s, f) => s + f.size, 0);
            const newSize = blob.size;
            const saved = origSize - newSize;
            const savedPct = Math.max(0, Math.round(saved / origSize * 100));
            statSaved.textContent = savedPct > 0 ? `-${savedPct}% (${fmtSize(saved)})` : 'Không thay đổi';

            // Mark items as done
            fileGrid.querySelectorAll('.tool-file-item').forEach(item => {
                if (!item.querySelector('.tool-file-result')) {
                    const badge = document.createElement('div');
                    badge.className = 'tool-file-result';
                    badge.textContent = '✓';
                    item.appendChild(badge);
                }
            });

            // Download
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(a.href);

        } catch (err) {
            updateProgress(0, 'Lỗi: ' + err.message);
            alert('Nén thất bại: ' + err.message);
        } finally {
            setTimeout(() => { progressWrap.style.display = 'none'; }, 2000);
            compressBtn.disabled = false;
            compressBtn.innerHTML = `<svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Nén ngay`;
        }
    });

    function updateProgress(pct, text) {
        const p = Math.round(pct);
        progressFill.style.width = p + '%';
        progressPct.textContent = p + '%';
        progressText.textContent = text;
    }

    function fmtSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    }
})();