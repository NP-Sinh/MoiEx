document.addEventListener('DOMContentLoaded', () => {
    const dom = {
        fileInput: document.getElementById('fileInput'),
        selectBtn: document.getElementById('selectFilesBtn'),
        addMoreBtn: document.getElementById('addMoreBtn'),
        dropzone: document.getElementById('dropzone'),
        fileList: document.getElementById('fileList'),
        fileGrid: document.getElementById('fileGrid'),
        fileListTitle: document.getElementById('fileListTitle'),
        clearAllBtn: document.getElementById('clearAllBtn'),
        compressBtn: document.getElementById('compressBtn'),
        qualitySlider: document.getElementById('qualitySlider'),
        qualityVal: document.getElementById('qualityVal'),
        progressWrap: document.getElementById('progressWrap'),
        progressFill: document.getElementById('progressFill'),
        progressText: document.getElementById('progressText'),
        progressPct: document.getElementById('progressPct'),
        statCount: document.getElementById('statCount'),
        statSize: document.getElementById('statSize'),
        statSaved: document.getElementById('statSaved'),
        formatBtns: document.querySelectorAll('.tool-format-btn'),
    };
    if (!dom.dropzone || !dom.fileInput) return;

    const CONFIG = {
        MAX_FILES: 10,
        MAX_FILE_SIZE: 20 * 1024 * 1024, // 20 MB
        ACCEPTED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
        API_ENDPOINT: '/moiex/ImageCompression/compress'
    };

    const state = {
        files: [],
        selectedFormat: 'jpg'
    };

    function initEvents() {
        dom.formatBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                dom.formatBtns.forEach(b => b.classList.remove('is-active'));
                btn.classList.add('is-active');
                state.selectedFormat = btn.dataset.fmt;
            });
        });

        dom.qualitySlider.addEventListener('input', () => {
            dom.qualityVal.textContent = dom.qualitySlider.value + '%';
        });

        dom.selectBtn.addEventListener('click', () => dom.fileInput.click());
        dom.addMoreBtn.addEventListener('click', () => dom.fileInput.click());
        dom.fileInput.addEventListener('change', () => handleFilesAdded(dom.fileInput.files));
        dom.clearAllBtn.addEventListener('click', clearAllFiles);
        dom.compressBtn.addEventListener('click', handleCompression);

        ['dragenter', 'dragover'].forEach(ev => {
            dom.dropzone.addEventListener(ev, e => {
                e.preventDefault();
                dom.dropzone.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(ev => {
            dom.dropzone.addEventListener(ev, e => {
                e.preventDefault();
                dom.dropzone.classList.remove('drag-over');
            });
        });

        dom.dropzone.addEventListener('drop', e => handleFilesAdded(e.dataTransfer.files));
    }

    const fmtSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    };
    function handleFilesAdded(newFiles) {
        if (!newFiles || newFiles.length === 0) return;

        const validFiles = Array.from(newFiles).filter(f => CONFIG.ACCEPTED_TYPES.includes(f.type));
        const remainingSlots = CONFIG.MAX_FILES - state.files.length;

        if (remainingSlots <= 0) {
            alert(`Đã đạt giới hạn ${CONFIG.MAX_FILES} ảnh.`);
            return;
        }

        const oversizedFiles = validFiles.filter(f => f.size > CONFIG.MAX_FILE_SIZE);
        if (oversizedFiles.length > 0) {
            alert(`File "${oversizedFiles[0].name}" vượt quá giới hạn ${CONFIG.MAX_FILE_SIZE / 1024 / 1024} MB.`);
            return;
        }

        const filesToAdd = validFiles.slice(0, remainingSlots);
        state.files.push(...filesToAdd);

        renderFileList();
        dom.fileInput.value = '';
    }
    function clearAllFiles() {
        state.files = [];
        renderFileList();
    }
    function renderFileList() {
        dom.fileGrid.innerHTML = '';

        state.files.forEach((f, idx) => {
            const url = URL.createObjectURL(f);
            const item = document.createElement('div');
            item.className = 'tool-file-item';
            item.innerHTML = `
                <img class="tool-file-thumb" src="${url}" alt="${f.name}" />
                <div class="tool-file-overlay">
                    <span class="tool-file-name">${f.name}</span>
                    <span class="tool-file-size">${fmtSize(f.size)}</span>
                </div>
                <button class="tool-file-remove" data-idx="${idx}" title="Xóa ảnh" type="button">
                    <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>`;
            dom.fileGrid.appendChild(item);
        });

        // Gắn sự kiện xóa cho từng ảnh
        dom.fileGrid.querySelectorAll('.tool-file-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                state.files.splice(parseInt(btn.dataset.idx, 10), 1);
                renderFileList();
            });
        });

        updateUIState();
    }
    function updateUIState() {
        const fileCount = state.files.length;
        const hasFiles = fileCount > 0;

        dom.dropzone.style.display = hasFiles ? 'none' : 'flex';
        dom.fileList.style.display = hasFiles ? 'block' : 'none';
        dom.fileListTitle.textContent = `${fileCount} ảnh đã chọn`;
        dom.compressBtn.disabled = !hasFiles;

        // Cập nhật thống kê (Stats)
        const totalBytes = state.files.reduce((sum, f) => sum + f.size, 0);
        dom.statCount.textContent = fileCount;
        dom.statSize.textContent = fmtSize(totalBytes);
        dom.statSaved.textContent = '—';
    }

    function updateProgress(pct, text) {
        const p = Math.round(pct);
        dom.progressFill.style.width = p + '%';
        dom.progressPct.textContent = p + '%';
        dom.progressText.textContent = text;
    }
    async function handleCompression() {
        if (state.files.length === 0) return;

        const quality = parseInt(dom.qualitySlider.value);
        const format = state.selectedFormat;
        const keepSize = document.getElementById('keepSizeToggle').checked;
        const stripExif = document.getElementById('stripExifToggle').checked;

        dom.compressBtn.disabled = true;
        dom.compressBtn.innerHTML = '<span class="btn-spinner"></span> Đang nén…';
        dom.progressWrap.style.display = 'block';

        const formData = new FormData();
        state.files.forEach(f => formData.append('images', f));
        formData.append('quality', quality);
        formData.append('outputFormat', format);
        formData.append('keepOriginalSize', keepSize);
        formData.append('stripExif', stripExif);

        try {
            let pct = 0;
            const progressInterval = setInterval(() => {
                pct = Math.min(pct + Math.random() * 12, 88);
                updateProgress(pct, 'Đang nén…');
            }, 200);

            const res = await fetch(CONFIG.API_ENDPOINT, {
                method: 'POST',
                body: formData
            });

            clearInterval(progressInterval);

            if (!res.ok) throw new Error(await res.text());

            updateProgress(100, 'Hoàn tất!');

            // Xử lý file tải về
            const contentDisp = res.headers.get('Content-Disposition') || '';
            const fileNameMatch = contentDisp.match(/filename="?([^";]+)"?/);
            let fileName = fileNameMatch ? fileNameMatch[1] : null;

            if (!fileName) {
                const ext = format === 'original' ? state.files[0].name.split('.').pop() : format;
                fileName = state.files.length > 1 ? 'compressed_images.zip' : `compressed.${ext}`;
            }

            const blob = await res.blob();

            // Cập nhật thống kê dung lượng đã tiết kiệm
            const origSize = state.files.reduce((sum, f) => sum + f.size, 0);
            const savedBytes = origSize - blob.size;
            const savedPct = Math.max(0, Math.round(savedBytes / origSize * 100));
            dom.statSaved.textContent = savedPct > 0 ? `-${savedPct}% (${fmtSize(savedBytes)})` : 'Không thay đổi';

            // Đánh dấu hoàn tất trên giao diện
            dom.fileGrid.querySelectorAll('.tool-file-item').forEach(item => {
                if (!item.querySelector('.tool-file-result')) {
                    const badge = document.createElement('div');
                    badge.className = 'tool-file-result';
                    badge.textContent = '✓';
                    item.appendChild(badge);
                }
            });

            // Trigger tải file
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);

        } catch (err) {
            updateProgress(0, 'Lỗi: ' + err.message);
            alert('Nén thất bại: ' + err.message);
        } finally {
            // Reset giao diện sau 2s
            setTimeout(() => { dom.progressWrap.style.display = 'none'; }, 2000);
            dom.compressBtn.disabled = false;
            dom.compressBtn.innerHTML = `<svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Nén ngay`;
        }
    }
    initEvents();
});