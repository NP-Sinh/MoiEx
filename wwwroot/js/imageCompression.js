class ImageCompressor {
    constructor() {
        this.MAX_FILES = 10;
        this.files = [];
        this.selectedFormat = 'jpg';

        this.initElements();
        this.bindEvents();
        this.updateUI();
    }

    // ---- DOM ----
    initElements() {
        this.fileInput = document.getElementById('fileInput');
        this.selectBtn = document.getElementById('selectFilesBtn');
        this.addMoreBtn = document.getElementById('addMoreBtn');
        this.dropzone = document.getElementById('dropzone');
        this.fileList = document.getElementById('fileList');
        this.fileGrid = document.getElementById('fileGrid');
        this.fileListTitle = document.getElementById('fileListTitle');
        this.clearAllBtn = document.getElementById('clearAllBtn');
        this.compressBtn = document.getElementById('compressBtn');

        this.qualitySlider = document.getElementById('qualitySlider');
        this.qualityVal = document.getElementById('qualityVal');

        this.progressWrap = document.getElementById('progressWrap');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.progressPct = document.getElementById('progressPct');

        this.statCount = document.getElementById('statCount');
        this.statSize = document.getElementById('statSize');
        this.statSaved = document.getElementById('statSaved');

        this.formatBtns = document.querySelectorAll('.tool-format-btn');

        this.keepSizeToggle = document.getElementById('keepSizeToggle');
        this.stripExifToggle = document.getElementById('stripExifToggle');
    }

    // ---- Events ----
    bindEvents() {
        this.selectBtn.onclick = () => this.fileInput.click();
        this.addMoreBtn.onclick = () => this.fileInput.click();

        this.fileInput.onchange = () => this.addFiles(this.fileInput.files);

        this.clearAllBtn.onclick = () => this.clearFiles();
        this.compressBtn.onclick = () => this.compress();

        this.qualitySlider.oninput = () => {
            this.qualityVal.textContent = `${this.qualitySlider.value}%`;
        };

        this.formatBtns.forEach(btn => {
            btn.onclick = () => this.setFormat(btn);
        });

        ['dragenter', 'dragover'].forEach(ev => {
            this.dropzone.addEventListener(ev, e => {
                e.preventDefault();
                this.dropzone.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(ev => {
            this.dropzone.addEventListener(ev, e => {
                e.preventDefault();
                this.dropzone.classList.remove('drag-over');
            });
        });

        this.dropzone.addEventListener('drop', e => {
            this.addFiles(e.dataTransfer.files);
        });
    }

    // ---- Format ----
    setFormat(btn) {
        this.formatBtns.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.selectedFormat = btn.dataset.fmt;
    }

    // ---- File handling ----
    addFiles(newFiles) {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        const validFiles = Array.from(newFiles).filter(f => allowed.includes(f.type));

        const remaining = this.MAX_FILES - this.files.length;
        if (remaining <= 0) {
            alert('Đã đạt giới hạn 10 ảnh.');
            return;
        }

        this.files.push(...validFiles.slice(0, remaining));
        this.renderFiles();
        this.fileInput.value = '';
    }

    clearFiles() {
        this.files = [];
        this.renderFiles();
    }

    renderFiles() {
        this.fileGrid.innerHTML = '';

        this.files.forEach((file, index) => {
            const url = URL.createObjectURL(file);

            const item = document.createElement('div');
            item.className = 'tool-file-item';

            item.innerHTML = `
               <img class="tool-file-thumb" src="${url}" alt="${file.name}" />
                <div class="tool-file-overlay">
                    <span class="tool-file-name">${file.name}</span>
                    <span class="tool-file-size">${this.formatSize(file.size)}</span>
                </div>
                <button class="tool-file-remove" data-index="${index}" title="Xóa ảnh">
                     <svg width="9" height="9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            `;

            item.querySelector('button').onclick = () => {
                this.files.splice(index, 1);
                this.renderFiles();
            };

            this.fileGrid.appendChild(item);
        });

        this.updateUI();
    }

    updateUI() {
        const hasFiles = this.files.length > 0;

        this.dropzone.style.display = hasFiles ? 'none' : 'flex';
        this.fileList.style.display = hasFiles ? 'block' : 'none';

        this.fileListTitle.textContent = `${this.files.length} ảnh đã chọn`;
        this.compressBtn.disabled = !hasFiles;

        const totalSize = this.files.reduce((sum, f) => sum + f.size, 0);

        this.statCount.textContent = this.files.length;
        this.statSize.textContent = this.formatSize(totalSize);
        this.statSaved.textContent = '—';
    }

    // ---- Compress ----
    async compress() {
        if (this.files.length === 0) return;

        const formData = new FormData();
        this.files.forEach(f => formData.append('images', f));

        formData.append('quality', parseInt(this.qualitySlider.value));
        formData.append('outputFormat', this.selectedFormat);
        formData.append('keepOriginalSize', this.keepSizeToggle.checked);
        formData.append('stripExif', this.stripExifToggle.checked);

        this.setLoading(true);

        try {
            const res = await fetch('/moiex/ImageCompression/compress', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error(await res.text());

            const blob = await res.blob();
            this.handleResult(blob);

        } catch (err) {
            this.showError(err.message);
        } finally {
            this.setLoading(false);
        }
    }

    handleResult(blob) {
        const originalSize = this.files.reduce((s, f) => s + f.size, 0);
        const saved = originalSize - blob.size;

        const percent = Math.max(0, Math.round((saved / originalSize) * 100));

        this.statSaved.textContent =
            percent > 0 ? `-${percent}% (${this.formatSize(saved)})` : 'Không thay đổi';

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        a.href = url;
        a.download = 'compressed.zip';
        a.click();

        URL.revokeObjectURL(url);
    }

    // ---- UI helpers ----
    setLoading(isLoading) {
        this.compressBtn.disabled = isLoading;
        this.compressBtn.textContent = isLoading ? 'Đang nén...' : 'Nén ngay';

        this.progressWrap.style.display = isLoading ? 'block' : 'none';
    }

    showError(msg) {
        alert('Lỗi: ' + msg);
    }

    updateProgress(pct, text) {
        this.progressFill.style.width = pct + '%';
        this.progressPct.textContent = pct + '%';
        this.progressText.textContent = text;
    }

    formatSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    }
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
    new ImageCompressor();
});