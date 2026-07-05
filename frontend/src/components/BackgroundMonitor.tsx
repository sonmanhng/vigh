import React, { useEffect } from 'react';

export const BackgroundMonitor: React.FC = () => {
  useEffect(() => {
    // Keep track of which chemicals we've already notified about
    // to avoid spamming the user every 10 seconds.
    const notifiedIds = new Set<number>();

    const checkNotifications = async () => {
      try {
        const { isTauri } = await import('@tauri-apps/api/core');
        let tauriPermission = false;
        let tauriSendNotification: any = null;

        if (isTauri()) {
          const plugin = await import('@tauri-apps/plugin-notification');
          tauriPermission = await plugin.isPermissionGranted();
          if (!tauriPermission) {
            const perm = await plugin.requestPermission();
            tauriPermission = perm === 'granted';
          }
          tauriSendNotification = plugin.sendNotification;
        } else if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }

        // Fetch new notifications from the backend
        const token = localStorage.getItem('token');
        if (!token) return; // User not logged in

        // We use fetch directly here to avoid circular imports or dependency issues 
        // with the interceptor if it fails, but notificationService is better.
        // Let's import it dynamically to avoid initialization issues
        const { notificationService } = await import('../services/notification.service');
        const notifications = await notificationService.getNotifications();
        
        notifications.forEach((n: any) => {
          if (!n.isRead && !notifiedIds.has(n.id)) {
            if (isTauri() && tauriPermission && tauriSendNotification) {
              tauriSendNotification({ title: n.title, body: n.message });
            } else if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(n.title, { body: n.message, icon: '/logo-app.png' });
            }
            notifiedIds.add(n.id);
          }
        });
      } catch (e) {
        console.error('Error in global background monitor:', e);
      }
    };

    // Delay initial check by 2 seconds to let the app load
    setTimeout(checkNotifications, 2000);
    
    // Check periodically (every 10 seconds)
    const interval = setInterval(checkNotifications, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // Background worker has no UI
  return null;
};
