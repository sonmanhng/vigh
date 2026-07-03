import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';

export const PersonalProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
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

    fetchUser();
  }, [id]);

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải thông tin hồ sơ...</div>;
  }

  if (error || !user) {
    return (
      <div className="content-area">
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h2 style={{ color: 'var(--accent-red)', marginBottom: '1rem' }}>Lỗi Tải Dữ Liệu</h2>
          <p style={{ color: 'var(--text-muted)' }}>{error || 'Không tìm thấy hồ sơ người dùng.'}</p>
          <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => navigate('/dashboard')}>
            Quay lại Bảng Điều Khiển
          </button>
        </div>
      </div>
    );
  }

  const getInitials = (n?: string) => {
    if (!n) return 'V';
    const parts = n.trim().split(' ');
    if (parts.length > 1) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return n.charAt(0).toUpperCase();
  };

  return (
    <div className="content-area">
      <button className="btn btn-secondary btn-sm" style={{ marginBottom: '1.5rem' }} onClick={() => navigate('/dashboard')}>
        ← Quay lại Bảng Điều Khiển
      </button>

      <div className="card" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0, textAlign: 'center' }}>
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} style={{ width: '150px', height: '150px', borderRadius: '50%', objectFit: 'cover', border: '4px solid var(--primary-light)' }} />
          ) : (
            <div style={{ width: '150px', height: '150px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', fontWeight: 700, margin: '0 auto' }}>
              {getInitials(user.name)}
            </div>
          )}
          <div style={{ marginTop: '1rem' }}>
            <span className="badge badge-primary" style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>{user.role}</span>
          </div>
        </div>

        <div style={{ flexGrow: 1 }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem' }}>{user.name}</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
            {user.department && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', fontWeight: 500 }}>
                <span style={{ color: 'var(--text-muted)', width: '120px' }}>Đơn vị công tác:</span>
                {user.department}
              </div>
            )}
            {user.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', fontWeight: 500 }}>
                <span style={{ color: 'var(--text-muted)', width: '120px' }}>Email:</span>
                <a href={`mailto:${user.email}`} style={{ color: 'var(--primary)' }}>{user.email}</a>
              </div>
            )}
            {user.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', fontWeight: 500 }}>
                <span style={{ color: 'var(--text-muted)', width: '120px' }}>Số điện thoại:</span>
                {user.phone}
              </div>
            )}
            {user.orcid && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', fontWeight: 500 }}>
                <span style={{ color: 'var(--text-muted)', width: '120px' }}>Mã ORCID:</span>
                <a href={`https://orcid.org/${user.orcid}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <img src="https://orcid.org/assets/vectors/orcid.logo.icon.svg" alt="ORCID iD icon" style={{ width: '16px' }} />
                  {user.orcid}
                </a>
              </div>
            )}
            {user.scholar && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', fontWeight: 500 }}>
                <span style={{ color: 'var(--text-muted)', width: '120px' }}>Google Scholar:</span>
                <a href={`https://scholar.google.com/citations?user=${user.scholar}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <svg style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 24a7 7 0 1 1 0-14 7 7 0 0 1 0 14zm0-24L0 9.5l4.838 3.94A8 8 0 0 1 12 9a8 8 0 0 1 7.162 4.44L24 9.5z" />
                  </svg>
                  Trang Học Giả
                </a>
              </div>
            )}
            {user.affiliations && user.affiliations.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: 'var(--text-main)', fontWeight: 500 }}>
                <span style={{ color: 'var(--text-muted)', width: '120px' }}>Cơ quan liên kết:</span>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {user.affiliations.map((aff: string, idx: number) => (
                    <span key={idx} style={{ backgroundColor: 'rgba(0, 114, 229, 0.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.85rem' }}>
                      {aff}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(user.bio || (user.researchInterests && user.researchInterests.length > 0)) && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
              {user.bio && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Lý Lịch Khoa Học / Giới Thiệu</h3>
                  <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{user.bio}</p>
                </div>
              )}
              
              {user.researchInterests && user.researchInterests.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Hướng Nghiên Cứu Chính</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {user.researchInterests.map((interest: string, idx: number) => (
                      <span key={idx} className="badge badge-success" style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
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
    </div>
  );
};
