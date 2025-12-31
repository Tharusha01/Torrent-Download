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

/** Streamable media file extensions */
const STREAMABLE_EXTENSIONS = Object.freeze([
    'mp4', 'mkv', 'webm', 'mov', 'm4v', 'avi',
    'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'
]);

/** Video file extensions */
const VIDEO_EXTENSIONS = Object.freeze([
    'mp4', 'mkv', 'webm', 'mov', 'm4v', 'avi', 'wmv', 'flv'
]);

/** Audio file extensions */
const AUDIO_EXTENSIONS = Object.freeze([
    'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma'
]);

/** Browser-native supported formats (no transcoding needed) */
const NATIVE_FORMATS = Object.freeze([
    'mp4', 'webm', 'ogg', 'mp3', 'wav', 'm4a'
]);

/** Formats that require transcoding for browser playback */
const TRANSCODE_FORMATS = Object.freeze([
    'mkv', 'avi', 'mov', 'wmv', 'flv', 'm4v', '3gp', 'flac', 'wma', 'aac'
]);

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
    warning: 'fa-exclamation-triangle',
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
    // Player elements
    playerModal: document.getElementById('playerModal'),
    videoPlayer: document.getElementById('videoPlayer'),
    playerFileName: document.getElementById('playerFileName'),
    playerFileSize: document.getElementById('playerFileSize'),
    playerFormat: document.getElementById('playerFormat'),
    playerDownloadBtn: document.getElementById('playerDownloadBtn'),
    // Subtitle elements
    subtitleModal: document.getElementById('subtitleModal'),
    subtitleDropZone: document.getElementById('subtitleDropZone'),
    subtitleFileInput: document.getElementById('subtitleFileInput'),
    subtitleList: document.getElementById('subtitleList'),
    torrentSubtitleSelect: document.getElementById('torrentSubtitleSelect'),
};

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

