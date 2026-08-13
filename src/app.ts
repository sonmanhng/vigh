import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import projectRoutes from './routes/project.routes';
import taskRoutes from './routes/task.routes';
import chemicalRoutes from './routes/chemical.routes';
import cellRoutes from './routes/cell.routes';
import machineRoutes from './routes/machine.routes';
import laborRoutes from './routes/labor.routes';
import notificationRoutes from './routes/notification.routes';
import weeklyReportRoutes from './routes/weeklyReport.routes';
import homeRoutes from './routes/home.routes';

const app = express();

// CORS — allow all origins (internal management system)
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Global Cache-Control for API to prevent aggressive caching (e.g. by Cloudflare Tunnels)
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/chemicals', chemicalRoutes);
app.use('/api/cells', cellRoutes);
app.use('/api/machines', machineRoutes);
app.use('/api/labor', laborRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/weekly-reports', weeklyReportRoutes);
app.use('/api/home', homeRoutes);

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
  
  // Phục vụ assets cho cả base '/' và base '/vigh/'
  const staticOptions = {
    setHeaders: (res: express.Response, pathStr: string) => {
      if (pathStr.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      }
    }
  };
  
  app.use(express.static(frontendDist, staticOptions));
  app.use('/vigh', express.static(frontendDist, staticOptions));
  
  // SPA fallback — serve index.html for all non-API routes (Express 5 compatible)
  app.use((req: express.Request, res: express.Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({ message: 'Welcome to Vigh Backend API', status: 'Running' });
  });
}

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
  });
});

export default app;
