const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const LZString = require('lz-string');

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true); // Parse the URL with query parameters
    const filePath = path.join(__dirname, parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname);
    const extname = String(path.extname(filePath)).toLowerCase();

    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        // add more mime types if needed
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    const isBinary = ['.ico', '.png', '.jpg', '.jpeg', '.gif'].includes(extname);
    fs.readFile(filePath, isBinary ? null : 'utf8', function(error, content) {
        if (error) {
            res.writeHead(500);
            res.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
        } else {
            if (parsedUrl.query.points) {
                // Handle the points data...
                let pointsData;
                try {
                    // First try LZ-String decompression
                    pointsData = JSON.parse(LZString.decompressFromEncodedURIComponent(parsedUrl.query.points));
                } catch (error) {
                    console.error('Error decoding points data:', error);
                    res.writeHead(500);
                    res.end('Error decoding route data');
                    return;
                }
                console.log(pointsData);
                // Replace a placeholder in the HTML with the points data
                content = content.replace('<!-- POINTS_DATA -->', JSON.stringify(pointsData));
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(8080, '0.0.0.0', () => {
    console.log('Server running at http://0.0.0.0:8080/');
    console.log(`Access on local network at http://<YOUR-IP-ADDRESS>:8080/`);
});