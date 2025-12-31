/**
 * Torrent Downloader Server
 * 
 * A web application server for downloading torrents via magnet links.
 * Uses WebTorrent for P2P downloads and Socket.io for real-time updates.
 * 
 * @author Tharusha
 * @version 1.0.0
 */

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import WebTorrent from 'webtorrent';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

// =============================================================================
// CONFIGURATION
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Server configuration constants */
const CONFIG = Object.freeze({
    PORT: process.env.PORT || 3000,
    DOWNLOADS_DIR: path.join(__dirname, 'downloads'),
    PROGRESS_UPDATE_INTERVAL: 1000, // ms
    MAX_MAGNET_LENGTH: 2000,
});

/** HTTP status codes */
const HTTP_STATUS = Object.freeze({
    OK: 200,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    INTERNAL_ERROR: 500,
});

// =============================================================================
// INITIALIZATION
// =============================================================================

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
    },
});

/** WebTorrent client instance */
const torrentClient = new WebTorrent();

/** Map to store active downloads */
const activeDownloads = new Map();

/** Map to store progress intervals for cleanup */
const progressIntervals = new Map();

// Ensure downloads directory exists
if (!fs.existsSync(CONFIG.DOWNLOADS_DIR)) {
    fs.mkdirSync(CONFIG.DOWNLOADS_DIR, { recursive: true });
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Note: We handle /files routes manually for streaming support below

// Security headers middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
});

// =============================================================================
// MIME TYPES FOR MEDIA
// =============================================================================

/** Supported media MIME types */
const MIME_TYPES = Object.freeze({
    // Video
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.m4v': 'video/x-m4v',
    '.3gp': 'video/3gpp',
    '.ogv': 'video/ogg',
    // Audio
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.wma': 'audio/x-ms-wma',
    // Images
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    // Documents
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
});

/**
 * Gets MIME type for a file extension
 * @param {string} ext - File extension
 * @returns {string} MIME type
 */
function getMimeType(ext) {
    return MIME_TYPES[ext.toLowerCase()] || 'application/octet-stream';
}

/**
 * Checks if file is a streamable media type
 * @param {string} ext - File extension
 * @returns {boolean} True if streamable
 */
function isStreamable(ext) {
    const streamableTypes = ['.mp4', '.mkv', '.webm', '.mov', '.m4v', '.mp3', '.wav', '.ogg', '.m4a'];
    return streamableTypes.includes(ext.toLowerCase());
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Validates a magnet link format
 * @param {string} magnetLink - The magnet link to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidMagnetLink(magnetLink) {
    if (!magnetLink || typeof magnetLink !== 'string') {
        return false;
    }
    
    if (magnetLink.length > CONFIG.MAX_MAGNET_LENGTH) {
        return false;
    }
    
    return magnetLink.startsWith('magnet:?');
}

/**
 * Serializes a download object for client transmission
 * @param {string} id - Download ID
 * @param {Object} download - Download object
 * @returns {Object} Serialized download data
 */
function serializeDownload(id, download) {
    return {
        id,
        name: download.name,
        progress: download.progress,
        downloadSpeed: download.downloadSpeed,
        uploadSpeed: download.uploadSpeed,
        peers: download.peers,
        status: download.status,
        files: download.files,
        size: download.size,
        downloaded: download.downloaded,
        error: download.error || null,
    };
}

/**
 * Gets all downloads as a serialized array
 * @returns {Array} Array of serialized downloads
 */
function getAllDownloads() {
    const downloadsList = [];
    
    activeDownloads.forEach((download, id) => {
        downloadsList.push(serializeDownload(id, download));
    });
    
    return downloadsList;
}

/**
 * Recursively walks a directory and collects file information
 * @param {string} dir - Directory path
 * @param {string} basePath - Base path for relative paths
 * @returns {Array} Array of file objects
 */
function walkDirectory(dir, basePath = '') {
    const files = [];
    
    try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const relativePath = path.join(basePath, item);
            
            try {
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    files.push(...walkDirectory(fullPath, relativePath));
                } else {
                    files.push({
                        name: item,
                        path: relativePath,
                        size: stat.size,
                        downloadUrl: `/files/${encodeURIComponent(relativePath).replace(/%5C/g, '/')}`,
                    });
                }
            } catch (statError) {
                console.error(`Error reading file stats: ${fullPath}`, statError.message);
            }
        }
    } catch (readError) {
        console.error(`Error reading directory: ${dir}`, readError.message);
    }
    
    return files;
}

