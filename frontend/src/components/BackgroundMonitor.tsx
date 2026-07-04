import React, { useEffect } from 'react';

export const BackgroundMonitor: React.FC = () => {
  useEffect(() => {
    // Keep track of which chemicals we've already notified about
    // to avoid spamming the user every 10 seconds.
    const notifiedIds = new Set<number>();

    const checkChemicals = async () => {
      const saved = localStorage.getItem('vigh_chemicals_v1');
      if (saved) {
        try {
          const chemicals = JSON.parse(saved);
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

          chemicals.forEach((c: any) => {
            const maxQty = c.maxQuantity || 1;
            const threshold = c.threshold || 50;
            const percentage = (c.currentQuantity / maxQty) * 100;
            
            if (percentage < threshold) {
              // If not yet notified during this session
              if (!notifiedIds.has(c.id)) {
                const title = '🚨 BÁO ĐỘNG KHO HOÁ CHẤT VIGH';
                const bodyStr = `Hoá chất "${c.name}" hiện chỉ còn ${c.currentQuantity}/${c.maxQuantity} ${c.unit} (dưới mức cảnh báo). Cần bổ sung khẩn cấp!`;
                
                if (isTauri() && tauriPermission && tauriSendNotification) {
                  tauriSendNotification({ title, body: bodyStr });
                } else if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification(title, { body: bodyStr, icon: '/logo.png' });
                }
                
                notifiedIds.add(c.id);
              }
            } else {
              // If the chemical quantity was replenished above threshold, remove it from notified list
              // so it can trigger an alarm again if it drops in the future!
              notifiedIds.delete(c.id);
            }
          });
        } catch (e) {
          console.error('Error in global background monitor:', e);
        }
      }
    };

    // Delay initial check by 2 seconds to let the app load
    setTimeout(checkChemicals, 2000);
    
    // Check periodically (every 10 seconds)
    const interval = setInterval(checkChemicals, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // Background worker has no UI
  return null;
};
