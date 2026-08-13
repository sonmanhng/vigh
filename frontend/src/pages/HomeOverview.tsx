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

  const { lowStock, upcomingDeadlines, incomingReports, pendingApprovals } = stats || {};

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#0f172a', marginBottom: '0.5rem' }}>
          Chào mừng, {user?.name}! 👋
        </h1>
        <p style={{ color: '#64748b' }}>Đây là tổng quan các hoạt động cần chú ý của bạn hôm nay.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        
        {/* Zone 1: Sắp hết hạn / Sắp hết hàng */}
        {(lowStock?.chemicals?.length > 0 || lowStock?.cells?.length > 0) && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderTop: '4px solid #ef4444' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <AlertCircle color="#ef4444" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Vật tư sắp hết</h2>
            </div>
            {lowStock?.chemicals?.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ color: '#475569', fontSize: '0.875rem' }}>Hoá chất:</strong>
                <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem', color: '#0f172a' }}>
                  {lowStock.chemicals.map((c: any) => (
                    <li key={c.id}>{c.name} (Còn {c.quantity} {c.unit})</li>
                  ))}
                </ul>
              </div>
            )}
            {lowStock?.cells?.length > 0 && (
              <div>
                <strong style={{ color: '#475569', fontSize: '0.875rem' }}>Tế bào:</strong>
                <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem', color: '#0f172a' }}>
                  {lowStock.cells.map((c: any) => (
                    <li key={c.id}>{c.name} (Còn {c.quantity} {c.unit})</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Zone 2: Deadline sắp đến */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderTop: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Clock color="#f59e0b" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Deadline sắp đến (14 ngày tới)</h2>
          </div>
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

        {/* Zone 3: Báo cáo mới nhận */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderTop: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <FileText color="#3b82f6" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Báo cáo tuần mới nhận</h2>
          </div>
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

        {/* Zone 4: Cần phê duyệt */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderTop: '4px solid #10b981' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <CheckCircle color="#10b981" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Cần phê duyệt</h2>
          </div>
          {(!pendingApprovals?.chemicalProposals?.length && !pendingApprovals?.cellProposals?.length && !pendingApprovals?.overtimes?.length && !pendingApprovals?.projects?.length) ? (
            <p style={{ color: '#64748b', margin: 0 }}>Không có mục nào cần bạn phê duyệt.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#0f172a' }}>
              {pendingApprovals.projects?.map((p: any) => (
                <li key={`p-${p.id}`} style={{ marginBottom: '0.5rem' }}>
                  Duyệt dự án: <strong>{p.name}</strong>
                </li>
              ))}
              {pendingApprovals.chemicalProposals?.map((p: any) => (
                <li key={`hc-${p.id}`} style={{ marginBottom: '0.5rem' }}>
                  Đề xuất hoá chất từ <strong>{p.creator?.name}</strong>
                </li>
              ))}
              {pendingApprovals.cellProposals?.map((p: any) => (
                <li key={`c-${p.id}`} style={{ marginBottom: '0.5rem' }}>
                  Đề xuất tế bào từ <strong>{p.creator?.name}</strong>
                </li>
              ))}
              {pendingApprovals.overtimes?.map((o: any) => (
                <li key={`o-${o.id}`} style={{ marginBottom: '0.5rem' }}>
                  Duyệt làm thêm giờ: <strong>{o.user?.name}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
};