/**
 * Cleans up resources for a download
 * @param {string} downloadId - Download ID to cleanup
 */
function cleanupDownload(downloadId) {
    const interval = progressIntervals.get(downloadId);
    
    if (interval) {
        clearInterval(interval);
        progressIntervals.delete(downloadId);
    }
}

/**
 * Creates a new download entry
 * @param {Object} torrent - WebTorrent torrent object
 * @returns {Object} Download entry object
 */
function createDownloadEntry(torrent) {
    return {
        torrent,
        name: 'Loading metadata...',
        progress: 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
        peers: 0,
        status: 'downloading',
        files: [],
        size: 0,
        downloaded: 0,
        error: null,
    };
}

// =============================================================================
// TORRENT EVENT HANDLERS
// =============================================================================

/**
 * Sets up event handlers for a torrent
 * @param {string} downloadId - Download ID
 * @param {Object} torrent - WebTorrent torrent object
 */
function setupTorrentEventHandlers(downloadId, torrent) {
    // Metadata received - torrent info is available
    torrent.on('metadata', () => {
        const download = activeDownloads.get(downloadId);
        
        if (!download) return;
        
        download.name = torrent.name;
        download.size = torrent.length;
        download.files = torrent.files.map((file) => ({
            name: file.name,
            size: file.length,
            path: file.path,
        }));
        
        io.emit('download-update', serializeDownload(downloadId, download));
    });

    // Download progress update
    torrent.on('download', () => {
        const download = activeDownloads.get(downloadId);
        
        if (!download) return;
        
        download.progress = Math.round(torrent.progress * 100);
        download.downloadSpeed = torrent.downloadSpeed;
        download.uploadSpeed = torrent.uploadSpeed;
        download.peers = torrent.numPeers;
        download.downloaded = torrent.downloaded;
    });

    // Download completed
    torrent.on('done', () => {
        cleanupDownload(downloadId);
        
        const download = activeDownloads.get(downloadId);
        
        if (!download) return;
        
        download.status = 'completed';
        download.progress = 100;
        download.files = torrent.files.map((file) => ({
            name: file.name,
            size: file.length,
            path: file.path,
            downloadUrl: `/files/${encodeURIComponent(file.path)}`,
        }));
        
        io.emit('download-update', serializeDownload(downloadId, download));
        console.log(`Download completed: ${download.name}`);
    });

    // Error occurred
    torrent.on('error', (err) => {
        cleanupDownload(downloadId);
        
        const download = activeDownloads.get(downloadId);
        
        if (!download) return;
        
        download.status = 'error';
        download.error = err.message;
        
        io.emit('download-update', serializeDownload(downloadId, download));
        console.error(`Download error: ${err.message}`);
    });

    // Set up progress interval for real-time updates
    const progressInterval = setInterval(() => {
        const download = activeDownloads.get(downloadId);
        
        if (download && download.status === 'downloading') {
            io.emit('download-update', serializeDownload(downloadId, download));
        }
    }, CONFIG.PROGRESS_UPDATE_INTERVAL);
    
    progressIntervals.set(downloadId, progressInterval);
}

// =============================================================================
// STREAMING ROUTES
// =============================================================================

/**
 * GET /stream/*
 * Streams media files with range request support for seeking
 */
