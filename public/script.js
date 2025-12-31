/**
 * Torrent Downloader - Client Application
 * 
 * Handles the frontend logic for the torrent downloader web application.
 * Manages UI updates, API communication, and real-time socket events.
 * 
 * @author Tharusha
 * @version 1.0.0
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Application configuration */
const APP_CONFIG = Object.freeze({
    TOAST_DURATION: 5000,
    ANIMATION_DURATION: 300,
    API_ENDPOINTS: {
        DOWNLOADS: '/api/downloads',
        DOWNLOAD: '/api/download',
        FILES: '/api/files',
    },
});

/** File type icon mappings */
const FILE_ICONS = Object.freeze({
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
    // Executables & Disk Images
    exe: 'fa-file',
    msi: 'fa-file',
    dmg: 'fa-file',
    iso: 'fa-compact-disc',
});

/** Toast icon mappings */
const TOAST_ICONS = Object.freeze({
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    info: 'fa-info-circle',
});

// =============================================================================
// DOM ELEMENTS
// =============================================================================

/** Cached DOM element references */
const elements = {
    magnetInput: document.getElementById('magnetInput'),
    addButton: document.getElementById('addButton'),
    errorMessage: document.getElementById('errorMessage'),
    downloadsList: document.getElementById('downloadsList'),
    filesList: document.getElementById('filesList'),
    downloadCount: document.getElementById('downloadCount'),
    fileCount: document.getElementById('fileCount'),
    refreshFilesBtn: document.getElementById('refreshFiles'),
    toastContainer: document.getElementById('toastContainer'),
    tabs: document.querySelectorAll('.tab'),
    tabContents: document.querySelectorAll('.tab-content'),
};

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

/** Application state */
const state = {
    downloads: new Map(),
    socket: null,
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Formats bytes to human-readable string
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string (e.g., "1.5 GB")
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Formats bytes per second to speed string
 * @param {number} bytesPerSecond - Speed in bytes per second
 * @returns {string} Formatted speed string
 */
function formatSpeed(bytesPerSecond) {
    return `${formatBytes(bytesPerSecond)}/s`;
}

/**
 * Gets the appropriate Font Awesome icon class for a file
 * @param {string} filename - The filename
 * @returns {string} Font Awesome icon class
 */
function getFileIcon(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    return FILE_ICONS[extension] || 'fa-file';
}

/**
 * Escapes HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML string
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Capitalizes the first letter of a string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// =============================================================================
// NOTIFICATION FUNCTIONS
// =============================================================================

/**
 * Shows a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Toast type (success, error, info)
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    toast.innerHTML = `
        <i class="fas ${TOAST_ICONS[type]}"></i>
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close" aria-label="Close notification">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    // Close button handler
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => removeToast(toast));
    
    // Auto-remove after duration
    setTimeout(() => removeToast(toast), APP_CONFIG.TOAST_DURATION);
}

/**
 * Removes a toast notification with animation
 * @param {HTMLElement} toast - Toast element to remove
 */
function removeToast(toast) {
    if (!toast.parentNode) return;
    
    toast.style.animation = 'toastIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), APP_CONFIG.ANIMATION_DURATION);
}

/**
 * Shows an error message in the input area
 * @param {string} message - Error message to display
 */
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.add('show');
    
    setTimeout(() => {
        elements.errorMessage.classList.remove('show');
    }, APP_CONFIG.TOAST_DURATION);
}

// =============================================================================
// RENDER FUNCTIONS
// =============================================================================

/**
 * Generates HTML for the empty state
 * @param {string} icon - Font Awesome icon class
 * @param {string} title - Title text
 * @param {string} description - Description text
 * @returns {string} HTML string
 */
function createEmptyStateHtml(icon, title, description) {
    return `
        <div class="empty-state">
            <i class="fas ${icon}"></i>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(description)}</p>
        </div>
    `;
}

/**
 * Generates HTML for a file item in a torrent
 * @param {Object} file - File object
 * @returns {string} HTML string
 */
function createTorrentFileHtml(file) {
    const downloadButton = file.downloadUrl
        ? `<a href="${escapeHtml(file.downloadUrl)}" class="btn btn-success btn-sm" download>
               <i class="fas fa-download"></i>
               Download
           </a>`
        : '';

    return `
        <div class="torrent-file-item">
            <div class="torrent-file-info">
                <i class="fas ${getFileIcon(file.name)}"></i>
                <span class="torrent-file-name">${escapeHtml(file.name)}</span>
            </div>
            <span class="torrent-file-size">${formatBytes(file.size)}</span>
            ${downloadButton}
        </div>
    `;
}

/**
 * Generates HTML for a download card
 * @param {Object} download - Download object
 * @returns {string} HTML string
 */
