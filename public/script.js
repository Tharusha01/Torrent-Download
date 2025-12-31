// Socket.io connection
const socket = io();

// DOM Elements
const magnetInput = document.getElementById('magnetInput');
const addButton = document.getElementById('addButton');
const errorMessage = document.getElementById('errorMessage');
const downloadsList = document.getElementById('downloadsList');
const filesList = document.getElementById('filesList');
const downloadCount = document.getElementById('downloadCount');
const fileCount = document.getElementById('fileCount');
const refreshFilesBtn = document.getElementById('refreshFiles');
const toastContainer = document.getElementById('toastContainer');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// State
let downloads = new Map();

// Utility Functions
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatSpeed(bytesPerSecond) {
    return formatBytes(bytesPerSecond) + '/s';
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        // Video
        mp4: 'fa-file-video',
        mkv: 'fa-file-video',
        avi: 'fa-file-video',
        mov: 'fa-file-video',
        wmv: 'fa-file-video',
        flv: 'fa-file-video',
        webm: 'fa-file-video',
        // Audio
        mp3: 'fa-file-audio',
        wav: 'fa-file-audio',
        flac: 'fa-file-audio',
        aac: 'fa-file-audio',
        ogg: 'fa-file-audio',
        // Images
        jpg: 'fa-file-image',
        jpeg: 'fa-file-image',
        png: 'fa-file-image',
        gif: 'fa-file-image',
        bmp: 'fa-file-image',
        svg: 'fa-file-image',
        webp: 'fa-file-image',
        // Documents
        pdf: 'fa-file-pdf',
        doc: 'fa-file-word',
        docx: 'fa-file-word',
        xls: 'fa-file-excel',
        xlsx: 'fa-file-excel',
        ppt: 'fa-file-powerpoint',
        pptx: 'fa-file-powerpoint',
        txt: 'fa-file-alt',
        // Archives
        zip: 'fa-file-archive',
        rar: 'fa-file-archive',
        '7z': 'fa-file-archive',
        tar: 'fa-file-archive',
        gz: 'fa-file-archive',
        // Code
        js: 'fa-file-code',
        ts: 'fa-file-code',
        html: 'fa-file-code',
        css: 'fa-file-code',
        py: 'fa-file-code',
        java: 'fa-file-code',
        // Executables
        exe: 'fa-file',
        msi: 'fa-file',
        dmg: 'fa-file',
        iso: 'fa-compact-disc'
    };
    return icons[ext] || 'fa-file';
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span class="toast-message">${message}</span>
        <button class="toast-close"><i class="fas fa-times"></i></button>
    `;
    
    toastContainer.appendChild(toast);
    
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => toast.remove());
    
    setTimeout(() => {
        toast.style.animation = 'toastIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
    setTimeout(() => {
        errorMessage.classList.remove('show');
    }, 5000);
}

// Render Functions
function renderDownload(download) {
    const existingCard = document.getElementById(`download-${download.id}`);
    
    const statusClass = download.status;
    const statusText = download.status.charAt(0).toUpperCase() + download.status.slice(1);
    const progressClass = download.status === 'completed' ? 'completed' : '';
    
    const html = `
        <div class="download-header">
            <div class="download-info">
                <div class="download-name">${download.name}</div>
                <div class="download-meta">
                    <span><i class="fas fa-hdd"></i> ${formatBytes(download.size || 0)}</span>
                    <span><i class="fas fa-download"></i> ${formatSpeed(download.downloadSpeed || 0)}</span>
                    <span><i class="fas fa-upload"></i> ${formatSpeed(download.uploadSpeed || 0)}</span>
                    <span><i class="fas fa-users"></i> ${download.peers || 0} peers</span>
                </div>
            </div>
            <div class="download-actions">
                <span class="status-badge ${statusClass}">
                    ${download.status === 'downloading' ? '<i class="fas fa-spinner fa-spin"></i>' : ''}
                    ${statusText}
                </span>
                <button class="btn btn-danger btn-sm icon-btn" onclick="removeDownload('${download.id}')" title="Remove">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        <div class="progress-container">
            <div class="progress-bar">
                <div class="progress-fill ${progressClass}" style="width: ${download.progress}%"></div>
            </div>
            <div class="progress-text">
                <span>${download.progress}%</span>
                <span>${formatBytes(download.downloaded || 0)} / ${formatBytes(download.size || 0)}</span>
            </div>
        </div>
        ${download.status === 'completed' && download.files && download.files.length > 0 ? `
            <div class="torrent-files">
                <div class="torrent-files-title">Files (${download.files.length})</div>
                ${download.files.map(file => `
                    <div class="torrent-file-item">
                        <div class="torrent-file-info">
                            <i class="fas ${getFileIcon(file.name)}"></i>
                            <span class="torrent-file-name">${file.name}</span>
                        </div>
                        <span class="torrent-file-size">${formatBytes(file.size)}</span>
                        ${file.downloadUrl ? `
                            <a href="${file.downloadUrl}" class="btn btn-success btn-sm" download>
                                <i class="fas fa-download"></i>
                                Download
                            </a>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
    
    if (existingCard) {
        existingCard.innerHTML = html;
    } else {
        const card = document.createElement('div');
        card.className = 'download-card';
        card.id = `download-${download.id}`;
        card.innerHTML = html;
        
        // Remove empty state if exists
        const emptyState = downloadsList.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }
        
        downloadsList.appendChild(card);
    }
    
    updateDownloadCount();
}

function renderDownloads(downloadList) {
    downloadsList.innerHTML = '';
    
    if (downloadList.length === 0) {
        downloadsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-cloud-download-alt"></i>
                <h3>No active downloads</h3>
                <p>Paste a magnet link above to start downloading</p>
            </div>
        `;
    } else {
        downloadList.forEach(download => {
            downloads.set(download.id, download);
            renderDownload(download);
        });
    }
    
    updateDownloadCount();
}

