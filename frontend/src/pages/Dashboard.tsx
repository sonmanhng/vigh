import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { Navbar } from '../components/Navbar';
import { PersonnelManagement } from './PersonnelManagement';
import { ChemicalManagement } from './ChemicalManagement';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const activeTab = urlTab === 'personnel' ? 'personnel' : (urlTab === 'chemicals' ? 'chemicals' : 'projects');
  
  const setActiveTab = (tab: 'projects' | 'personnel' | 'chemicals') => {
    if (tab === 'personnel') {
      setSearchParams({ tab: 'personnel' });
    } else if (tab === 'chemicals') {
      setSearchParams({ tab: 'chemicals' });
    } else {
      setSearchParams({});
    }
  };
  
  // Projects State
  const [projects, setProjects] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  
  // New Project State
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectManager, setNewProjectManager] = useState<number | ''>('');
  const [newProjectMembers, setNewProjectMembers] = useState<number[]>([]);
  
  const isManagerOrAdmin = user && ['SuperAdmin', 'VienTruong', 'VienPho', 'TruongPhong', 'ADMIN', 'MANAGER'].includes(user.role);

  useEffect(() => {
    fetchProjects();
    fetchUsersList();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await apiClient.get('/projects');
      setProjects(res.data);
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const fetchUsersList = async () => {
    try {
      const res = await apiClient.get('/users');
      setUsersList(res.data);
    } catch (err) {
      console.error('Error fetching users list:', err);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      const res = await apiClient.post('/projects', { 
        name: newProjectName, 
        description: newProjectDesc || 'Đề tài nghiên cứu Viện VIGH',
        managerId: newProjectManager ? Number(newProjectManager) : user?.id,
        memberIds: newProjectMembers
      });
      setShowCreateProjectModal(false);
      setNewProjectName('');
      setNewProjectDesc('');
      setNewProjectManager('');
      setNewProjectMembers([]);
      await fetchProjects();
      navigate(`/project/${res.data.id}`);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không có quyền tạo đề tài mới');
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: number, projectName: string) => {
    e.stopPropagation();
    if (!window.confirm(`CẢNH BÁO: Xóa đề tài "${projectName}" sẽ xóa toàn bộ các công việc bên trong. Bạn chắc chứ?`)) return;
    try {
      await apiClient.delete(`/projects/${projectId}`);
      setProjects(projects.filter(p => p.id !== projectId));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không có quyền xóa đề tài này');
    }
  };

  return (
    <div className="app-container">
      {/* Left Sidebar Menu */}
      <aside className="sidebar">
        <div className="sidebar-header" style={{ backgroundColor: '#FFFFFF', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'center', borderBottom: '1px solid var(--border-color)' }}>
          <img 
            src="/logo.png" 
            alt="Viện VIGH Logo" 
            style={{ maxHeight: '54px', maxWidth: '100%', objectFit: 'contain', cursor: 'pointer' }} 
            onClick={() => setActiveTab('projects')}
          />
        </div>

        <nav className="sidebar-menu">
          <button 
            className={`menu-item ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            <span>Tiến độ đề tài</span>
          </button>

          <button 
            className={`menu-item ${activeTab === 'personnel' ? 'active' : ''}`}
            onClick={() => setActiveTab('personnel')}
          >
            <span>Quản lý nhân sự</span>
          </button>

          <button 
            className={`menu-item ${activeTab === 'chemicals' ? 'active' : ''}`}
            onClick={() => setActiveTab('chemicals')}
          >
            <span>Quản lý hoá chất 🧪</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)' }}>
            <div style={{ fontWeight: 600, color: '#fff' }}>Hệ Thống VIGH Portal</div>
            <div>Phiên bản 2.0 - 2026</div>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="main-area">
        <Navbar />

        {activeTab === 'personnel' ? (
          <PersonnelManagement />
        ) : activeTab === 'chemicals' ? (
          <ChemicalManagement />
        ) : (
          <div className="content-area">
            {/* Project Progress Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)' }}>Danh Sách Các Đề Tài Nghiên Cứu</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
                  Bấm vào từng thẻ đề tài bên dưới để mở trang chi tiết theo dõi tiến độ và giao việc
                </p>
              </div>

              {isManagerOrAdmin && (
                <button className="btn btn-primary" onClick={() => setShowCreateProjectModal(true)}>
                  Khởi Tạo Đề Tài Mới
                </button>
              )}
            </div>

            {/* Projects Grid */}
            <div>
              {projects.length === 0 ? (
                <div className="card" style={{ width: '100%', textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
                  Chưa có đề tài nào được khởi tạo hoặc phân công cho bạn.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                  {projects.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => navigate(`/project/${p.id}`)}
                      className="card"
                      style={{ 
                        padding: '1.5rem', 
                        backgroundColor: '#FFFFFF', 
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-lg)',
                        cursor: 'pointer',
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'all 0.25s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                        e.currentTarget.style.borderColor = 'var(--primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <h3 style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-main)', margin: 0, lineHeight: 1.4 }}>
                            {p.name}
                          </h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="badge badge-success" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>Hoạt Động</span>
                            {isManagerOrAdmin && (
                              <button 
                                type="button"
                                onClick={(e) => handleDeleteProject(e, p.id, p.name)}
                                style={{
                                  background: 'rgba(255, 77, 79, 0.1)',
                                  border: '1px solid rgba(255, 77, 79, 0.3)',
                                  color: 'var(--accent-pink)',
                                  borderRadius: 'var(--radius-sm)',
                                  padding: '0.2rem 0.5rem',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  fontWeight: 600
                                }}
                                title="Xóa đề tài này"
                              >
                                Xóa
                              </button>
                            )}
                          </div>
                        </div>

                        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '1.25rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}>
                          {p.description || 'Đề tài khoa học cấp Viện'}
                        </p>

                        <div style={{ backgroundColor: 'rgba(0,0,0,0.025)', padding: '0.8rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', fontSize: '0.88rem', border: '1px solid rgba(0,0,0,0.04)' }}>
                          <div style={{ marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Chủ nhiệm: </span>
                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{p.manager?.name || 'Chưa chỉ định'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Thành viên: </span>
                            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                              {p.members && p.members.length > 0 ? `${p.members.length} người tham gia` : 'Chưa có thành viên'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                          <span>Tiến độ hoàn thành:</span>
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{p.progress || 0}%</span>
                        </div>
                        <div className="progress-container" style={{ margin: '0 0 1.25rem 0', height: '8px' }}>
                          <div className="progress-bar" style={{ width: `${p.progress || 0}%`, backgroundColor: 'var(--primary)' }}></div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                          <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            Xem Chi Tiết & Giao Việc
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Create Project */}
      {showCreateProjectModal && (
        <div className="modal-overlay" onClick={() => setShowCreateProjectModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Khởi Tạo Đề Tài Nghiên Cứu Mới</div>
              <button type="button" className="modal-close-btn" onClick={() => setShowCreateProjectModal(false)}>Đóng</button>
            </div>

            <form onSubmit={handleCreateProject}>
              <div className="modal-body">
                <div className="input-group">
                  <label className="input-label">Tên đề tài / Dự án (*)</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="VD: Nghiên cứu ứng dụng AI trong Y dược..." 
                    value={newProjectName} 
                    onChange={(e) => setNewProjectName(e.target.value)} 
                    required 
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Mô tả tóm tắt mục tiêu đề tài</label>
                  <textarea 
                    className="textarea-field" 
                    rows={2} 
                    placeholder="Mục tiêu nghiên cứu, phạm vi ứng dụng..." 
                    value={newProjectDesc} 
                    onChange={(e) => setNewProjectDesc(e.target.value)} 
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Chủ nhiệm đề tài (*)</label>
                  <select 
                    className="select-field" 
                    value={newProjectManager} 
                    onChange={(e) => setNewProjectManager(e.target.value ? Number(e.target.value) : '')}
                    required
                  >
                    <option value="">-- Chọn Chủ nhiệm đề tài --</option>
                    {usersList.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Thành viên tham gia (Đồng bộ tài khoản DB)</label>
                  <div style={{ 
                    maxHeight: '140px', 
                    overflowY: 'auto', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 'var(--radius-md)', 
                    padding: '0.6rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.5)' 
                  }}>
                    {usersList.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Đang tải danh sách tài khoản...</div>
                    ) : (
                      usersList.map(u => {
                        const isChecked = newProjectMembers.includes(u.id);
                        return (
                          <label 
                            key={u.id} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '0.6rem', 
                              padding: '0.35rem 0', 
                              borderBottom: '1px solid rgba(0,0,0,0.05)',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              color: 'var(--text-main)'
                            }}
                          >
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewProjectMembers(prev => [...prev, u.id]);
                                } else {
                                  setNewProjectMembers(prev => prev.filter(id => id !== u.id));
                                }
                              }}
                              style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                            />
                            <span style={{ fontWeight: 600 }}>{u.name}</span>
                            <span className="badge badge-secondary" style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem' }}>{u.role}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({u.email})</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateProjectModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Tạo Đề Tài</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