app.get('/stream/*', (req, res) => {
    try {
        // Get file path from URL
        const filePath = decodeURIComponent(req.params[0]);
        const fullPath = path.join(CONFIG.DOWNLOADS_DIR, filePath);
        
        // Security: Prevent directory traversal
        const normalizedPath = path.normalize(fullPath);
        if (!normalizedPath.startsWith(CONFIG.DOWNLOADS_DIR)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                error: 'Invalid file path' 
            });
        }
        
        // Check if file exists
        if (!fs.existsSync(fullPath)) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ 
                error: 'File not found' 
            });
        }
        
        const stat = fs.statSync(fullPath);
        const fileSize = stat.size;
        const ext = path.extname(fullPath);
        const mimeType = getMimeType(ext);
        
        // Handle range requests for video seeking
        const range = req.headers.range;
        
        if (range) {
            // Parse range header
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            
            // Validate range
            if (start >= fileSize || end >= fileSize) {
                res.status(416).json({ error: 'Range not satisfiable' });
                return;
            }
            
            const chunkSize = (end - start) + 1;
            
            // Create read stream for the range
            const stream = fs.createReadStream(fullPath, { start, end });
            
            // Set headers for partial content
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': mimeType,
                'Cache-Control': 'public, max-age=3600',
            });
            
            stream.pipe(res);
            
            stream.on('error', (err) => {
                console.error('Stream error:', err.message);
                if (!res.headersSent) {
                    res.status(HTTP_STATUS.INTERNAL_ERROR).json({ 
                        error: 'Stream error' 
                    });
                }
            });
        } else {
            // No range request - send entire file
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': mimeType,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=3600',
            });
            
            const stream = fs.createReadStream(fullPath);
            stream.pipe(res);
            
            stream.on('error', (err) => {
                console.error('Stream error:', err.message);
                if (!res.headersSent) {
                    res.status(HTTP_STATUS.INTERNAL_ERROR).json({ 
                        error: 'Stream error' 
                    });
                }
            });
        }
    } catch (error) {
        console.error('Streaming error:', error.message);
        res.status(HTTP_STATUS.INTERNAL_ERROR).json({ 
            error: 'Failed to stream file' 
        });
    }
});

/**
 * GET /files/*
 * Serves files for download (static file serving with proper headers)
 */
app.get('/files/*', (req, res) => {
    try {
        const filePath = decodeURIComponent(req.params[0]);
        const fullPath = path.join(CONFIG.DOWNLOADS_DIR, filePath);
        
        // Security: Prevent directory traversal
        const normalizedPath = path.normalize(fullPath);
        if (!normalizedPath.startsWith(CONFIG.DOWNLOADS_DIR)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
                error: 'Invalid file path' 
            });
        }
        
        // Check if file exists
        if (!fs.existsSync(fullPath)) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ 
                error: 'File not found' 
            });
        }
        
        const filename = path.basename(fullPath);
        const ext = path.extname(fullPath);
        const mimeType = getMimeType(ext);
        
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        res.sendFile(fullPath);
    } catch (error) {
        console.error('File serving error:', error.message);
        res.status(HTTP_STATUS.INTERNAL_ERROR).json({ 
            error: 'Failed to serve file' 
        });
    }
});

// =============================================================================
// API ROUTES
// =============================================================================

/**
 * GET /api/downloads
 * Returns all active downloads
 */
app.get('/api/downloads', (req, res) => {
    try {
        const downloads = getAllDownloads();
        res.status(HTTP_STATUS.OK).json(downloads);
    } catch (error) {
        console.error('Error fetching downloads:', error.message);
        res.status(HTTP_STATUS.INTERNAL_ERROR).json({ 
            error: 'Failed to fetch downloads' 
        });
    }
});

/**
 * POST /api/download
 * Adds a new torrent download via magnet link
 */
app.post('/api/download', (req, res) => {
    const { magnetLink } = req.body;

    // Validate magnet link
    if (!isValidMagnetLink(magnetLink)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ 
            error: 'Invalid magnet link. Must start with "magnet:?"' 
        });
    }

    const downloadId = uuidv4();

    try {
        const torrent = torrentClient.add(magnetLink, { 
            path: CONFIG.DOWNLOADS_DIR 
        });

        activeDownloads.set(downloadId, createDownloadEntry(torrent));
        setupTorrentEventHandlers(downloadId, torrent);

        res.status(HTTP_STATUS.OK).json({
            id: downloadId,
            message: 'Download started successfully',
            infoHash: torrent.infoHash,
        });
        
        console.log(`New download started: ${downloadId}`);
    } catch (error) {
        console.error('Error starting download:', error.message);
        res.status(HTTP_STATUS.INTERNAL_ERROR).json({ 
            error: 'Failed to start download' 
        });
    }
});

/**
 * DELETE /api/download/:id
 * Removes a download without deleting files
 */
