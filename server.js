import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import WebTorrent from 'webtorrent';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Initialize WebTorrent client
const client = new WebTorrent();

// Store active downloads
const downloads = new Map();

// Downloads directory
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

// Ensure downloads directory exists
if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve downloaded files
app.use('/files', express.static(DOWNLOADS_DIR));

// API Routes

// Get all downloads status
app.get('/api/downloads', (req, res) => {
    const downloadsList = [];
    downloads.forEach((download, id) => {
        downloadsList.push({
            id,
            name: download.name,
            progress: download.progress,
            downloadSpeed: download.downloadSpeed,
            uploadSpeed: download.uploadSpeed,
            peers: download.peers,
            status: download.status,
            files: download.files,
            size: download.size,
            downloaded: download.downloaded
        });
    });
    res.json(downloadsList);
});

// Add new magnet link
app.post('/api/download', (req, res) => {
    const { magnetLink } = req.body;
    
    if (!magnetLink || !magnetLink.startsWith('magnet:')) {
        return res.status(400).json({ error: 'Invalid magnet link' });
    }

    const downloadId = uuidv4();
    
    try {
        const torrent = client.add(magnetLink, { path: DOWNLOADS_DIR });
        
        downloads.set(downloadId, {
            torrent,
            name: 'Loading metadata...',
            progress: 0,
            downloadSpeed: 0,
            uploadSpeed: 0,
            peers: 0,
            status: 'downloading',
            files: [],
            size: 0,
            downloaded: 0
        });

        torrent.on('metadata', () => {
            const download = downloads.get(downloadId);
            if (download) {
                download.name = torrent.name;
                download.size = torrent.length;
                download.files = torrent.files.map(file => ({
                    name: file.name,
                    size: file.length,
                    path: file.path
                }));
                io.emit('download-update', { id: downloadId, ...download, torrent: undefined });
            }
        });

        torrent.on('download', () => {
            const download = downloads.get(downloadId);
            if (download) {
                download.progress = Math.round(torrent.progress * 100);
                download.downloadSpeed = torrent.downloadSpeed;
                download.uploadSpeed = torrent.uploadSpeed;
                download.peers = torrent.numPeers;
                download.downloaded = torrent.downloaded;
            }
        });

        // Send progress updates every second
        const progressInterval = setInterval(() => {
            const download = downloads.get(downloadId);
            if (download && download.status === 'downloading') {
                io.emit('download-update', { 
                    id: downloadId, 
                    name: download.name,
                    progress: download.progress,
                    downloadSpeed: download.downloadSpeed,
                    uploadSpeed: download.uploadSpeed,
                    peers: download.peers,
                    status: download.status,
                    files: download.files,
                    size: download.size,
                    downloaded: download.downloaded
                });
            }
        }, 1000);

        torrent.on('done', () => {
            clearInterval(progressInterval);
            const download = downloads.get(downloadId);
            if (download) {
                download.status = 'completed';
                download.progress = 100;
                download.files = torrent.files.map(file => ({
                    name: file.name,
                    size: file.length,
                    path: file.path,
                    downloadUrl: `/files/${encodeURIComponent(file.path)}`
                }));
                io.emit('download-update', { id: downloadId, ...download, torrent: undefined });
            }
        });

        torrent.on('error', (err) => {
            clearInterval(progressInterval);
            const download = downloads.get(downloadId);
            if (download) {
                download.status = 'error';
                download.error = err.message;
                io.emit('download-update', { id: downloadId, ...download, torrent: undefined });
            }
        });

        res.json({ 
            id: downloadId, 
            message: 'Download started',
            infoHash: torrent.infoHash 
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Remove a download
app.delete('/api/download/:id', (req, res) => {
    const { id } = req.params;
    const download = downloads.get(id);
    
    if (!download) {
        return res.status(404).json({ error: 'Download not found' });
    }

    try {
        if (download.torrent) {
            download.torrent.destroy();
        }
        downloads.delete(id);
        res.json({ message: 'Download removed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete downloaded files
app.delete('/api/download/:id/files', (req, res) => {
    const { id } = req.params;
    const download = downloads.get(id);
    
    if (!download) {
        return res.status(404).json({ error: 'Download not found' });
    }

    try {
        if (download.torrent) {
            const torrentPath = path.join(DOWNLOADS_DIR, download.name);
            download.torrent.destroy(() => {
                // Delete files after torrent is destroyed
                if (fs.existsSync(torrentPath)) {
                    fs.rmSync(torrentPath, { recursive: true, force: true });
                }
            });
        }
        downloads.delete(id);
        res.json({ message: 'Download and files removed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get list of completed files available for download
app.get('/api/files', (req, res) => {
    const files = [];
    
    function walkDir(dir, basePath = '') {
        const items = fs.readdirSync(dir);
        items.forEach(item => {
            const fullPath = path.join(dir, item);
            const relativePath = path.join(basePath, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                walkDir(fullPath, relativePath);
            } else {
                files.push({
                    name: item,
                    path: relativePath,
                    size: stat.size,
                    downloadUrl: `/files/${encodeURIComponent(relativePath).replace(/%5C/g, '/')}`
                });
            }
        });
    }
    
    if (fs.existsSync(DOWNLOADS_DIR)) {
        walkDir(DOWNLOADS_DIR);
    }
    
    res.json(files);
});

// Socket.io connection
io.on('connection', (socket) => {
    console.log('Client connected');
    
    // Send current downloads status to newly connected client
    const downloadsList = [];
    downloads.forEach((download, id) => {
        downloadsList.push({
            id,
            name: download.name,
            progress: download.progress,
            downloadSpeed: download.downloadSpeed,
            uploadSpeed: download.uploadSpeed,
            peers: download.peers,
            status: download.status,
            files: download.files,
            size: download.size,
            downloaded: download.downloaded
        });
    });
    socket.emit('downloads-list', downloadsList);
    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Error handling
client.on('error', (err) => {
    console.error('WebTorrent error:', err.message);
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Torrent Downloader running at http://localhost:${PORT}`);
    console.log(`📁 Downloads will be saved to: ${DOWNLOADS_DIR}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    client.destroy(() => {
        console.log('WebTorrent client destroyed');
        process.exit(0);
    });
});
