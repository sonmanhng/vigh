import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';

interface ProfileModalProps {
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose }) => {
  const { user, updateUser, logout } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [affiliations, setAffiliations] = useState(user?.affiliations?.join(', ') || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [orcid, setOrcid] = useState(user?.orcid || '');
  const [scholar, setScholar] = useState(user?.scholar || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [researchInterests, setResearchInterests] = useState(user?.researchInterests?.join(', ') || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: any = {
        name,
        avatar,
        department,
        phone,
        orcid,
        scholar,
        bio,
        affiliations: affiliations.split(',').map(a => a.trim()).filter(a => a.length > 0),
        researchInterests: researchInterests.split(',').map(a => a.trim()).filter(a => a.length > 0)
      };
      if (password.trim() !== '') {
        payload.password = password;
      }

      const res = await apiClient.put('/users/profile', payload);
      updateUser(res.data.user);
      setSuccess('Cập nhật thông tin thành công!');
      setPassword('');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật hồ sơ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Hồ Sơ Cá Nhân VIGH</div>
          <button type="button" className="modal-close-btn" onClick={onClose}>Đóng</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{ backgroundColor: 'rgba(250, 103, 129, 0.15)', color: 'var(--accent-red)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontWeight: 600 }}>
                {error}
              </div>
            )}

            {success && (
              <div style={{ backgroundColor: 'rgba(47, 160, 132, 0.15)', color: 'var(--primary-light)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontWeight: 600 }}>
                {success}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#F8FAFC', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              {avatar ? (
                <img
                  src={avatar}
                  alt={name}
                  style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700 }}>
                  {name ? name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)' }}>{user?.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{user?.email}</div>
                <span className="badge badge-primary" style={{ marginTop: '0.3rem' }}>{user?.role}</span>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Họ và tên cán bộ</label>
              <input
                type="text"
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Phòng ban / Đơn vị công tác</label>
              <input
                type="text"
                className="input-field"
                placeholder="VD: Phòng Nghiên cứu Dược liệu"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Cơ quan / Tổ chức liên kết (Affiliations)</label>
              <input
                type="text"
                className="input-field"
                placeholder="VD: VIGH"
                value={affiliations}
                onChange={(e) => setAffiliations(e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Các cơ quan cách nhau bằng dấu phẩy (,)</span>
            </div>

            <div className="input-group">
              <label className="input-label">Số điện thoại liên hệ</label>
              <input
                type="text"
                className="input-field"
                placeholder="VD: 0912 345 678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Mã số nhà khoa học (ORCID)</label>
              <input
                type="text"
                className="input-field"
                placeholder="VD: 0000-0002-1825-0097"
                value={orcid}
                onChange={(e) => setOrcid(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Google Scholar ID (Nếu có)</label>
              <input
                type="text"
                name="scholarId"
                autoComplete="off"
                className="input-field"
                placeholder="VD: uB2d8iMAAAAJ"
                value={scholar}
                onChange={(e) => setScholar(e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Chỉ cần nhập ID cuối đường link. Ví dụ link là: scholar.google.com/citations?user=uB2d8iMAAAAJ thì nhập phần "uB2d8iMAAAAJ"</span>
            </div>

            <div className="input-group">
              <label className="input-label">Lý lịch khoa học / Giới thiệu bản thân</label>
              <textarea
                className="input-field"
                style={{ minHeight: '80px', resize: 'vertical' }}
                placeholder="Viết một đoạn ngắn giới thiệu về bản thân..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Các hướng nghiên cứu chính</label>
              <input
                type="text"
                className="input-field"
                placeholder="VD: Dược lý học, Hóa thực vật, Sinh học phân tử..."
                value={researchInterests}
                onChange={(e) => setResearchInterests(e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ngăn cách các hướng nghiên cứu bằng dấu phẩy (,)</span>
            </div>

            <div className="input-group">
              <label className="input-label">Đường dẫn ảnh đại diện (Avatar URL)</label>
              <input
                type="url"
                className="input-field"
                placeholder="https://example.com/avatar.jpg"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Đổi mật khẩu mới (Bỏ trống nếu không đổi)</label>
              <input
                type="password"
                name="new-password"
                autoComplete="new-password"
                className="input-field"
                placeholder="Để trống nếu không muốn đổi mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => { onClose(); logout(); }}
            >
              Đăng Xuất Khỏi Hệ Thống
            </button>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                Hủy
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