function createDownloadCardHtml(download) {
    const statusClass = download.status;
    const statusText = capitalize(download.status);
    const progressClass = download.status === 'completed' ? 'completed' : '';
    const spinnerIcon = download.status === 'downloading' 
        ? '<i class="fas fa-spinner fa-spin"></i>' 
        : '';

    const filesSection = download.status === 'completed' && download.files?.length > 0
        ? `<div class="torrent-files">
               <div class="torrent-files-title">Files (${download.files.length})</div>
               ${download.files.map(createTorrentFileHtml).join('')}
           </div>`
        : '';

    return `
        <div class="download-header">
            <div class="download-info">
                <div class="download-name">${escapeHtml(download.name)}</div>
                <div class="download-meta">
                    <span><i class="fas fa-hdd"></i> ${formatBytes(download.size || 0)}</span>
                    <span><i class="fas fa-download"></i> ${formatSpeed(download.downloadSpeed || 0)}</span>
                    <span><i class="fas fa-upload"></i> ${formatSpeed(download.uploadSpeed || 0)}</span>
                    <span><i class="fas fa-users"></i> ${download.peers || 0} peers</span>
                </div>
            </div>
            <div class="download-actions">
                <span class="status-badge ${statusClass}">
                    ${spinnerIcon}
                    ${statusText}
                </span>
                <button 
                    class="btn btn-danger btn-sm icon-btn" 
                    onclick="handleRemoveDownload('${escapeHtml(download.id)}')" 
                    title="Remove"
                    aria-label="Remove download"
                >
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
        ${filesSection}
    `;
}

/**
 * Renders a single download card
 * @param {Object} download - Download object
 */
function renderDownload(download) {
    const existingCard = document.getElementById(`download-${download.id}`);
    const html = createDownloadCardHtml(download);
    
    if (existingCard) {
        existingCard.innerHTML = html;
    } else {
        const card = document.createElement('div');
        card.className = 'download-card';
        card.id = `download-${download.id}`;
        card.innerHTML = html;
        
        // Remove empty state if exists
        const emptyState = elements.downloadsList.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }
        
        elements.downloadsList.appendChild(card);
    }
    
    updateDownloadCount();
}

/**
 * Renders all downloads
 * @param {Array} downloadList - Array of download objects
 */
function renderDownloads(downloadList) {
    elements.downloadsList.innerHTML = '';
    
    if (downloadList.length === 0) {
        elements.downloadsList.innerHTML = createEmptyStateHtml(
            'fa-cloud-download-alt',
            'No active downloads',
            'Paste a magnet link above to start downloading'
        );
    } else {
        downloadList.forEach((download) => {
            state.downloads.set(download.id, download);
            renderDownload(download);
        });
    }
    
    updateDownloadCount();
}

/**
 * Renders the files list
 * @param {Array} files - Array of file objects
 */
function renderFiles(files) {
    elements.filesList.innerHTML = '';
    
    if (files.length === 0) {
        elements.filesList.innerHTML = createEmptyStateHtml(
            'fa-folder-open',
            'No files yet',
            'Completed downloads will appear here'
        );
    } else {
        files.forEach((file) => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.innerHTML = `
                <div class="file-icon">
                    <i class="fas ${getFileIcon(file.name)}"></i>
                </div>
                <div class="file-info">
                    <div class="file-name">${escapeHtml(file.name)}</div>
                    <div class="file-size">${formatBytes(file.size)}</div>
                </div>
                <a href="${escapeHtml(file.downloadUrl)}" class="btn btn-success btn-sm" download>
                    <i class="fas fa-download"></i>
                    Download
                </a>
            `;
            elements.filesList.appendChild(item);
        });
    }
    
    elements.fileCount.textContent = files.length;
}

/**
 * Updates the active download count badge
 */
function updateDownloadCount() {
    const activeDownloads = Array.from(state.downloads.values())
        .filter((d) => d.status === 'downloading').length;
    elements.downloadCount.textContent = activeDownloads;
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Makes an API request with error handling
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Response data
 * @throws {Error} If request fails
 */
async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }
    
    return data;
}

/**
 * Adds a new torrent download
 */
async function addTorrent() {
    const magnetLink = elements.magnetInput.value.trim();
    
    // Validation
    if (!magnetLink) {
        showError('Please enter a magnet link');
        return;
    }
    
    if (!magnetLink.startsWith('magnet:')) {
        showError('Invalid magnet link. Must start with "magnet:"');
        return;
    }
    
    // Update UI to loading state
    setAddButtonLoading(true);
    
    try {
        await apiRequest(APP_CONFIG.API_ENDPOINTS.DOWNLOAD, {
            method: 'POST',
            body: JSON.stringify({ magnetLink }),
        });
        
        elements.magnetInput.value = '';
        showToast('Torrent added successfully!', 'success');
    } catch (error) {
        showError(error.message);
        showToast(error.message, 'error');
    } finally {
        setAddButtonLoading(false);
    }
}

