import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { Navbar } from '../components/Navbar';
import { PersonnelManagement } from './PersonnelManagement';
import { ChemicalManagement } from './ChemicalManagement';
import { CellManagement } from './CellManagement';
import { MachineManagement } from './MachineManagement';
import { WeeklyReports } from './WeeklyReports';
import { HomeOverview } from './HomeOverview';

type Tab = 'home' | 'projects' | 'personnel' | 'chemicals' | 'cells' | 'machines' | 'weekly-reports';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const activeTab = urlTab === 'personnel' ? 'personnel' : (urlTab === 'chemicals' ? 'chemicals' : (urlTab === 'cells' ? 'cells' : (urlTab === 'machines' ? 'machines' : (urlTab === 'weekly-reports' ? 'weekly-reports' : (urlTab === 'projects' ? 'projects' : 'home')))));
  
  const setActiveTab = (tab: Tab) => {
    if (tab === 'home') {
      setSearchParams({});
    } else {
      setSearchParams({ tab });
    }
  };
  
  // Projects State
  const [projects, setProjects] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [memberFilter, setMemberFilter] = useState<number | ''>('');
  
  // New Project State
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectTopicCode, setNewProjectTopicCode] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectManager, setNewProjectManager] = useState<number | ''>('');
  const [newProjectMembers, setNewProjectMembers] = useState<number[]>([]);
  const [newProjectApprover, setNewProjectApprover] = useState<number | ''>('');
  
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
        topicCode: newProjectTopicCode || null,
        description: newProjectDesc || 'Đề tài nghiên cứu Viện VIGH',
        managerId: newProjectManager ? Number(newProjectManager) : user?.id,
        memberIds: newProjectMembers,
        approverId: newProjectApprover ? Number(newProjectApprover) : null
      });
      setShowCreateProjectModal(false);
      setNewProjectName('');
      setNewProjectTopicCode('');
      setNewProjectDesc('');
      setNewProjectManager('');
      setNewProjectMembers([]);
      setNewProjectApprover('');
      await fetchProjects();
      navigate(`/project/${res.data.id}`);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không có quyền tạo đề tài mới');
    }
  };

  const handleApproveProject = async (e: React.MouseEvent, projectId: number, action: 'APPROVE' | 'REJECT') => {
    e.stopPropagation();
    if (!window.confirm(`Bạn có chắc chắn muốn ${action === 'APPROVE' ? 'Duyệt' : 'Từ chối'} đề tài này?`)) return;
    try {
      await apiClient.put(`/projects/${projectId}/approve`, { action });
      await fetchProjects();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi duyệt đề tài');
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


  const renderProjectCard = (p: any) => (
    <div 
      key={p.id} 
      onClick={() => navigate(`/project/${p.id}`)}
      className="card"
      style={{ 
        padding: '1rem', 
        backgroundColor: '#FFFFFF', 
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-sm)',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem', marginBottom: '0.5rem' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)', margin: 0, lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
            {(p.topicCode || p.code) && (
              <span style={{ fontSize: '0.7rem', backgroundColor: 'var(--primary)', color: '#fff', padding: '0.1rem 0.3rem', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
                {[p.topicCode, p.code].filter(Boolean).join(' - ')}
              </span>
            )}
            <span>{p.name}</span>
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            {p.approvalStatus === 'PENDING' ? (
              <span className="badge" style={{ backgroundColor: '#f59e0b', color: '#fff', fontSize: '0.65rem', whiteSpace: 'nowrap', padding: '0.1rem 0.3rem' }}>Chờ Duyệt</span>
            ) : p.approvalStatus === 'REJECTED' ? (
              <span className="badge badge-danger" style={{ fontSize: '0.65rem', whiteSpace: 'nowrap', padding: '0.1rem 0.3rem' }}>Từ chối</span>
            ) : (
              <span className="badge badge-success" style={{ fontSize: '0.65rem', whiteSpace: 'nowrap', padding: '0.1rem 0.3rem' }}>Hoạt Động</span>
            )}
            
            {p.approvalStatus === 'PENDING' && (user?.id === p.approverId || user?.role === 'SuperAdmin') && (
              <>
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleApproveProject(e, p.id, 'APPROVE'); }}
                  style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', borderRadius: '4px', padding: '0.1rem 0.3rem', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  Duyệt
                </button>
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleApproveProject(e, p.id, 'REJECT'); }}
                  style={{ background: 'rgba(255, 77, 79, 0.1)', border: '1px solid rgba(255, 77, 79, 0.3)', color: 'var(--accent-pink)', borderRadius: '4px', padding: '0.1rem 0.3rem', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  Từ chối
                </button>
              </>
            )}
            {isManagerOrAdmin && (
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDeleteProject(e, p.id, p.name); }}
                style={{ background: 'rgba(255, 77, 79, 0.1)', border: '1px solid rgba(255, 77, 79, 0.3)', color: 'var(--accent-pink)', borderRadius: '4px', padding: '0.1rem 0.3rem', fontSize: '0.65rem', cursor: 'pointer', fontWeight: 600 }}
              >
                Xóa
              </button>
            )}
          </div>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.6rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
          {p.description || 'Đề tài khoa học cấp Viện'}
        </p>

        <div style={{ backgroundColor: 'rgba(0,0,0,0.02)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.6rem', fontSize: '0.75rem', border: '1px solid rgba(0,0,0,0.03)' }}>
          <div style={{ marginBottom: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Chủ nhiệm: </span>
            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{p.manager?.name || 'Chưa chỉ định'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Thành viên: </span>
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
              {p.members && p.members.length > 0 ? `${p.members.length} người` : 'Chưa có'}
            </span>
          </div>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
          <span>Tiến độ:</span>
          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{p.progress || 0}%</span>
        </div>
        <div className="progress-container" style={{ margin: '0', height: '5px' }}>
          <div className="progress-bar" style={{ width: `${p.progress || 0}%`, backgroundColor: 'var(--primary)' }}></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-container">
      {/* Left Sidebar Menu */}
      <aside className="sidebar">
        <div className="sidebar-header" style={{ backgroundColor: '#FFFFFF', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'center', borderBottom: '1px solid var(--border-color)' }}>
          <img 
            src="/logo.png" 
            alt="Viện VIGH Logo" 
            style={{ maxHeight: '54px', maxWidth: '100%', objectFit: 'contain', cursor: 'pointer' }} 
            onClick={() => setActiveTab('home')}
          />
        </div>

        <nav className="sidebar-menu">
          <button 
            className={`menu-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            <span>Trang chủ</span>
          </button>

          <button 
            className={`menu-item ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => setActiveTab('projects')}
          >
            <span>Tiến độ đề tài</span>
          </button>

          <button 
            className={`menu-item ${activeTab === 'weekly-reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('weekly-reports')}
          >
            <span>Báo cáo tuần</span>
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
            <span>Quản lý hoá chất</span>
          </button>

          <button 
            className={`menu-item ${activeTab === 'cells' ? 'active' : ''}`}
            onClick={() => setActiveTab('cells')}
          >
            <span>Quản lý tế bào</span>
          </button>

          <button 
            className={`menu-item ${activeTab === 'machines' ? 'active' : ''}`}
            onClick={() => setActiveTab('machines')}
          >
            <span>Máy - Giờ công</span>
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
        ) : activeTab === 'cells' ? (
          <CellManagement />
        ) : activeTab === 'machines' ? (
          <MachineManagement />
        ) : activeTab === 'weekly-reports' ? (
          <WeeklyReports />
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

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <select 
                  className="input-field" 
                  value={memberFilter} 
                  onChange={(e) => setMemberFilter(e.target.value ? Number(e.target.value) : '')}
                  style={{ minWidth: '200px', margin: 0, padding: '0.4rem 0.75rem' }}
                >
                  <option value="">-- Tất cả thành viên --</option>
                  {usersList.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>

                <button className="btn btn-primary" onClick={() => setShowCreateProjectModal(true)}>
                  Khởi Tạo Đề Tài Mới
                </button>
              </div>
            </div>

            {/* Projects Grid */}
            <div>
              {projects.length === 0 ? (
                <div className="card" style={{ width: '100%', textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)' }}>
                  Chưa có đề tài nào được khởi tạo hoặc phân công cho bạn.
                </div>
              ) : (

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
                  {['Phòng Khoa học Công nghệ', 'Phòng Sinh học', 'Phòng Công nghệ Dược'].map(dept => {
                    const displayProjects = memberFilter === '' 
                      ? projects 
                      : projects.filter(p => p.manager?.id === memberFilter || p.members?.some((m: any) => m.id === memberFilter) || p.creator?.id === memberFilter);
                    const deptProjects = displayProjects.filter(p => p.manager?.department === dept);
                    return (
                      <div key={dept} style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', minHeight: '500px' }}>
                        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--primary)', color: 'var(--text-main)', textTransform: 'uppercase' }}>
                          {dept} <span style={{ backgroundColor: 'var(--primary)', color: '#fff', padding: '0.1rem 0.4rem', borderRadius: '12px', fontSize: '0.75rem', marginLeft: '0.3rem' }}>{deptProjects.length}</span>
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                           {deptProjects.map(renderProjectCard)}
                           {deptProjects.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' }}>Chưa có đề tài</div>}
                        </div>
                      </div>
                    )
                  })}
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
                    <label className="input-label">Mã đề tài / Mã số dự án</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="VD: ĐT-2026-01 hoặc DA-2026-005" 
                      value={newProjectTopicCode} 
                      onChange={(e) => setNewProjectTopicCode(e.target.value)} 
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
                  <label className="input-label">Người duyệt tạo đề tài (*)</label>
                  <select 
                    className="select-field" 
                    value={newProjectApprover} 
                    onChange={(e) => setNewProjectApprover(e.target.value ? Number(e.target.value) : '')}
                    required
                  >
                    <option value="">-- Chọn Người duyệt --</option>
                    {usersList.filter(u => ['TruongPhong', 'VienPho', 'VienTruong', 'ADMIN', 'MANAGER', 'SuperAdmin'].includes(u.role)).map(u => (
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
