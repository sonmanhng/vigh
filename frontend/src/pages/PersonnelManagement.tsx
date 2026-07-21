import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { PersonalProfile } from './PersonalProfile';

const ALL_ROLES = [
  { value: 'VienTruong', label: 'Viện Trưởng - Ban Lãnh Đạo Viện' },
  { value: 'VienPho', label: 'Viện Phó - Ban Lãnh Đạo Viện' },
  { value: 'SuperAdmin', label: 'SuperAdmin - Quản Trị Cấp Cao' },
  { value: 'TruongPhong', label: 'Trưởng Phòng - Quản Lý Đơn Vị' },
  { value: 'ChuyenVien', label: 'Chuyên Viên - Nghiên Cứu Viên' },
  { value: 'Student', label: 'Sinh Viên - Thực Tập Sinh' },
];

export const PersonnelManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // New user form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('vigh123456');
  const [role, setRole] = useState('ChuyenVien');
  const [department, setDepartment] = useState('');
  const [affiliations, setAffiliations] = useState('');
  const [phone, setPhone] = useState('');
  const [avatar, setAvatar] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const isManagerOrAdmin = user && ['SuperAdmin', 'VienTruong', 'VienPho', 'TruongPhong', 'ADMIN', 'MANAGER'].includes(user.role);
  const isTopAdmin = user && ['SuperAdmin', 'VienTruong', 'VienPho', 'ADMIN'].includes(user.role);

  const ROLE_SORT_ORDER: Record<string, number> = {
    'VienTruong': 1,
    'VienPho': 2,
    'SuperAdmin': 3,
    'TruongPhong': 4,
    'ChuyenVien': 5,
    'ADMIN': 3,
    'MANAGER': 4,
    'USER': 5,
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/users');
      const sortedUsers = res.data.sort((a: any, b: any) => {
        const rankA = ROLE_SORT_ORDER[a.role] || 99;
        const rankB = ROLE_SORT_ORDER[b.role] || 99;
        if (rankA !== rankB) return rankA - rankB;
        return a.id - b.id; // Nếu cùng cấp bậc thì xếp theo ID
      });
      setUsers(sortedUsers);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tải danh sách nhân sự');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload: any = {
        name,
        role,
        department,
        phone,
        avatar,
        affiliations: affiliations.split(',').map(a => a.trim()).filter(a => a.length > 0),
      };

      if (editingUserId) {
        await apiClient.put(`/users/${editingUserId}`, payload);
      } else {
        payload.email = email;
        payload.password = password;
        await apiClient.post('/users', payload);
      }

      setShowModal(false);
      // Reset form
      setEditingUserId(null);
      setName('');
      setEmail('');
      setPassword('vigh123456');
      setRole('ChuyenVien');
      setDepartment('');
      setAffiliations('');
      setPhone('');
      setAvatar('');
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi lưu thông tin nhân sự');
    } finally {
      setCreating(false);
    }
  };

  const openCreateModal = () => {
    setEditingUserId(null);
    setName('');
    setEmail('');
    setPassword('vigh123456');
    setRole('ChuyenVien');
    setDepartment('');
    setAffiliations('');
    setPhone('');
    setAvatar('');
    setShowModal(true);
  };

  const openEditModal = (userToEdit: any) => {
    setEditingUserId(userToEdit.id);
    setName(userToEdit.name || '');
    setEmail(userToEdit.email || '');
    setPassword('');
    setRole(userToEdit.role || 'ChuyenVien');
    setDepartment(userToEdit.department || '');
    setAffiliations(userToEdit.affiliations?.join(', ') || '');
    setPhone(userToEdit.phone || '');
    setAvatar(userToEdit.avatar || '');
    setShowModal(true);
  };

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      await apiClient.put(`/users/${userId}`, { role: newRole });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không có quyền thay đổi chức vụ');
    }
  };

  const handleDeleteUser = async (userId: number, userName: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa cán bộ "${userName}" khỏi hệ thống?`)) return;
    try {
      await apiClient.delete(`/users/${userId}`);
      setUsers(users.filter(u => u.id !== userId));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể xóa tài khoản này');
    }
  };

  const getInitials = (n?: string) => {
    if (!n) return 'V';
    const parts = n.trim().split(' ');
    if (parts.length > 1) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return n.charAt(0).toUpperCase();
  };

  const getRoleBadgeClass = (r: string) => {
    if (['SuperAdmin', 'VienTruong', 'VienPho', 'ADMIN'].includes(r)) return 'badge badge-danger';
    if (['TruongPhong', 'MANAGER'].includes(r)) return 'badge badge-warning';
    return 'badge badge-success';
  };

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải danh sách nhân sự Viện VIGH...</div>;
  }

  if (selectedUserId) {
    return <PersonalProfile userId={selectedUserId} onBack={() => setSelectedUserId(null)} />;
  }

  return (
    <div className="content-area">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)' }}>Quản Lý Nhân Sự Viện VIGH</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            Danh sách cán bộ, chức danh công tác và phân quyền hệ thống
          </p>
        </div>

        {isManagerOrAdmin && (
          <button className="btn btn-primary" onClick={openCreateModal}>
            Thêm Nhân Sự Mới
          </button>
        )}
      </div>

      {error ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--accent-red)', fontWeight: 600 }}>
          {error}
        </div>
      ) : (
        <div className="table-container">
          <table className="modern-table">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Nhân sự</th>
                <th style={{ width: '15%' }}>Tài khoản Email</th>
                <th style={{ width: '15%' }}>Cơ quan</th>
                <th style={{ width: '15%' }}>Phòng Ban / Đơn vị</th>
                <th style={{ width: '10%' }}>Số Điện Thoại</th>
                <th style={{ width: '15%' }}>Chức Vụ</th>
                {isManagerOrAdmin && <th style={{ textAlign: 'right' }}>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    Chưa có nhân sự nào trong hệ thống.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div 
                        style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', cursor: 'pointer' }}
                        onClick={() => setSelectedUserId(u.id.toString())}
                        title="Xem hồ sơ chi tiết"
                      >
                        {u.avatar ? (
                          <img
                            src={u.avatar}
                            alt={u.name}
                            style={{ width: '40px', height: '40px', minWidth: '40px', minHeight: '40px', flexShrink: 0, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--primary)' }}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <div style={{ width: '40px', height: '40px', minWidth: '40px', minHeight: '40px', flexShrink: 0, borderRadius: '50%', backgroundColor: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem' }}>
                            {getInitials(u.name)}
                          </div>
                        )}
                        <div style={{ transition: 'color 0.2s ease' }} className="hover-primary">
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{u.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: #{u.id}</div>
                        </div>
                      </div>
                    </td>
                    <td><span style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{u.email}</span></td>
                    <td>
                      {u.affiliations && u.affiliations.length > 0 ? (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {u.affiliations.map((aff: string, idx: number) => (
                            <span key={idx} style={{
                              backgroundColor: 'rgba(0, 114, 229, 0.1)',
                              color: 'var(--primary)',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              whiteSpace: 'nowrap'
                            }}>
                              {aff}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>---</span>
                      )}
                    </td>
                    <td>{u.department || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa cập nhật</span>}</td>
                    <td>{u.phone || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>---</span>}</td>
                    <td>
                      {isTopAdmin ? (
                        <select
                          className="select-field"
                          style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', width: 'auto', fontWeight: 600 }}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        >
                          {ALL_ROLES.map(r => (
                            <option key={r.value} value={r.value}>{r.label.split(' - ')[0]}</option>
                          ))}
                          {!ALL_ROLES.some(r => r.value === u.role) && <option value={u.role}>{u.role}</option>}
                        </select>
                      ) : (
                        <span className={getRoleBadgeClass(u.role)}>{u.role}</span>
                      )}
                    </td>
                    {isManagerOrAdmin && (
                      <td style={{ textAlign: 'right' }}>
                        {isTopAdmin && u.id !== user?.id && (
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => openEditModal(u)}
                              title="Sửa thông tin"
                            >
                              Sửa
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteUser(u.id, u.name)}
                              title="Xóa nhân sự"
                            >
                              Xóa
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal create user */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editingUserId ? 'Chỉnh Sửa Nhân Sự' : 'Thêm Nhân Sự Mới Viện VIGH'}</div>
              <button type="button" className="modal-close-btn" onClick={() => setShowModal(false)}>Đóng</button>
            </div>

            <form onSubmit={handleSubmitUser}>
              <div className="modal-body">
                <div className="input-group">
                  <label className="input-label">Họ và tên cán bộ (*)</label>
                  <input type="text" className="input-field" placeholder="VD: TS. Nguyễn Văn A" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>

                <div className="input-group">
                  <label className="input-label">Email đăng nhập (*)</label>
                  <input type="email" className="input-field" placeholder="nguyenvana@vigh.org" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={!!editingUserId} style={{ backgroundColor: editingUserId ? '#f0f0f0' : 'white' }} />
                </div>

                {!editingUserId && (
                  <div className="input-group">
                    <label className="input-label">Mật khẩu khởi tạo (*)</label>
                    <input type="text" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mặc định là vigh123456</span>
                  </div>
                )}

                <div className="input-group">
                  <label className="input-label">Chức vụ / Quyền hạn (*)</label>
                  <select className="select-field" value={role} onChange={(e) => setRole(e.target.value)} disabled={!isTopAdmin}>
                    {ALL_ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Cơ quan / Tổ chức công tác (Affiliations)</label>
                  <input type="text" className="input-field" placeholder="VD: Vietnam Institute of Ginseng and Herbal Medicine, X University" value={affiliations} onChange={(e) => setAffiliations(e.target.value)} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Các cơ quan cách nhau bằng dấu phẩy (,)</span>
                </div>

                <div className="input-group">
                  <label className="input-label">Phòng ban / Đơn vị</label>
                  <select className="select-field" value={department} onChange={(e) => setDepartment(e.target.value)}>
                    <option value="">-- Chọn phòng ban --</option>
                    <option value="Ban lãnh đạo">Ban lãnh đạo</option>
                    <option value="Phòng Khoa học Công nghệ">Phòng Khoa học Công nghệ</option>
                    <option value="Phòng Sinh học">Phòng Sinh học</option>
                    <option value="Phòng Công nghệ Dược">Phòng Công nghệ Dược</option>
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Số điện thoại</label>
                  <input type="text" className="input-field" placeholder="VD: 0987 654 321" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>

                <div className="input-group">
                  <label className="input-label">Đường dẫn ảnh Avatar (URL)</label>
                  <input type="url" className="input-field" placeholder="https://..." value={avatar} onChange={(e) => setAvatar(e.target.value)} />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={creating}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Đang lưu...' : (editingUserId ? 'Lưu Thay Đổi' : 'Thêm Nhân Sự')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