/**
 * Removes a download
 * @param {string} id - Download ID
 */
async function removeDownload(id) {
    try {
        await apiRequest(`${APP_CONFIG.API_ENDPOINTS.DOWNLOAD}/${id}/files`, {
            method: 'DELETE',
        });
        
        state.downloads.delete(id);
        
        const card = document.getElementById(`download-${id}`);
        if (card) {
            card.style.animation = 'slideIn 0.3s ease reverse';
            
            setTimeout(() => {
                card.remove();
                
                if (elements.downloadsList.children.length === 0) {
                    elements.downloadsList.innerHTML = createEmptyStateHtml(
                        'fa-cloud-download-alt',
                        'No active downloads',
                        'Paste a magnet link above to start downloading'
                    );
                }
                
                updateDownloadCount();
            }, APP_CONFIG.ANIMATION_DURATION);
        }
        
        showToast('Download removed', 'success');
        loadFiles();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * Loads and displays files
 */
async function loadFiles() {
    try {
        const files = await apiRequest(APP_CONFIG.API_ENDPOINTS.FILES);
        renderFiles(files);
    } catch (error) {
        console.error('Failed to load files:', error);
        showToast('Failed to load files', 'error');
    }
}

/**
 * Loads and displays downloads
 */
async function loadDownloads() {
    try {
        const downloadList = await apiRequest(APP_CONFIG.API_ENDPOINTS.DOWNLOADS);
        renderDownloads(downloadList);
    } catch (error) {
        console.error('Failed to load downloads:', error);
        showToast('Failed to load downloads', 'error');
    }
}

// =============================================================================
// UI HELPER FUNCTIONS
// =============================================================================

/**
 * Sets the add button loading state
 * @param {boolean} isLoading - Whether button should show loading state
 */
function setAddButtonLoading(isLoading) {
    elements.addButton.disabled = isLoading;
    elements.addButton.innerHTML = isLoading
        ? '<div class="spinner"></div><span>Adding...</span>'
        : '<i class="fas fa-download"></i><span>Add Torrent</span>';
}

/**
 * Sets the refresh button loading state
 * @param {boolean} isLoading - Whether button should show loading state
 */
function setRefreshButtonLoading(isLoading) {
    elements.refreshFilesBtn.disabled = isLoading;
    elements.refreshFilesBtn.innerHTML = isLoading
        ? '<div class="spinner"></div> Refreshing...'
        : '<i class="fas fa-sync-alt"></i> Refresh';
}

/**
 * Switches to a tab
 * @param {string} tabName - Tab name to switch to
 */
function switchTab(tabName) {
    elements.tabs.forEach((t) => t.classList.remove('active'));
    elements.tabContents.forEach((c) => c.classList.remove('active'));
    
    const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
    const activeContent = document.getElementById(`${tabName}Tab`);
    
    if (activeTab) activeTab.classList.add('active');
    if (activeContent) activeContent.classList.add('active');
    
    // Load files when switching to files tab
    if (tabName === 'files') {
        loadFiles();
    }
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

/**
 * Global handler for remove download button clicks
 * @param {string} id - Download ID
 */
window.handleRemoveDownload = function(id) {
    removeDownload(id);
};

/**
 * Initializes event listeners
 */
function initializeEventListeners() {
    // Add torrent button
    elements.addButton.addEventListener('click', addTorrent);
    
    // Enter key in magnet input
    elements.magnetInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTorrent();
        }
    });
    
    // Refresh files button
    elements.refreshFilesBtn.addEventListener('click', async () => {
        setRefreshButtonLoading(true);
        
        try {
            await loadFiles();
        } finally {
            setRefreshButtonLoading(false);
        }
    });
    
    // Tab switching
    elements.tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            switchTab(tab.dataset.tab);
        });
    });
}

// =============================================================================
// SOCKET.IO HANDLERS
// =============================================================================

/**
 * Initializes Socket.io connection and event handlers
 */
function initializeSocket() {
    state.socket = io();
    
    state.socket.on('connect', () => {
        console.log('Connected to server');
    });
    
    state.socket.on('downloads-list', (downloadList) => {
        renderDownloads(downloadList);
    });
    
    state.socket.on('download-update', (download) => {
        state.downloads.set(download.id, download);
        renderDownload(download);
        
        // Show notifications for status changes
        if (download.status === 'completed') {
            showToast(`Download completed: ${download.name}`, 'success');
        } else if (download.status === 'error') {
            showToast(`Download failed: ${download.name}`, 'error');
        }
    });
    
    state.socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
    
    state.socket.on('error', (error) => {
        console.error('Socket error:', error);
        showToast('Connection error', 'error');
    });
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initializes the application
 */
function initialize() {
    initializeEventListeners();
    initializeSocket();
    loadDownloads();
    loadFiles();
    
    console.log('Torrent Downloader initialized');
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
