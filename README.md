# Torrent Downloader

A web application to download torrents via magnet links and provide direct download links to users.

![Torrent Downloader Screenshot](screenshots/Screenshot%202025-12-31%20222028.png)

## Features

- 🧲 **Magnet Link Support**: Paste magnet links to start downloading
- 📊 **Real-time Progress**: Live download progress with speed and peer count
- 📁 **File Management**: Browse and download completed files
- 🔄 **WebSocket Updates**: Real-time updates without page refresh
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🎨 **Modern UI**: Clean, dark-themed interface
- 🐳 **Docker Support**: Easy deployment with Docker
- 🎬 **Advanced Media Player**: Feature-rich Plyr-based video/audio player
- 📝 **Subtitle Support**: Load VTT, SRT, ASS, SSA subtitles with auto-conversion
- ⏩ **Playback Controls**: Speed control, seeking, keyboard shortcuts
- 🖼️ **Picture-in-Picture**: Watch while browsing
- 🔄 **FFmpeg Transcoding**: Automatic transcoding for unsupported formats (MKV, AVI, etc.)

## Prerequisites

### Local Development
- Node.js 18.x or higher
- npm or yarn
- FFmpeg (optional, for transcoding unsupported media formats)

### Docker Deployment
- Docker 20.x or higher
- Docker Compose v2.x or higher
- (FFmpeg is included in the Docker image)

## Quick Start with Docker

The easiest way to run the application:

```bash
# Clone the repository
git clone https://github.com/Tharusha01/Torrent-Download.git
cd Torrent-Download

# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down
```

The application will be available at `http://localhost:3000`

## Docker Commands

```bash
# Build the image
docker build -t torrent-downloader .

# Run container manually
docker run -d \
  --name torrent-downloader \
  -p 3000:3000 \
  -v $(pwd)/downloads:/app/downloads \
  torrent-downloader

# Stop container
docker stop torrent-downloader

# Remove container
docker rm torrent-downloader

# View logs
docker logs -f torrent-downloader
```

## Local Installation

1. Clone or navigate to the project directory:
   ```bash
   cd Torent-downloader
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Usage

1. **Add a Torrent**: Paste a magnet link in the input field and click "Add Torrent"
2. **Monitor Progress**: Watch the download progress in real-time
3. **Download Files**: Once complete, click the download button next to each file
4. **Play Media**: Click the play button on video/audio files to stream them directly
5. **Add Subtitles**: Click the subtitles button to load VTT, SRT, ASS, or SSA files
6. **Manage Downloads**: Remove downloads using the trash icon

## Media Player Features

The built-in **Plyr-based** media player includes:

### Playback Controls
- ▶️ Play/Pause with large center button
- ⏪ Rewind 10 seconds / Fast Forward 10 seconds
- 🎚️ Volume control with mute toggle
- 📊 Progress bar with seek preview
- ⏱️ Current time and duration display

### Advanced Features
- ⚡ **Playback Speed**: 0.5x, 0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x
- 📝 **Subtitles**: Load VTT, SRT, ASS, SSA files (auto-converted to VTT)
- 🔄 **Loop**: Toggle loop playback
- 🖼️ **Picture-in-Picture**: Watch while browsing other content
- 📺 **Fullscreen**: Full screen mode with controls
- ⌨️ **Keyboard Shortcuts**: Space (play/pause), arrows (seek), M (mute), F (fullscreen)

### Subtitle Support
- **Drag & Drop**: Drop subtitle files directly onto the player
- **File Browser**: Select subtitle files from your computer
- **Torrent Files**: Load subtitles from downloaded torrent files
- **Auto-Detection**: Automatic language detection from filename
- **Format Conversion**: Automatic SRT/ASS/SSA to VTT conversion

### Supported Formats

#### Native Browser Formats (No FFmpeg required)
- **Video**: MP4, WebM
- **Audio**: MP3, WAV, OGG, M4A

#### Transcoded Formats (Requires FFmpeg)
- **Video**: MKV, AVI, MOV, WMV, FLV, M4V, 3GP
- **Audio**: FLAC, WMA, AAC

**Note**: For local development, install FFmpeg to enable transcoding:
- **Windows**: Download from [ffmpeg.org](https://ffmpeg.org/download.html) or use `winget install ffmpeg`
- **macOS**: `brew install ffmpeg`
- **Linux**: `apt install ffmpeg` or `yum install ffmpeg`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/downloads` | Get all active downloads |
| POST | `/api/download` | Add a new magnet link |
| DELETE | `/api/download/:id` | Remove a download |
| DELETE | `/api/download/:id/files` | Remove download and files |
| GET | `/api/files` | List all downloaded files |

## Project Structure

```
Torent-downloader/
├── server.js          # Express server with WebTorrent
├── package.json       # Dependencies and scripts
├── Dockerfile         # Docker image configuration
├── docker-compose.yml # Docker Compose configuration
├── .dockerignore      # Docker build exclusions
├── .eslintrc.json     # ESLint configuration
├── public/            # Frontend files
│   ├── index.html     # Main HTML page
│   ├── style.css      # Styling
│   └── script.js      # Client-side JavaScript
└── downloads/         # Downloaded files directory
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `production` | Environment mode |
| `CORS_ORIGIN` | `*` | Allowed CORS origins |

Copy `.env.example` to `.env` to customize settings.

## Tech Stack

- **Backend**: Node.js, Express.js
- **Torrent Client**: WebTorrent
- **Real-time Updates**: Socket.io
- **Containerization**: Docker
- **Frontend**: Vanilla JavaScript, CSS3

## Notes

- This application is for educational purposes only
- Ensure you have the legal right to download any content
- Downloaded files are stored on the server

## License

MIT
