import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { Calendar, Clock, Users, Plus, Trash2, X } from 'lucide-react';

export const MeetingManagement: React.FC = () => {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);

  const isTopAdmin = user && ['SuperAdmin', 'VienTruong', 'VienPho'].includes(user.role);

  useEffect(() => {
    fetchMeetings();
    if (isTopAdmin) {
      fetchUsers();
    }
  }, [isTopAdmin]);

  const fetchMeetings = async () => {
    try {
      const res = await apiClient.get('/meetings');
      setMeetings(res.data);
    } catch (err) {
      console.error('Error fetching meetings', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await apiClient.get('/users');
      setUsersList(res.data);
    } catch (err) {
      console.error('Error fetching users', err);
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDate || !newTime) return;

    try {
      // Combine date and time
      const datetime = new Date(`${newDate}T${newTime}`);
      await apiClient.post('/meetings', {
        title: newTitle,
        content: newContent,
        date: datetime.toISOString(),
        participantIds: selectedUsers
      });
      setShowModal(false);
      setNewTitle('');
      setNewContent('');
      setNewDate('');
      setNewTime('');
      setSelectedUsers([]);
      fetchMeetings();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Bạn có chắc muốn xoá lịch họp này?')) return;
    try {
      await apiClient.delete(`/meetings/${id}`);
      fetchMeetings();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể xoá lịch họp');
    }
  };

  const handleToggleUser = (id: number) => {
    if (selectedUsers.includes(id)) {
      setSelectedUsers(selectedUsers.filter(uid => uid !== id));
    } else {
      setSelectedUsers([...selectedUsers, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === usersList.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(usersList.map(u => u.id));
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Đang tải dữ liệu...</div>;

  return (
    <div className="content-area">
      <div className="content-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="content-title" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)' }}>Thông báo họp</h1>
          <p style={{ color: 'var(--text-muted)' }}>Lịch họp và các cuộc họp sắp tới của bạn</p>
        </div>
        {isTopAdmin && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={20} />
            Tạo lịch họp mới
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {meetings.length === 0 ? (
          <div style={{ color: '#64748b' }}>Hiện chưa có thông báo họp nào.</div>
        ) : (
          meetings.map(m => (
            <div key={m.id} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '4px solid #3b82f6', position: 'relative' }}>
              {(isTopAdmin || m.createdById === user?.id) && (
                <button 
                  onClick={() => handleDelete(m.id)}
                  style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                  title="Xoá cuộc họp"
                >
                  <Trash2 size={18} />
                </button>
              )}
              
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#0f172a', margin: '0 0 1rem 0', paddingRight: '2rem' }}>{m.title}</h2>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', marginBottom: '0.5rem' }}>
                <Calendar size={18} color="#3b82f6" />
                <span>{new Date(m.date).toLocaleDateString('vi-VN')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', marginBottom: '1rem' }}>
                <Clock size={18} color="#f59e0b" />
                <span>{new Date(m.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              {m.content && (
                <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.95rem', color: '#334155' }}>
                  {m.content}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                <Users size={16} style={{ marginTop: '0.2rem' }} />
                <div>
                  <strong style={{ display: 'block', color: '#475569', marginBottom: '0.25rem' }}>Người tham gia ({m.participants?.length || 0}):</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {m.participants?.map((p: any) => (
                      <span key={p.id} style={{ background: '#e2e8f0', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', color: '#334155' }}>
                        {p.user?.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#94a3b8' }}>
                Tạo bởi: {m.creator?.name}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Tạo Lịch Họp */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.5rem' }}>Tạo Thông Báo Họp</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleCreateMeeting}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Tiêu đề buổi họp (*)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={newTitle} 
                  onChange={e => setNewTitle(e.target.value)} 
                  placeholder="VD: Họp giao ban đầu tháng"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Ngày họp (*)</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={newDate} 
                    onChange={e => setNewDate(e.target.value)} 
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Giờ họp (*)</label>
                  <input 
                    type="time" 
                    className="input-field" 
                    value={newTime} 
                    onChange={e => setNewTime(e.target.value)} 
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Nội dung buổi họp</label>
                <textarea 
                  className="input-field" 
                  value={newContent} 
                  onChange={e => setNewContent(e.target.value)} 
                  rows={4}
                  placeholder="Nhập nội dung cần thảo luận..."
                />
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontWeight: 600, margin: 0 }}>Thành viên tham gia</label>
                  <button type="button" onClick={handleSelectAll} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}>
                    {selectedUsers.length === usersList.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                  </button>
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {usersList.map(u => (
                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.5rem', borderRadius: '6px', backgroundColor: selectedUsers.includes(u.id) ? '#eff6ff' : 'transparent' }}>
                      <input 
                        type="checkbox"
                        checked={selectedUsers.includes(u.id)}
                        onChange={() => handleToggleUser(u.id)}
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span>{u.name} <small style={{ color: '#64748b' }}>({u.role})</small></span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={!newTitle || !newDate || !newTime}>Tạo buổi họp</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
