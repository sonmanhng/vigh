import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { AlertCircle, Clock, FileText, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const HomeOverview: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await apiClient.get('/home/stats');
        setStats(res.data);
      } catch (err) {
        console.error('Error fetching home stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Đang tải dữ liệu...</div>;
  }

  const { lowStock, upcomingDeadlines, incomingReports, pendingApprovals, upcomingMeetings } = stats || {};

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#0f172a', marginBottom: '0.5rem' }}>
          Chào mừng, {user?.name}!
        </h1>
        <p style={{ color: '#64748b' }}>Đây là tổng quan các hoạt động cần chú ý của bạn hôm nay.</p>
      </div>

      <div className="home-dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>

        {/* Khu vực 1: Sắp hết */}
        {(lowStock?.chemicals?.length > 0 || lowStock?.cells?.length > 0 || lowStock?.stationeries?.length > 0) && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderTop: '4px solid #ef4444', maxHeight: '400px', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
              <AlertTriangle size={20} /> Vật tư / Hoá chất / VPP sắp hết
            </h3>
            <div style={{ overflowY: 'auto', flexGrow: 1, paddingRight: '0.5rem' }}>
              {lowStock?.chemicals?.map((c: any) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: '6px', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#991b1b' }}>{c.name}</div>
                    <div style={{ fontSize: '0.85rem', color: '#b91c1c' }}>Mã: {c.code}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#ef4444' }}>{c.quantity} {c.unit}</div>
                    <div style={{ fontSize: '0.85rem', color: '#dc2626' }}>Ngưỡng: {c.alertThreshold}</div>
                  </div>
                </div>
              ))}
              {lowStock?.cells?.map((c: any) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: '6px', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#991b1b' }}>{c.name}</div>
                    <div style={{ fontSize: '0.85rem', color: '#b91c1c' }}>Mã: {c.code}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#ef4444' }}>{c.quantity} tubes</div>
                    <div style={{ fontSize: '0.85rem', color: '#dc2626' }}>Ngưỡng: {c.maxQuantity * c.alertThreshold / 100}</div>
                  </div>
                </div>
              ))}
              {lowStock?.stationeries?.map((c: any) => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', backgroundColor: '#fef2f2', borderRadius: '6px', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#991b1b' }}>{c.name}</div>
                    <div style={{ fontSize: '0.85rem', color: '#b91c1c' }}>Mã: {c.code}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#ef4444' }}>{c.quantity} {c.unit}</div>
                    <div style={{ fontSize: '0.85rem', color: '#dc2626' }}>Ngưỡng: {c.alertThreshold}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Zone 2: Cuộc họp sắp tới */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderTop: '4px solid #8b5cf6', display: 'flex', flexDirection: 'column', maxHeight: '400px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexShrink: 0 }}>
            <Clock color="#8b5cf6" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Cuộc họp sắp tới</h2>
          </div>
          <div style={{ overflowY: 'auto', flexGrow: 1, paddingRight: '0.5rem' }}>
            {upcomingMeetings?.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#0f172a' }}>
                {upcomingMeetings.map((m: any) => (
                  <li key={m.id} style={{ marginBottom: '0.5rem' }}>
                    <strong>{m.title}</strong>
                    <br />
                    <span style={{ fontSize: '0.875rem', color: '#8b5cf6' }}>
                      {new Date(m.date).toLocaleDateString('vi-VN')} - {new Date(m.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: '#64748b', margin: 0 }}>Không có cuộc họp nào sắp tới.</p>
            )}
          </div>
        </div>

        {/* Zone 3: Deadline sắp đến */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderTop: '4px solid #f59e0b', display: 'flex', flexDirection: 'column', maxHeight: '400px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexShrink: 0 }}>
            <Clock color="#f59e0b" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Deadline sắp đến (14 ngày tới)</h2>
          </div>
          <div style={{ overflowY: 'auto', flexGrow: 1, paddingRight: '0.5rem' }}>
            {upcomingDeadlines?.projects?.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#0f172a' }}>
                {upcomingDeadlines.projects.map((p: any) => (
                  <li key={p.id} style={{ marginBottom: '0.5rem' }}>
                    <a href={`/project/${p.id}`} style={{ color: '#0284c7', textDecoration: 'none' }}>{p.name}</a>
                    <br />
                    <span style={{ fontSize: '0.875rem', color: '#ef4444' }}>Hạn: {new Date(p.endDate).toLocaleDateString('vi-VN')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: '#64748b', margin: 0 }}>Không có deadline nào sắp tới.</p>
            )}
          </div>
        </div>

        {/* Zone 3: Báo cáo mới nhận */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderTop: '4px solid #3b82f6', display: 'flex', flexDirection: 'column', maxHeight: '400px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexShrink: 0 }}>
            <FileText color="#3b82f6" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Báo cáo tuần mới nhận</h2>
          </div>
          <div style={{ overflowY: 'auto', flexGrow: 1, paddingRight: '0.5rem' }}>
            {incomingReports?.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#0f172a' }}>
                {incomingReports.map((r: any) => (
                  <li key={r.id} style={{ marginBottom: '0.5rem' }}>
                    <strong>{r.reporter?.name}</strong> đã gửi báo cáo tuần
                    <br />
                    <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Ngày gửi: {new Date(r.createdAt).toLocaleDateString('vi-VN')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: '#64748b', margin: 0 }}>Chưa có báo cáo mới.</p>
            )}
          </div>
        </div>

        {/* Zone 4: Cần phê duyệt */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderTop: '4px solid #10b981', display: 'flex', flexDirection: 'column', maxHeight: '400px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexShrink: 0 }}>
            <CheckCircle color="#10b981" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Cần phê duyệt</h2>
          </div>
          <div style={{ overflowY: 'auto', flexGrow: 1, paddingRight: '0.5rem' }}>
            {(!pendingApprovals?.chemicalProposals?.length && !pendingApprovals?.cellProposals?.length && !pendingApprovals?.stationeryProposals?.length && !pendingApprovals?.overtimes?.length && !pendingApprovals?.projects?.length) ? (
              <p style={{ color: '#64748b', margin: 0 }}>Không có mục nào cần bạn phê duyệt.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#0f172a' }}>
                {pendingApprovals?.projects?.map((p: any) => (
                  <li key={`p-${p.id}`} style={{ marginBottom: '0.5rem' }}>
                    Duyệt dự án: <strong>{p.name}</strong>
                  </li>
                ))}
                {pendingApprovals?.chemicalProposals?.map((p: any) => (
                  <li key={`hc-${p.id}`} style={{ marginBottom: '0.5rem' }}>
                    Đề xuất hoá chất từ <strong>{p.creator?.name}</strong>
                  </li>
                ))}
                {pendingApprovals?.cellProposals?.map((p: any) => (
                  <div key={`cell_${p.id}`} className="home-list-item">
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <div style={{ padding: '0.5rem', backgroundColor: '#fef3c7', borderRadius: '50%', color: '#d97706' }}>
                        <CheckCircle size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#334155' }}>Duyệt Đề xuất Tế bào #{p.id}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Từ: {p.creator?.name}</div>
                      </div>
                    </div>
                    <button className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }} onClick={() => navigate('/?tab=cells')}>Xem</button>
                  </div>
                ))}
                {pendingApprovals?.stationeryProposals?.map((p: any) => (
                  <div key={`vpp_${p.id}`} className="home-list-item">
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <div style={{ padding: '0.5rem', backgroundColor: '#fef3c7', borderRadius: '50%', color: '#d97706' }}>
                        <CheckCircle size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#334155' }}>Duyệt Đề xuất VPP #{p.id}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Từ: {p.creator?.name}</div>
                      </div>
                    </div>
                    <button className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }} onClick={() => navigate('/?tab=stationeries')}>Xem</button>
                  </div>
                ))}
                {pendingApprovals?.overtimes?.map((o: any) => (
                  <li key={`o-${o.id}`} style={{ marginBottom: '0.5rem' }}>
                    Duyệt làm thêm giờ: <strong>{o.user?.name}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
