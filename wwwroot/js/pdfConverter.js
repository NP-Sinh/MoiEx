document.addEventListener('DOMContentLoaded', () => {
    // 1. DOM ELEMENTS Caching
    const dom = {
        fileInput: document.getElementById('fileInput'),
        selectBtn: document.getElementById('selectFilesBtn'),
        addMoreBtn: document.getElementById('addMoreBtn'),
        dropzone: document.getElementById('dropzone'),
        fileList: document.getElementById('fileList'),
        fileGrid: document.getElementById('fileGrid'),
        fileListTitle: document.getElementById('fileListTitle'),
        clearAllBtn: document.getElementById('clearAllBtn'),
        convertBtn: document.getElementById('convertBtn'),
        progressWrap: document.getElementById('progressWrap'),
        progressFill: document.getElementById('progressFill'),
        progressText: document.getElementById('progressText'),
        progressPct: document.getElementById('progressPct'),
        statCount: document.getElementById('statCount'),
        statSize: document.getElementById('statSize'),
        statOutput: document.getElementById('statOutput'),
        orientBtns: document.querySelectorAll('.tool-format-btn[data-orient]'),
        compressToggle: document.getElementById('compressToggle'),
        ocrToggle: document.getElementById('ocrToggle')
    };

    // Fail-safe: Ngừng chạy script nếu không tìm thấy DOM (áp dụng khi load JS ở nhiều trang)
    if (!dom.dropzone || !dom.fileInput) return;

    // 2. CONFIGURATION & CONSTANTS 
    const CONFIG = {
        MAX_FILES: 20,
        MAX_FILE_SIZE: 100 * 1024 * 1024, // 100 MB
        ACCEPTED_EXTS: ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff', '.tif', '.docx', '.txt', '.csv', '.md'],
        IMAGE_EXTS: ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff', '.tif'],
        API_ENDPOINT: '/moiex/PdfConverter/convert'
    };

    const EXT_ICONS = {
        docx: `<svg width="22" height="22" fill="none" stroke="var(--clr-blue)" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
        txt: `<svg width="22" height="22" fill="none" stroke="var(--clr-muted)" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16M4 18h7"/></svg>`,
        csv: `<svg width="22" height="22" fill="none" stroke="#34d399" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M3 14h18M10 3v18"/></svg>`,
        md: `<svg width="22" height="22" fill="none" stroke="#a78bfa" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>`,
    };

    // 3. APPLICATION STATE
    const state = {
        files: [],
        selectedOrientation: 'auto'
    };

    // 4. EVENT LISTENERS
    function initEvents() {
        // Cài đặt hướng trang (Orientation)
        dom.orientBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                dom.orientBtns.forEach(b => b.classList.remove('is-active'));
                btn.classList.add('is-active');
                state.selectedOrientation = btn.dataset.orient;
            });
        });

        // Nút chọn file
        dom.selectBtn.addEventListener('click', () => dom.fileInput.click());
        dom.addMoreBtn.addEventListener('click', () => dom.fileInput.click());
        dom.fileInput.addEventListener('change', () => handleFilesAdded(dom.fileInput.files));
        dom.clearAllBtn.addEventListener('click', clearAllFiles);
        dom.convertBtn.addEventListener('click', handleConversion);

        // Kéo thả file
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

    // 5. CORE FUNCTIONS

    const getExt = (name) => {
        const m = name.match(/(\.[^.]+)$/);
        return m ? m[1].toLowerCase() : '';
    };

    const isImage = (name) => CONFIG.IMAGE_EXTS.includes(getExt(name));

    const fmtSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    };

    function handleFilesAdded(newFiles) {
        if (!newFiles || newFiles.length === 0) return;

        const validFiles = Array.from(newFiles).filter(f => CONFIG.ACCEPTED_EXTS.includes(getExt(f.name)));
        const remainingSlots = CONFIG.MAX_FILES - state.files.length;

        if (remainingSlots <= 0) {
            alert(`Đã đạt giới hạn ${CONFIG.MAX_FILES} file.`);
            return;
        }

        const oversizedFiles = validFiles.filter(f => f.size > CONFIG.MAX_FILE_SIZE);
        if (oversizedFiles.length > 0) {
            alert(`File "${oversizedFiles[0].name}" vượt quá giới hạn ${(CONFIG.MAX_FILE_SIZE / 1024 / 1024)} MB.`);
            return;
        }

        const filesToAdd = validFiles.slice(0, remainingSlots);
        state.files.push(...filesToAdd);

        renderFileList();
        dom.fileInput.value = ''; // Reset input để có thể chọn lại file cùng tên
    }

    function removeFile(index) {
        state.files.splice(index, 1);
        renderFileList();
    }

    function clearAllFiles() {
        state.files = [];
        renderFileList();
    }

    function renderFileList() {
        dom.fileGrid.innerHTML = '';

        state.files.forEach((f, idx) => {
            const item = document.createElement('div');
            item.className = 'tool-file-item';
            const ext = getExt(f.name).replace('.', '');

            if (isImage(f.name)) {
                const url = URL.createObjectURL(f);
                item.innerHTML = `
                    <img class="tool-file-thumb" src="${url}" alt="${f.name}" />
                    <div class="tool-file-overlay">
                        <span class="tool-file-name">${f.name}</span>
                        <span class="tool-file-size">${fmtSize(f.size)}</span>
                    </div>
                    <button class="tool-file-remove" data-idx="${idx}" title="Xóa file" type="button">
                        <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>`;
            } else {
                const icon = EXT_ICONS[ext] || EXT_ICONS['txt'];
                item.innerHTML = `
                    <div class="tool-file-doc-thumb">
                        ${icon}
                        <span class="tool-file-doc-ext">${ext.toUpperCase()}</span>
                    </div>
                    <div class="tool-file-overlay tool-file-overlay--always">
                        <span class="tool-file-name">${f.name}</span>
                        <span class="tool-file-size">${fmtSize(f.size)}</span>
                    </div>
                    <button class="tool-file-remove" data-idx="${idx}" title="Xóa file" type="button">
                        <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>`;
            }
            dom.fileGrid.appendChild(item);
        });

        // Gắn sự kiện xóa cho từng file
        dom.fileGrid.querySelectorAll('.tool-file-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                removeFile(parseInt(btn.dataset.idx, 10));
            });
        });

        updateUIState();
    }

    function updateUIState() {
        const fileCount = state.files.length;
        const hasFiles = fileCount > 0;

        dom.dropzone.style.display = hasFiles ? 'none' : 'flex';
        dom.fileList.style.display = hasFiles ? 'block' : 'none';
        dom.fileListTitle.textContent = `${fileCount} file đã chọn`;
        dom.convertBtn.disabled = !hasFiles;

        // Cập nhật thống kê (Stats)
        const totalBytes = state.files.reduce((sum, f) => sum + f.size, 0);
        dom.statCount.textContent = fileCount;
        dom.statSize.textContent = fmtSize(totalBytes);

        // Cập nhật nhãn đầu ra (Output label)
        const imgCount = state.files.filter(f => isImage(f.name)).length;
        const allImages = imgCount === fileCount;

        if (fileCount === 0) {
            dom.statOutput.textContent = '—';
        } else if ((allImages && fileCount > 1) || fileCount === 1) {
            dom.statOutput.textContent = '1 PDF';
        } else {
            dom.statOutput.textContent = 'ZIP';
        }
    }

    function updateProgress(pct, text) {
        const p = Math.round(pct);
        dom.progressFill.style.width = p + '%';
        dom.progressPct.textContent = p + '%';
        dom.progressText.textContent = text;
    }

    async function handleConversion() {
        if (state.files.length === 0) return;

        const compress = dom.compressToggle.checked;
        const ocr = dom.ocrToggle.checked;

        // Khóa giao diện
        dom.convertBtn.disabled = true;
        dom.convertBtn.innerHTML = '<span class="btn-spinner"></span> Đang chuyển đổi…';
        dom.progressWrap.style.display = 'block';

        const formData = new FormData();
        state.files.forEach(f => formData.append('files', f));
        formData.append('compressOutput', compress);
        formData.append('enableOcr', ocr);
        formData.append('pageOrientation', state.selectedOrientation);

        try {
            // Giả lập thanh tiến trình
            let pct = 0;
            const progressInterval = setInterval(() => {
                pct = Math.min(pct + Math.random() * 10, 88);
                updateProgress(pct, 'Đang chuyển đổi…');
            }, 250);

            // Gửi API
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
                fileName = state.files.length > 1 ? 'converted_pdfs.zip' : `${state.files[0].name.replace(/\.[^.]+$/, '')}.pdf`;
            }

            const blob = await res.blob();

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
            alert('Chuyển đổi thất bại: ' + err.message);
        } finally {
            // Reset giao diện sau 2s
            setTimeout(() => { dom.progressWrap.style.display = 'none'; }, 2000);
            dom.convertBtn.disabled = false;
            dom.convertBtn.innerHTML = `<svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Chuyển đổi`;
        }
    }

    // 6. INITIALIZATION
    initEvents();
});