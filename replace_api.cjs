const fs = require('fs');
const path = 'frontend/src/pages/StationeryManagement.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/\/stationerys/g, '/stationeries');
fs.writeFileSync(path, content);
