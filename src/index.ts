import app from './app';
import dotenv from 'dotenv';
import http from 'http';
import { initSocket } from './socket';

dotenv.config();

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// Khởi tạo Socket.io
initSocket(server);

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
