import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { Navbar } from '../components/Navbar';

export const PersonalProfile: React.FC<{ userId?: string, onBack?: () => void }> = ({ userId, onBack }) => {
  const { id: paramId } = useParams<{ id: string }>();
  const id = userId || paramId;
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await apiClient.get(`/users/${id}`);
        setUser(response.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Không thể tải thông tin hồ sơ.');
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchUser();
  }, [id]);

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải thông tin hồ sơ...</div>;
  }

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/dashboard?tab=personnel');
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

  const contentArea = (
    <div className="content-area" style={{ padding: '1.5rem 2rem' }}>
      <button 
        className="btn btn-secondary btn-sm" 
        style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }} 
        onClick={handleBack}
      >
        <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        Quay lại
      </button>

      {error || !user ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2 style={{ color: 'var(--accent-red)', marginBottom: '1rem' }}>Lỗi Tải Dữ Liệu</h2>
          <p style={{ color: 'var(--text-muted)' }}>{error || 'Không tìm thấy hồ sơ người dùng.'}</p>
        </div>
      ) : (
        <>
          <div className="card" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', gap: '3rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* Left Column: Avatar & Role */}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '200px' }}>
                <div style={{ marginBottom: '1.25rem' }}>
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} style={{ width: '150px', height: '150px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)' }} />
                  ) : (
                    <div style={{ width: '150px', height: '150px', borderRadius: '50%', backgroundColor: 'var(--bg-color)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.5rem', fontWeight: 700, border: '3px solid var(--primary)' }}>
                      {getInitials(user.name)}
                    </div>
                  )}
                </div>
                <span style={{ 
                  backgroundColor: 'rgba(0, 150, 136, 0.1)', 
                  color: 'var(--primary)', 
                  padding: '0.4rem 1.25rem', 
                  borderRadius: '20px', 
                  fontSize: '0.9rem', 
                  fontWeight: 600,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase'
                }}>
                  {user.role}
                </span>
              </div>

              {/* Right Column: Info */}
              <div style={{ flexGrow: 1, minWidth: '300px' }}>
                <h1 style={{ fontSize: '2.25rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '1.5rem', lineHeight: 1.2 }}>
                  {user.name}
                </h1>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 160px) 1fr', gap: '1.25rem 1rem', alignItems: 'center', fontSize: '0.95rem' }}>
                  {user.department && (
                    <>
                      <div style={{ color: '#6b7280', fontWeight: 500 }}>
                        Đơn vị công tác:
                      </div>
                      <div style={{ color: '#1f2937', fontWeight: 500 }}>{user.department}</div>
                    </>
                  )}
                  
                  {user.email && (
                    <>
                      <div style={{ color: '#6b7280', fontWeight: 500 }}>
                        Email:
                      </div>
                      <div>
                        <a href={`mailto:${user.email}`} style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'underline' }}>{user.email}</a>
                      </div>
                    </>
                  )}
                  
                  {user.phone && (
                    <>
                      <div style={{ color: '#6b7280', fontWeight: 500 }}>
                        Số điện thoại:
                      </div>
                      <div style={{ color: '#1f2937', fontWeight: 500 }}>{user.phone}</div>
                    </>
                  )}
                  
                  {user.orcid && (
                    <>
                      <div style={{ color: '#6b7280', fontWeight: 500 }}>
                        Mã ORCID:
                      </div>
                      <div>
                        <a href={`https://orcid.org/${user.orcid}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'underline' }}>{user.orcid}</a>
                      </div>
                    </>
                  )}
                  
                  {user.scholar && (
                    <>
                      <div style={{ color: '#6b7280', fontWeight: 500 }}>
                        Google Scholar:
                      </div>
                      <div>
                        <a href={`https://scholar.google.com/citations?user=${user.scholar}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="currentColor"><path d="M12 24a7 7 0 1 1 0-14 7 7 0 0 1 0 14zm0-24L0 9.5l4.838 3.94A8 8 0 0 1 12 9a8 8 0 0 1 7.162 4.44L24 9.5z" /></svg>
                          {user.name}
                        </a>
                      </div>
                    </>
                  )}
                  
                  {user.affiliations && user.affiliations.length > 0 && (
                    <>
                      <div style={{ color: '#6b7280', fontWeight: 500, alignSelf: 'start', paddingTop: '4px' }}>
                        Cơ quan liên kết:
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {user.affiliations.map((aff: string, idx: number) => (
                          <span key={idx} style={{ 
                            backgroundColor: '#e0f2fe', 
                            color: '#0369a1', 
                            padding: '4px 12px', 
                            borderRadius: '16px', 
                            fontSize: '0.85rem',
                            fontWeight: 500
                          }}>
                            {aff}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {(user.bio || (user.researchInterests && user.researchInterests.length > 0)) && (
                  <div style={{ 
                    marginTop: '2rem', 
                    paddingTop: '2rem', 
                    borderTop: '1px solid #e5e7eb' 
                  }}>
                    {user.bio && (
                      <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#374151', marginBottom: '0.75rem' }}>
                          Lý Lịch Khoa Học / Giới Thiệu
                        </h3>
                        <p style={{ color: '#4b5563', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>{user.bio}</p>
                      </div>
                    )}
                    
                    {user.researchInterests && user.researchInterests.length > 0 && (
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#374151', marginBottom: '1rem' }}>
                          Hướng Nghiên Cứu Chính
                        </h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                          {user.researchInterests.map((interest: string, idx: number) => (
                            <span key={idx} style={{ 
                              backgroundColor: 'rgba(0, 150, 136, 0.1)', 
                              color: 'var(--primary)', 
                              padding: '0.5rem 1.25rem', 
                              borderRadius: '20px', 
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              textTransform: 'uppercase'
                            }}>
                              {interest}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '1rem' }}>Các Đề Tài / Dự Án Đang Tham Gia</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {user.projects && user.projects.map((p: any) => (
                <div key={p.id} className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--primary)', cursor: 'pointer' }} onClick={() => navigate(`/projects/${p.id}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <span className="badge badge-primary">Chủ nhiệm đề tài</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.code}</span>
                  </div>
                  <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 600, marginBottom: '0.5rem' }}>{p.name}</h3>
                  <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>{p.status}</span>
                </div>
              ))}

              {user.memberProjects && user.memberProjects.map((p: any) => (
                <div key={p.id} className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--secondary)', cursor: 'pointer' }} onClick={() => navigate(`/projects/${p.id}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <span className="badge badge-secondary">Thành viên đề tài</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.code}</span>
                  </div>
                  <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 600, marginBottom: '0.5rem' }}>{p.name}</h3>
                  <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>{p.status}</span>
                </div>
              ))}
              
              {(!user.projects || user.projects.length === 0) && (!user.memberProjects || user.memberProjects.length === 0) && (
                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', gridColumn: '1 / -1' }}>Cán bộ chưa tham gia đề tài nào.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );

  if (userId) {
    return contentArea;
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header" style={{ backgroundColor: '#FFFFFF', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'center', borderBottom: '1px solid var(--border-color)' }}>
          <img
            src="/logo.png"
            alt="Viện VIGH Logo"
            style={{ maxHeight: '54px', maxWidth: '100%', objectFit: 'contain', cursor: 'pointer' }}
            onClick={() => navigate('/dashboard')}
          />
        </div>

        <nav className="sidebar-menu">
          <button className="menu-item" onClick={() => navigate('/dashboard')}>
            <span>Tiến độ đề tài</span>
          </button>
          <button className="menu-item active" onClick={() => navigate('/dashboard?tab=personnel')}>
            <span>Quản lý nhân sự</span>
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
        {contentArea}
      </div>
    </div>
  );
};
