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

## Prerequisites

- Node.js 16.x or higher
- npm or yarn

## Installation

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
4. **Manage Downloads**: Remove downloads using the trash icon

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
├── public/            # Frontend files
│   ├── index.html     # Main HTML page
│   ├── style.css      # Styling
│   └── script.js      # Client-side JavaScript
└── downloads/         # Downloaded files directory
```

## Configuration

- **Port**: Default is 3000, can be changed via `PORT` environment variable
- **Downloads Directory**: Files are saved to `./downloads` folder

## Tech Stack

- **Backend**: Node.js, Express.js
- **Torrent Client**: WebTorrent
- **Real-time Updates**: Socket.io
- **Frontend**: Vanilla JavaScript, CSS3

## Notes

- This application is for educational purposes only
- Ensure you have the legal right to download any content
- Downloaded files are stored on the server

## License

MIT
