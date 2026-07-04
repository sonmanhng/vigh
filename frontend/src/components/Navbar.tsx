import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ProfileModal } from './ProfileModal';

export const Navbar: React.FC = () => {
  const { user } = useAuth();
  const [showProfile, setShowProfile] = useState(false);

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
      </header>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </>
  );
};