app.delete('/api/download/:id', (req, res) => {
    const { id } = req.params;
    const download = activeDownloads.get(id);

    if (!download) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ 
            error: 'Download not found' 
        });
    }

    try {
        cleanupDownload(id);
        
        if (download.torrent) {
            download.torrent.destroy();
        }
        
        activeDownloads.delete(id);
        
        res.status(HTTP_STATUS.OK).json({ 
            message: 'Download removed successfully' 
        });
        
        console.log(`Download removed: ${id}`);
    } catch (error) {
        console.error('Error removing download:', error.message);
        res.status(HTTP_STATUS.INTERNAL_ERROR).json({ 
            error: 'Failed to remove download' 
        });
    }
});

/**
 * DELETE /api/download/:id/files
 * Removes a download and deletes associated files
 */
app.delete('/api/download/:id/files', (req, res) => {
    const { id } = req.params;
    const download = activeDownloads.get(id);

    if (!download) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ 
            error: 'Download not found' 
        });
    }

    try {
        cleanupDownload(id);
        
        if (download.torrent) {
            const torrentPath = path.join(CONFIG.DOWNLOADS_DIR, download.name);
            
            download.torrent.destroy(() => {
                // Delete files after torrent is destroyed
                if (fs.existsSync(torrentPath)) {
                    fs.rmSync(torrentPath, { recursive: true, force: true });
                    console.log(`Files deleted: ${torrentPath}`);
                }
            });
        }
        
        activeDownloads.delete(id);
        
        res.status(HTTP_STATUS.OK).json({ 
            message: 'Download and files removed successfully' 
        });
        
        console.log(`Download and files removed: ${id}`);
    } catch (error) {
        console.error('Error removing download and files:', error.message);
        res.status(HTTP_STATUS.INTERNAL_ERROR).json({ 
            error: 'Failed to remove download and files' 
        });
    }
});

/**
 * GET /api/files
 * Returns list of all downloaded files
 */
app.get('/api/files', (req, res) => {
    try {
        let files = [];
        
        if (fs.existsSync(CONFIG.DOWNLOADS_DIR)) {
            files = walkDirectory(CONFIG.DOWNLOADS_DIR);
        }
        
        res.status(HTTP_STATUS.OK).json(files);
    } catch (error) {
        console.error('Error listing files:', error.message);
        res.status(HTTP_STATUS.INTERNAL_ERROR).json({ 
            error: 'Failed to list files' 
        });
    }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.status(HTTP_STATUS.OK).json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// =============================================================================
// SOCKET.IO HANDLERS
// =============================================================================

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Send current downloads status to newly connected client
    socket.emit('downloads-list', getAllDownloads());

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });

    socket.on('error', (error) => {
        console.error(`Socket error: ${error.message}`);
    });
});

// =============================================================================
// ERROR HANDLERS
// =============================================================================

// WebTorrent client error handler
torrentClient.on('error', (err) => {
    console.error('WebTorrent client error:', err.message);
});

// Global error handler for uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err.message);
    gracefulShutdown();
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// =============================================================================
// SERVER LIFECYCLE
// =============================================================================

/**
 * Gracefully shuts down the server
 */
function gracefulShutdown() {
    console.log('\nInitiating graceful shutdown...');

    // Clear all progress intervals
    progressIntervals.forEach((interval, id) => {
        clearInterval(interval);
        console.log(`Cleared interval for: ${id}`);
    });
    progressIntervals.clear();

    // Destroy WebTorrent client
    torrentClient.destroy(() => {
        console.log('WebTorrent client destroyed');
        
        server.close(() => {
            console.log('HTTP server closed');
            process.exit(0);
        });
    });

    // Force exit after timeout
    setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
}

// Handle shutdown signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Start server
server.listen(CONFIG.PORT, () => {
    console.log('='.repeat(50));
    console.log('🚀 Torrent Downloader Server');
    console.log('='.repeat(50));
    console.log(`📡 Server running at: http://localhost:${CONFIG.PORT}`);
    console.log(`📁 Downloads directory: ${CONFIG.DOWNLOADS_DIR}`);
    console.log(`🕐 Started at: ${new Date().toISOString()}`);
    console.log('='.repeat(50));
});

export default app;