/** Application state */
const state = {
    downloads: new Map(),
    socket: null,
    currentlyPlaying: null,
    transcodingAttempted: false,
    plyrInstance: null,
    loadedSubtitles: [],
    allFiles: [],
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

/**
 * Gets file extension from filename
 * @param {string} filename - The filename
 * @returns {string} File extension (lowercase, without dot)
 */
function getFileExtension(filename) {
    return filename.split('.').pop().toLowerCase();
}

/**
 * Checks if a file is streamable media
 * @param {string} filename - The filename
 * @returns {boolean} True if file can be streamed
 */
function isStreamable(filename) {
    const ext = getFileExtension(filename);
    return STREAMABLE_EXTENSIONS.includes(ext);
}

/**
 * Checks if a file is a video
 * @param {string} filename - The filename
 * @returns {boolean} True if file is video
 */
function isVideo(filename) {
    const ext = getFileExtension(filename);
    return VIDEO_EXTENSIONS.includes(ext);
}

/**
 * Checks if a file is audio
 * @param {string} filename - The filename
 * @returns {boolean} True if file is audio
 */
function isAudio(filename) {
    const ext = getFileExtension(filename);
    return AUDIO_EXTENSIONS.includes(ext);
}

/**
 * Gets the stream URL for a file
 * @param {string} filePath - The file path
 * @returns {string} Stream URL
 */
function getStreamUrl(filePath) {
    return `/stream/${encodeURIComponent(filePath)}`;
}

/**
 * Gets the transcode URL for a file
 * @param {string} filePath - The file path
 * @returns {string} Transcode URL
 */
function getTranscodeUrl(filePath) {
    return `/transcode/${encodeURIComponent(filePath)}`;
}

/**
 * Checks if a file format needs transcoding
 * @param {string} filename - The filename
 * @returns {boolean} True if transcoding is needed
 */
function needsTranscoding(filename) {
    const ext = getFileExtension(filename);
    return TRANSCODE_FORMATS.includes(ext);
}

/**
 * Checks if a file format is natively supported by browsers
 * @param {string} filename - The filename
 * @returns {boolean} True if native format
 */
function isNativeFormat(filename) {
    const ext = getFileExtension(filename);
    return NATIVE_FORMATS.includes(ext);
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
    const canStream = isStreamable(file.name);
    const playButton = canStream
        ? `<button class="btn btn-play btn-sm" onclick="openPlayer('${escapeHtml(file.path)}', '${escapeHtml(file.name)}', ${file.size})" title="Play">
               <i class="fas fa-play"></i>
               Play
           </button>`
        : '';
    
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
            ${playButton}
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
            const canStream = isStreamable(file.name);
            const mediaType = isVideo(file.name) ? 'video' : (isAudio(file.name) ? 'audio' : '');
            
            const item = document.createElement('div');
            item.className = 'file-item';
            item.innerHTML = `
                <div class="file-icon ${canStream ? 'streamable' : ''}">
                    <i class="fas ${getFileIcon(file.name)}"></i>
                    ${canStream ? '<span class="play-overlay"><i class="fas fa-play"></i></span>' : ''}
                </div>
                <div class="file-info">
                    <div class="file-name">${escapeHtml(file.name)}</div>
                    <div class="file-size">
                        ${formatBytes(file.size)}
                        ${mediaType ? `<span class="file-type">${mediaType.toUpperCase()}</span>` : ''}
                    </div>
                </div>
                <div class="file-actions">
                    ${canStream ? `
                        <button class="btn btn-play btn-sm" onclick="openPlayer('${escapeHtml(file.path)}', '${escapeHtml(file.name)}', ${file.size})" title="Play ${mediaType}">
                            <i class="fas fa-play"></i>
                            Play
                        </button>
                    ` : ''}
                    <a href="${escapeHtml(file.downloadUrl)}" class="btn btn-success btn-sm" download>
                        <i class="fas fa-download"></i>
                        Download
                    </a>
                </div>
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
        state.allFiles = files; // Store for subtitle selection
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
    initializePlayer();
    loadDownloads();
    loadFiles();
    
    console.log('Torrent Downloader initialized');
}

// =============================================================================
// VIDEO PLAYER FUNCTIONS
// =============================================================================

/**
 * Initializes player event listeners
 */
function initializePlayer() {
    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (elements.subtitleModal && elements.subtitleModal.classList.contains('active')) {
                closeSubtitleModal();
            } else if (elements.playerModal.classList.contains('active')) {
                closePlayer();
            }
        }
    });
    
    // Initialize subtitle drag and drop
    initSubtitleDragDrop();
}

/**
 * Opens the video player with a file
 * @param {string} filePath - Path to the file
 * @param {string} fileName - Name of the file
 * @param {number} fileSize - Size of the file in bytes
 */
async function openPlayer(filePath, fileName, fileSize) {
    const ext = getFileExtension(fileName).toUpperCase();
    
    // Determine the correct URL based on format support
    let mediaUrl;
    let formatNote = '';
    
    if (needsTranscoding(fileName)) {
        // Check if FFmpeg is available for transcoding
        try {
            const response = await fetch('/api/ffmpeg-status');
            const { available } = await response.json();
            
            if (available) {
                mediaUrl = getTranscodeUrl(filePath);
                formatNote = ' (Transcoding)';
            } else {
                // FFmpeg not available, try native playback anyway
                mediaUrl = getStreamUrl(filePath);
                showToast('warning', `${ext} format may not play - FFmpeg not installed for transcoding`);
            }
        } catch {
            mediaUrl = getStreamUrl(filePath);
        }
    } else {
        mediaUrl = getStreamUrl(filePath);
    }
    
    // Update player info
    elements.playerFileName.textContent = fileName;
    elements.playerFileSize.textContent = formatBytes(fileSize);
    elements.playerFormat.textContent = ext + formatNote;
    elements.playerDownloadBtn.href = `/files/${encodeURIComponent(filePath)}`;
    
    // Clear any existing subtitles
    clearSubtitles();
    
    // Set video source
    elements.videoPlayer.src = mediaUrl;
    
    // Store current file
    state.currentlyPlaying = { path: filePath, name: fileName, size: fileSize };
    state.transcodingAttempted = false;
    state.loadedSubtitles = [];
    
    // Initialize or reinitialize Plyr
    initPlyr();
    
    // Show modal
    elements.playerModal.classList.add('active');
    elements.playerModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    
    // Populate subtitle select with available subtitle files
    populateSubtitleSelect();
    
    // Start playing
    if (state.plyrInstance) {
        state.plyrInstance.play().catch((err) => {
            console.warn('Autoplay prevented:', err.message);
        });
    }
}

/**
 * Initialize Plyr player instance
 */
function initPlyr() {
    // Destroy existing instance if any
    if (state.plyrInstance) {
        state.plyrInstance.destroy();
        state.plyrInstance = null;
    }
    
    // Initialize Plyr with enhanced options
    state.plyrInstance = new Plyr(elements.videoPlayer, {
        controls: [
            'play-large',
            'rewind',
            'play',
            'fast-forward',
            'progress',
            'current-time',
            'duration',
            'mute',
            'volume',
            'captions',
            'settings',
            'pip',
            'airplay',
            'fullscreen'
        ],
        settings: ['captions', 'quality', 'speed', 'loop'],
        speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] },
        keyboard: { focused: true, global: true },
        tooltips: { controls: true, seek: true },
        captions: { active: true, language: 'auto', update: true },
        fullscreen: { enabled: true, fallback: true, iosNative: true },
        storage: { enabled: true, key: 'plyr-torrent' },
        seekTime: 10,
        invertTime: false,
        blankVideo: '',
        quality: {
            default: 'auto',
            options: ['auto']
        },
        i18n: {
            restart: 'Restart',
            rewind: 'Rewind {seektime}s',
            play: 'Play',
            pause: 'Pause',
            fastForward: 'Forward {seektime}s',
            seek: 'Seek',
            seekLabel: '{currentTime} of {duration}',
            played: 'Played',
            buffered: 'Buffered',
            currentTime: 'Current time',
            duration: 'Duration',
            volume: 'Volume',
            mute: 'Mute',
            unmute: 'Unmute',
            enableCaptions: 'Enable captions',
            disableCaptions: 'Disable captions',
            download: 'Download',
            enterFullscreen: 'Enter fullscreen',
            exitFullscreen: 'Exit fullscreen',
            frameTitle: 'Player for {title}',
            captions: 'Captions',
            settings: 'Settings',
            pip: 'PiP',
            menuBack: 'Go back to previous menu',
            speed: 'Speed',
            normal: 'Normal',
            quality: 'Quality',
            loop: 'Loop',
            start: 'Start',
            end: 'End',
            all: 'All',
            reset: 'Reset',
            disabled: 'Disabled',
            enabled: 'Enabled',
            advertisement: 'Ad',
            qualityBadge: {
                2160: '4K',
                1440: 'HD',
                1080: 'HD',
                720: 'HD',
                576: 'SD',
                480: 'SD',
            },
        }
    });
    
    // Handle errors with transcoding fallback
    state.plyrInstance.on('error', async (event) => {
        const error = elements.videoPlayer.error;
        
        if (error && error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
            if (state.currentlyPlaying && !state.transcodingAttempted) {
                state.transcodingAttempted = true;
                const { path: filePath, name: fileName } = state.currentlyPlaying;
                
                try {
                    const response = await fetch('/api/ffmpeg-status');
                    const { available } = await response.json();
                    
                    if (available) {
                        showToast('info', 'Format not natively supported, trying transcoding...');
                        elements.videoPlayer.src = getTranscodeUrl(filePath);
                        elements.playerFormat.textContent = getFileExtension(fileName).toUpperCase() + ' (Transcoding)';
                        state.plyrInstance.play().catch(() => {});
                        return;
                    }
                } catch {
                    // Ignore fetch errors
                }
                showToast('error', 'Media format not supported. Install FFmpeg for transcoding or download the file.');
            }
        }
    });
    
    // Reset transcoding flag on successful load
    state.plyrInstance.on('loadedmetadata', () => {
        console.log('Media loaded successfully');
        state.transcodingAttempted = false;
    });
}

/**
 * Closes the video player
 */
function closePlayer() {
    // Pause and destroy Plyr instance
    if (state.plyrInstance) {
        state.plyrInstance.pause();
        state.plyrInstance.destroy();
        state.plyrInstance = null;
    }
    
    // Clear video source
    elements.videoPlayer.src = '';
    clearSubtitles();
    
    // Hide modal
    elements.playerModal.classList.remove('active');
    elements.playerModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    
    // Clear state
    state.currentlyPlaying = null;
    state.loadedSubtitles = [];
}

/**
 * Clears all subtitle tracks from video
 */
function clearSubtitles() {
    const tracks = elements.videoPlayer.querySelectorAll('track');
    tracks.forEach(track => track.remove());
    state.loadedSubtitles = [];
    updateSubtitleList();
}

// =============================================================================
// SUBTITLE FUNCTIONS
// =============================================================================

/**
 * Opens the subtitle picker modal
 */
function openSubtitlePicker() {
    elements.subtitleModal.classList.add('active');
    elements.subtitleModal.setAttribute('aria-hidden', 'false');
    updateSubtitleList();
}

/**
 * Closes the subtitle modal
 */
function closeSubtitleModal() {
    elements.subtitleModal.classList.remove('active');
    elements.subtitleModal.setAttribute('aria-hidden', 'true');
}

/**
 * Initialize subtitle drag and drop
 */
function initSubtitleDragDrop() {
    const dropZone = elements.subtitleDropZone;
    
    if (!dropZone) return;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('drag-over');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('drag-over');
        }, false);
    });
    
    dropZone.addEventListener('drop', handleSubtitleDrop, false);
    
    // File input change
    if (elements.subtitleFileInput) {
        elements.subtitleFileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                handleSubtitleFile(files[0]);
            }
        });
    }
}

/**
 * Handle subtitle file drop
 * @param {DragEvent} e - Drop event
 */
function handleSubtitleDrop(e) {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleSubtitleFile(files[0]);
    }
}

/**
 * Handle subtitle file (from drop or file input)
 * @param {File} file - Subtitle file
 */
async function handleSubtitleFile(file) {
    const validExtensions = ['vtt', 'srt', 'ass', 'ssa'];
    const ext = file.name.split('.').pop().toLowerCase();
    
    if (!validExtensions.includes(ext)) {
        showToast('error', 'Invalid subtitle format. Use VTT, SRT, ASS, or SSA.');
        return;
    }
    
    try {
        let vttContent;
        const content = await file.text();
        
        if (ext === 'srt') {
            vttContent = convertSrtToVtt(content);
        } else if (ext === 'ass' || ext === 'ssa') {
            vttContent = convertAssToVtt(content);
        } else {
            vttContent = content;
        }
        
        // Create blob URL for the VTT content
        const blob = new Blob([vttContent], { type: 'text/vtt' });
        const url = URL.createObjectURL(blob);
        
        // Detect language from filename
        const lang = detectLanguageFromFilename(file.name);
        
        addSubtitleTrack(url, file.name, lang);
        showToast('success', `Subtitle "${file.name}" added`);
        
    } catch (err) {
        console.error('Error loading subtitle:', err);
        showToast('error', 'Failed to load subtitle file');
    }
}

/**
 * Convert SRT to VTT format
 * @param {string} srt - SRT content
 * @returns {string} VTT content
 */
function convertSrtToVtt(srt) {
    // Add WEBVTT header
    let vtt = 'WEBVTT\n\n';
    
    // Replace SRT timestamps with VTT format
    vtt += srt
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, '$1:$2:$3.$4');
    
    return vtt;
}

/**
 * Convert ASS/SSA to VTT format (basic conversion)
 * @param {string} ass - ASS/SSA content
 * @returns {string} VTT content
 */
function convertAssToVtt(ass) {
    let vtt = 'WEBVTT\n\n';
    
    const lines = ass.split('\n');
    let inEvents = false;
    
    for (const line of lines) {
        if (line.startsWith('[Events]')) {
            inEvents = true;
            continue;
        }
        
        if (line.startsWith('[') && !line.startsWith('[Events]')) {
            inEvents = false;
            continue;
        }
        
        if (inEvents && line.startsWith('Dialogue:')) {
            // Parse dialogue line
            const parts = line.substring(10).split(',');
            if (parts.length >= 10) {
                const start = convertAssTime(parts[1].trim());
                const end = convertAssTime(parts[2].trim());
                // Text is everything after the 9th comma, removing style tags
                const text = parts.slice(9).join(',')
                    .replace(/\{[^}]*\}/g, '') // Remove style tags
                    .replace(/\\N/g, '\n')     // Convert line breaks
                    .replace(/\\n/g, '\n')
                    .trim();
                
                if (text) {
                    vtt += `${start} --> ${end}\n${text}\n\n`;
                }
            }
        }
    }
    
    return vtt;
}

/**
 * Convert ASS timestamp to VTT format
 * @param {string} time - ASS time format (H:MM:SS.cc)
 * @returns {string} VTT time format (HH:MM:SS.mmm)
 */
function convertAssTime(time) {
    const parts = time.split(':');
    if (parts.length !== 3) return '00:00:00.000';
    
    const hours = parts[0].padStart(2, '0');
    const minutes = parts[1].padStart(2, '0');
    const secParts = parts[2].split('.');
    const seconds = secParts[0].padStart(2, '0');
    const centiseconds = (secParts[1] || '0').padEnd(2, '0');
    const milliseconds = centiseconds + '0';
    
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

/**
 * Detect language from filename
 * @param {string} filename - Filename
 * @returns {string} Language code
 */
function detectLanguageFromFilename(filename) {
    const langPatterns = {
        'en': /\b(eng?|english)\b/i,
        'es': /\b(spa?|spanish|español)\b/i,
        'fr': /\b(fra?|french|français)\b/i,
        'de': /\b(deu?|ger|german|deutsch)\b/i,
        'it': /\b(ita?|italian|italiano)\b/i,
        'pt': /\b(por?|portuguese|português)\b/i,
        'ru': /\b(rus?|russian)\b/i,
        'ja': /\b(jpn?|japanese|日本語)\b/i,
        'ko': /\b(kor?|korean|한국어)\b/i,
        'zh': /\b(chi?|chinese|中文)\b/i,
        'ar': /\b(ara?|arabic)\b/i,
        'hi': /\b(hin?|hindi)\b/i,
    };
    
    for (const [code, pattern] of Object.entries(langPatterns)) {
        if (pattern.test(filename)) {
            return code;
        }
    }
    
    return 'en'; // Default to English
}

/**
 * Add subtitle track to video
 * @param {string} url - Subtitle URL or blob URL
 * @param {string} label - Track label
 * @param {string} lang - Language code
 */
function addSubtitleTrack(url, label, lang = 'en') {
    // Create track element
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = label;
    track.srclang = lang;
    track.src = url;
    
    // Set as default if first subtitle
    if (state.loadedSubtitles.length === 0) {
        track.default = true;
    }
    
    elements.videoPlayer.appendChild(track);
    
    // Store reference
    state.loadedSubtitles.push({ url, label, lang });
    
    // Update Plyr to recognize new track
    if (state.plyrInstance) {
        // Force Plyr to update captions
        const currentTime = state.plyrInstance.currentTime;
        state.plyrInstance.captions.active = true;
        
        // Update captions toggle
        setTimeout(() => {
            if (state.plyrInstance && state.plyrInstance.captions) {
                state.plyrInstance.captions.toggle(true);
            }
        }, 100);
    }
    
    updateSubtitleList();
    closeSubtitleModal();
}

/**
 * Update the subtitle list in the modal
 */
function updateSubtitleList() {
    if (!elements.subtitleList) return;
    
    if (state.loadedSubtitles.length === 0) {
        elements.subtitleList.innerHTML = '';
        return;
    }
    
    elements.subtitleList.innerHTML = state.loadedSubtitles.map((sub, index) => `
        <div class="subtitle-item">
            <div class="subtitle-item-info">
                <i class="fas fa-closed-captioning"></i>
                <span class="subtitle-item-name">${escapeHtml(sub.label)}</span>
                <span class="subtitle-item-lang">${sub.lang.toUpperCase()}</span>
            </div>
            <div class="subtitle-item-actions">
                <button class="btn btn-danger btn-sm" onclick="removeSubtitle(${index})" title="Remove">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Remove a subtitle track
 * @param {number} index - Index of subtitle to remove
 */
function removeSubtitle(index) {
    if (index < 0 || index >= state.loadedSubtitles.length) return;
    
    // Remove track element
    const tracks = elements.videoPlayer.querySelectorAll('track');
    if (tracks[index]) {
        // Revoke blob URL if applicable
        const url = state.loadedSubtitles[index].url;
        if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
        }
        tracks[index].remove();
    }
    
    // Remove from state
    state.loadedSubtitles.splice(index, 1);
    updateSubtitleList();
    
    showToast('info', 'Subtitle removed');
}

/**
 * Populate subtitle select with available subtitle files from downloads
 */
function populateSubtitleSelect() {
    if (!elements.torrentSubtitleSelect) return;
    
    const subtitleExtensions = ['vtt', 'srt', 'ass', 'ssa', 'sub'];
    const subtitleFiles = state.allFiles.filter(file => {
        const ext = getFileExtension(file.name);
        return subtitleExtensions.includes(ext);
    });
    
    elements.torrentSubtitleSelect.innerHTML = '<option value="">Select subtitle from downloads...</option>';
    
    subtitleFiles.forEach(file => {
        const option = document.createElement('option');
        option.value = file.path;
        option.textContent = file.name;
        elements.torrentSubtitleSelect.appendChild(option);
    });
}

/**
 * Load selected subtitle from torrent downloads
 */
async function loadSelectedSubtitle() {
    const select = elements.torrentSubtitleSelect;
    if (!select || !select.value) {
        showToast('warning', 'Please select a subtitle file');
        return;
    }
    
    const filePath = select.value;
    const fileName = filePath.split('/').pop().split('\\').pop();
    
    try {
        const response = await fetch(`/files/${encodeURIComponent(filePath)}`);
        if (!response.ok) throw new Error('Failed to fetch subtitle');
        
        const content = await response.text();
        const ext = getFileExtension(fileName);
        
        let vttContent;
        if (ext === 'srt') {
            vttContent = convertSrtToVtt(content);
        } else if (ext === 'ass' || ext === 'ssa') {
            vttContent = convertAssToVtt(content);
        } else {
            vttContent = content;
        }
        
        const blob = new Blob([vttContent], { type: 'text/vtt' });
        const url = URL.createObjectURL(blob);
        const lang = detectLanguageFromFilename(fileName);
        
        addSubtitleTrack(url, fileName, lang);
        showToast('success', `Subtitle "${fileName}" added`);
        
        // Reset select
        select.value = '';
        
    } catch (err) {
        console.error('Error loading subtitle:', err);
        showToast('error', 'Failed to load subtitle file');
    }
}

// Make player and subtitle functions globally available
window.openPlayer = openPlayer;
window.closePlayer = closePlayer;
window.openSubtitlePicker = openSubtitlePicker;
window.closeSubtitleModal = closeSubtitleModal;
window.removeSubtitle = removeSubtitle;
window.loadSelectedSubtitle = loadSelectedSubtitle;

// Start application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