function renderFiles(files) {
    filesList.innerHTML = '';
    
    if (files.length === 0) {
        filesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <h3>No files yet</h3>
                <p>Completed downloads will appear here</p>
            </div>
        `;
    } else {
        files.forEach(file => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.innerHTML = `
                <div class="file-icon">
                    <i class="fas ${getFileIcon(file.name)}"></i>
                </div>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${formatBytes(file.size)}</div>
                </div>
                <a href="${file.downloadUrl}" class="btn btn-success btn-sm" download>
                    <i class="fas fa-download"></i>
                    Download
                </a>
            `;
            filesList.appendChild(item);
        });
    }
    
    fileCount.textContent = files.length;
}

function updateDownloadCount() {
    const activeDownloads = Array.from(downloads.values()).filter(d => d.status === 'downloading').length;
    downloadCount.textContent = activeDownloads;
}

// API Functions
async function addTorrent() {
    const magnetLink = magnetInput.value.trim();
    
    if (!magnetLink) {
        showError('Please enter a magnet link');
        return;
    }
    
    if (!magnetLink.startsWith('magnet:')) {
        showError('Invalid magnet link. Must start with "magnet:"');
        return;
    }
    
    addButton.disabled = true;
    addButton.innerHTML = '<div class="spinner"></div><span>Adding...</span>';
    
    try {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ magnetLink })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to add torrent');
        }
        
        magnetInput.value = '';
        showToast('Torrent added successfully!', 'success');
        
    } catch (error) {
        showError(error.message);
        showToast(error.message, 'error');
    } finally {
        addButton.disabled = false;
        addButton.innerHTML = '<i class="fas fa-download"></i><span>Add Torrent</span>';
    }
}

async function removeDownload(id) {
    try {
        const response = await fetch(`/api/download/${id}/files`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Failed to remove download');
        }
        
        downloads.delete(id);
        const card = document.getElementById(`download-${id}`);
        if (card) {
            card.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => {
                card.remove();
                if (downloadsList.children.length === 0) {
                    downloadsList.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-cloud-download-alt"></i>
                            <h3>No active downloads</h3>
                            <p>Paste a magnet link above to start downloading</p>
                        </div>
                    `;
                }
                updateDownloadCount();
            }, 300);
        }
        
        showToast('Download removed', 'success');
        loadFiles(); // Refresh files list
        
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function loadFiles() {
    try {
        const response = await fetch('/api/files');
        const files = await response.json();
        renderFiles(files);
    } catch (error) {
        console.error('Failed to load files:', error);
    }
}

async function loadDownloads() {
    try {
        const response = await fetch('/api/downloads');
        const downloadList = await response.json();
        renderDownloads(downloadList);
    } catch (error) {
        console.error('Failed to load downloads:', error);
    }
}

// Event Listeners
addButton.addEventListener('click', addTorrent);

magnetInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addTorrent();
    }
});

refreshFilesBtn.addEventListener('click', () => {
    refreshFilesBtn.disabled = true;
    refreshFilesBtn.innerHTML = '<div class="spinner"></div> Refreshing...';
    
    loadFiles().finally(() => {
        refreshFilesBtn.disabled = false;
        refreshFilesBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
    });
});

// Tab switching
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.add('active');
        
        if (tabName === 'files') {
            loadFiles();
        }
    });
});

// Socket.io Events
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('downloads-list', (downloadList) => {
    renderDownloads(downloadList);
});

socket.on('download-update', (download) => {
    downloads.set(download.id, download);
    renderDownload(download);
    
    if (download.status === 'completed') {
        showToast(`Download completed: ${download.name}`, 'success');
    } else if (download.status === 'error') {
        showToast(`Download failed: ${download.name}`, 'error');
    }
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

// Initial load
loadDownloads();
loadFiles();
