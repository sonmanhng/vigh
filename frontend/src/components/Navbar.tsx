import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { notificationService } from '../services/notification.service';
import type { Notification } from '../services/notification.service';
import { useAuth } from '../context/AuthContext';
import { ProfileModal } from './ProfileModal';

export const Navbar: React.FC = () => {
  const { user } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const fetchNotifications = async () => {
    try {
      const data = await notificationService.getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error('Failed to fetch notifications');
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.isRead) {
      await notificationService.markAsRead(notif.id);
      fetchNotifications();
    }
    // Cấp độ mở rộng có thể navigate đến trang tuỳ theo notif.type
  };

  const handleMarkAllRead = async () => {
    await notificationService.markAllAsRead();
    fetchNotifications();
  };

  const getInitials = (name?: string) => {
    if (!name) return 'V';
    const parts = name.trim().split(' ');
    if (parts.length > 1) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  return (
    <>
      <header className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <img src="/logo.png" alt="VIGH Logo" style={{ height: '36px', objectFit: 'contain' }} />
          <div className="navbar-title">HỆ THỐNG QUẢN LÝ ĐỀ TÀI & NHÂN SỰ VIGH</div>

        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {/* Notification Bell */}
          <div className="notification-container" ref={dropdownRef} style={{ position: 'relative' }}>
            <div 
              className="notification-bell" 
              onClick={() => setShowNotifications(!showNotifications)}
              style={{ position: 'relative', cursor: 'pointer', padding: '0.5rem', display: 'flex', alignItems: 'center' }}
            >
              <Bell size={24} color="#334155" />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '0',
                  right: '0',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  padding: '0.1rem 0.35rem',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  transform: 'translate(25%, -25%)'
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: '0',
                marginTop: '0.5rem',
                width: '320px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                border: '1px solid #e2e8f0',
                zIndex: 1000,
                maxHeight: '400px',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>Thông báo</h3>
                  {unreadCount > 0 && (
                    <button 
                      onClick={handleMarkAllRead}
                      style={{ background: 'none', border: 'none', color: '#0ea5e9', fontSize: '0.875rem', cursor: 'pointer' }}
                    >
                      Đánh dấu đã đọc
                    </button>
                  )}
                </div>
                
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b' }}>
                      Không có thông báo nào
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        style={{
                          padding: '1rem',
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: notif.isRead ? 'transparent' : '#f0f9ff',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                      >
                        <div style={{ fontWeight: notif.isRead ? 'normal' : '600', color: '#0f172a', marginBottom: '0.25rem' }}>
                          {notif.title}
                        </div>
                        <div style={{ color: '#475569', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                          {notif.message}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                          {new Date(notif.createdAt).toLocaleString('vi-VN')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="user-profile-trigger" onClick={() => setShowProfile(true)} title="Chỉnh sửa hồ sơ cá nhân">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="avatar-circle"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="avatar-circle">
                {getInitials(user?.name)}
              </div>
            )}
            
            <div className="user-info-text">
              <span className="user-name">{user?.name || 'Cán bộ VIGH'}</span>
              <span className="user-role-badge">{user?.role || 'ChuyenVien'}</span>
            </div>
          </div>
        </div>
      </header>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </>
  );
};
