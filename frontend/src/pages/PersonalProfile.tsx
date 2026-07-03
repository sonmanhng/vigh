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
                <div style={{ padding: '4px', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', borderRadius: '50%', marginBottom: '1.25rem' }}>
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} style={{ width: '160px', height: '160px', borderRadius: '50%', objectFit: 'cover', border: '4px solid #fff', backgroundColor: '#fff' }} />
                  ) : (
                    <div style={{ width: '160px', height: '160px', borderRadius: '50%', backgroundColor: '#fff', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.5rem', fontWeight: 700, border: '4px solid #fff' }}>
                      {getInitials(user.name)}
                    </div>
                  )}
                </div>
                <span style={{ 
                  backgroundColor: 'rgba(0, 114, 229, 0.1)', 
                  color: 'var(--primary)', 
                  padding: '0.5rem 1rem', 
                  borderRadius: '20px', 
                  fontSize: '0.85rem', 
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase'
                }}>
                  {user.role}
                </span>
              </div>

              {/* Right Column: Info */}
              <div style={{ flexGrow: 1, minWidth: '300px' }}>
                <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1.5rem', lineHeight: 1.2 }}>
                  {user.name}
                </h1>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, max-content) 1fr', gap: '1rem 1.5rem', alignItems: 'center', fontSize: '0.95rem' }}>
                  {user.department && (
                    <>
                      <div style={{ color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg style={{width: '18px', height: '18px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        Đơn vị công tác
                      </div>
                      <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>{user.department}</div>
                    </>
                  )}
                  
                  {user.email && (
                    <>
                      <div style={{ color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg style={{width: '18px', height: '18px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        Email
                      </div>
                      <div>
                        <a href={`mailto:${user.email}`} style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'none' }} className="hover-underline">{user.email}</a>
                      </div>
                    </>
                  )}
                  
                  {user.phone && (
                    <>
                      <div style={{ color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg style={{width: '18px', height: '18px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        Số điện thoại
                      </div>
                      <div style={{ color: 'var(--text-main)', fontWeight: 500 }}>{user.phone}</div>
                    </>
                  )}
                  
                  {user.orcid && (
                    <>
                      <div style={{ color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <img src="https://orcid.org/assets/vectors/orcid.logo.icon.svg" alt="ORCID" style={{ width: '18px' }} />
                        Mã ORCID
                      </div>
                      <div>
                        <a href={`https://orcid.org/${user.orcid}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'none' }} className="hover-underline">{user.orcid}</a>
                      </div>
                    </>
                  )}
                  
                  {user.scholar && (
                    <>
                      <div style={{ color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg style={{ width: '18px', height: '18px' }} viewBox="0 0 24 24" fill="currentColor"><path d="M12 24a7 7 0 1 1 0-14 7 7 0 0 1 0 14zm0-24L0 9.5l4.838 3.94A8 8 0 0 1 12 9a8 8 0 0 1 7.162 4.44L24 9.5z" /></svg>
                        Google Scholar
                      </div>
                      <div>
                        <a href={`https://scholar.google.com/citations?user=${user.scholar}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'none' }} className="hover-underline">Xem hồ sơ Scholar</a>
                      </div>
                    </>
                  )}
                  
                  {user.affiliations && user.affiliations.length > 0 && (
                    <>
                      <div style={{ color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'flex-start', gap: '0.5rem', paddingTop: '4px' }}>
                        <svg style={{width: '18px', height: '18px', marginTop: '2px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                        Cơ quan liên kết
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {user.affiliations.map((aff: string, idx: number) => (
                          <span key={idx} style={{ 
                            backgroundColor: 'var(--bg-color)', 
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-main)', 
                            padding: '4px 10px', 
                            borderRadius: '6px', 
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
                    marginTop: '2.5rem', 
                    paddingTop: '2rem', 
                    borderTop: '1px solid var(--border-color)' 
                  }}>
                    {user.bio && (
                      <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <svg style={{width: '20px', height: '20px', color: 'var(--primary)'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
                          Lý Lịch Khoa Học / Giới Thiệu
                        </h3>
                        <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>{user.bio}</p>
                      </div>
                    )}
                    
                    {user.researchInterests && user.researchInterests.length > 0 && (
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <svg style={{width: '20px', height: '20px', color: 'var(--secondary)'}} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                          Hướng Nghiên Cứu Chính
                        </h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {user.researchInterests.map((interest: string, idx: number) => (
                            <span key={idx} style={{ 
                              backgroundColor: 'rgba(52, 199, 89, 0.1)', 
                              color: 'var(--accent-green)', 
                              padding: '0.5rem 1rem', 
                              borderRadius: '20px', 
                              fontSize: '0.85rem',
                              fontWeight: 600
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
