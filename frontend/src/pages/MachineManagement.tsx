import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Download, Plus, Search, Filter } from 'lucide-react';

interface Machine {
  id: number;
  code: string;
  name: string;
  category: string;
  department: string;
  characteristics: string;
  status: string;
}

interface MachineLog {
  id: number;
  machine: Machine;
  date: string;
  minutes: number;
  project?: { name: string; code: string };
  creator?: { name: string };
  createdAt: string;
}

interface Project {
  id: number;
  code: string;
  name: string;
}

interface MachineStat {
  machineId: number;
  machineCode: string;
  machineName: string;
  totalMinutes: number;
  percentUsage: number;
  projects: {
    projectId: number;
    projectName: string;
    minutes: number;
  }[];
}

type Tab = 'machines' | 'labor' | 'statistics' | 'history';

export const MachineManagement: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('machines');
  
  // Data
  const [machines, setMachines] = useState<Machine[]>([]);
  const [logs, setLogs] = useState<MachineLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<MachineStat[]>([]);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modals
  const [modal, setModal] = useState<'none' | 'import' | 'consume'>('none');
  
  // Forms
  const [importForm, setImportForm] = useState({
    code: '', name: '', category: '', department: 'Phòng Công nghệ Dược', characteristics: '', status: 'IN_USE'
  });
  
  const [consumeForm, setConsumeForm] = useState({
    machineId: '', date: new Date().toISOString().split('T')[0], minutes: '', projectId: ''
  });

  // Statistics filters
  const [statMonth, setStatMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [statType, setStatType] = useState<'machine' | 'labor'>('machine');

  const fetchMachines = useCallback(async () => {
    try {
      const res = await apiClient.get<Machine[]>('/machines');
      setMachines(res.data);
    } catch (e: any) {
      console.error(e);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await apiClient.get<MachineLog[]>('/machines/logs');
      setLogs(res.data);
    } catch (e: any) {
      console.error(e);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await apiClient.get<Project[]>('/projects');
      setProjects(res.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    if (statType !== 'machine') return;
    try {
      setLoading(true);
      const res = await apiClient.get<MachineStat[]>(`/machines/statistics?month=${statMonth}`);
      setStats(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statMonth, statType]);

  useEffect(() => {
    fetchMachines();
    fetchProjects();
  }, [fetchMachines, fetchProjects]);

  useEffect(() => { if (activeTab === 'history') fetchLogs(); }, [activeTab, fetchLogs]);
  useEffect(() => { if (activeTab === 'statistics') fetchStats(); }, [activeTab, fetchStats]);

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/machines', importForm);
      setModal('none');
      fetchMachines();
      setImportForm({ code: '', name: '', category: '', department: 'Phòng Công nghệ Dược', characteristics: '', status: 'IN_USE' });
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi nhập thiết bị');
    }
  };

  const handleConsumeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/machines/logs', {
        machineId: Number(consumeForm.machineId),
        date: consumeForm.date,
        minutes: Number(consumeForm.minutes),
        projectId: Number(consumeForm.projectId)
      });
      setModal('none');
      setConsumeForm({ machineId: '', date: new Date().toISOString().split('T')[0], minutes: '', projectId: '' });
      if (activeTab === 'history') fetchLogs();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi ghi nhận tiêu hao');
    }
  };

  return (
    <div className="content-area">
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
            Máy - Giờ công
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Quản lý tài sản máy móc và giờ công nhân sự</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {activeTab === 'machines' && (
            <>
              <button className="btn btn-secondary" onClick={() => setModal('consume')}>
                <Search size={18} /> Ghi tiêu hao
              </button>
              <button className="btn btn-primary" onClick={() => setModal('import')}>
                <Plus size={18} /> Nhập thiết bị
              </button>
            </>
          )}
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '2rem', borderBottom: '2px solid var(--border-color)', marginBottom: '2rem' }}>
        {[
          { id: 'machines', label: 'Quản lý Máy móc' },
          { id: 'labor', label: 'Nhân công' },
          { id: 'statistics', label: 'Thống kê' },
          { id: 'history', label: 'Lịch sử tiêu hao' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as Tab)}
            style={{
              padding: '0.75rem 0',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === t.id ? '3px solid var(--primary)' : '3px solid transparent',
              color: activeTab === t.id ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: '-2px'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: '#FFF1F0', color: '#CF1322', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #FFA39E' }}>
          {error}
        </div>
      )}

      {/* TAB: MACHINES */}
      {activeTab === 'machines' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '1rem' }}>Mã TS</th>
                  <th style={{ padding: '1rem' }}>Tên tài sản</th>
                  <th style={{ padding: '1rem' }}>Phân loại</th>
                  <th style={{ padding: '1rem' }}>Đơn vị sử dụng</th>
                  <th style={{ padding: '1rem' }}>Đặc điểm</th>
                  <th style={{ padding: '1rem' }}>Tình trạng</th>
                </tr>
              </thead>
              <tbody>
                {machines.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có thiết bị nào</td></tr>
                ) : machines.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem', fontWeight: 600 }}>{m.code}</td>
                    <td style={{ padding: '1rem', fontWeight: 700, color: 'var(--primary)' }}>{m.name}</td>
                    <td style={{ padding: '1rem' }}>{m.category || '—'}</td>
                    <td style={{ padding: '1rem' }}>{m.department}</td>
                    <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{m.characteristics || '—'}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        background: m.status === 'IN_USE' ? '#F6FFED' : '#F5F5F5', 
                        color: m.status === 'IN_USE' ? '#389E0D' : '#8C8C8C', 
                        border: `1px solid ${m.status === 'IN_USE' ? '#B7EB8F' : '#D9D9D9'}`, 
                        borderRadius: '20px', padding: '0.25rem 0.75rem', fontSize: '0.8rem', fontWeight: 600 
                      }}>
                        {m.status === 'IN_USE' ? 'Có sử dụng' : 'Không sử dụng'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: LABOR (PLACEHOLDER) */}
      {activeTab === 'labor' && (
        <div style={{ padding: '3rem', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
          <h3>Tính năng Quản lý Nhân công đang được phát triển</h3>
          <p>Phần này sẽ được cập nhật trong phiên bản tiếp theo.</p>
        </div>
      )}

      {/* TAB: STATISTICS */}
      {activeTab === 'statistics' && (
        <div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', background: '#fff', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Tháng thống kê</label>
              <input type="month" className="input-field" value={statMonth} onChange={e => setStatMonth(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Loại theo dõi</label>
              <select className="input-field" value={statType} onChange={e => setStatType(e.target.value as any)}>
                <option value="machine">Theo dõi máy móc</option>
                <option value="labor">Theo dõi nhân công</option>
              </select>
            </div>
          </div>

          {statType === 'labor' ? (
             <div style={{ padding: '3rem', textAlign: 'center', background: '#fff', borderRadius: '12px', color: 'var(--text-muted)' }}>
               Chưa có dữ liệu thống kê nhân công.
             </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
              {stats.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', background: '#fff', borderRadius: '8px' }}>
                  Không có dữ liệu sử dụng máy móc trong tháng này.
                </div>
              ) : stats.map(s => (
                <div key={s.machineId} className="card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>{s.machineName}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Mã TS: {s.machineCode}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '1.2rem', color: s.percentUsage > 80 ? '#CF1322' : 'var(--primary)' }}>
                        {s.percentUsage.toFixed(2)}%
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hiệu suất</div>
                    </div>
                  </div>
                  
                  <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-muted)' }}>PHÂN BỔ DỰ ÁN ({s.totalMinutes} phút)</div>
                    {s.projects.length === 0 ? (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Không xác định dự án</div>
                    ) : s.projects.map(p => (
                      <div key={p.projectId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.projectName}</span>
                        <span style={{ color: '#D46B08', fontWeight: 700 }}>{p.minutes} phút</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: HISTORY */}
      {activeTab === 'history' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '1rem' }}>Máy móc</th>
                  <th style={{ padding: '1rem' }}>Dự án</th>
                  <th style={{ padding: '1rem' }}>Ngày tiêu hao</th>
                  <th style={{ padding: '1rem' }}>Số phút</th>
                  <th style={{ padding: '1rem' }}>Người ghi nhận</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có lịch sử tiêu hao</td></tr>
                ) : logs.map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 600 }}>{l.machine?.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{l.machine?.code}</div>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--primary)' }}>{l.project?.name || '—'}</td>
                    <td style={{ padding: '1rem' }}>{new Date(l.date).toLocaleDateString('vi-VN')}</td>
                    <td style={{ padding: '1rem', fontWeight: 700, color: '#D46B08' }}>{l.minutes} phút</td>
                    <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{l.creator?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: NHẬP THIẾT BỊ */}
      {modal === 'import' && (
        <div className="modal-overlay" onClick={() => { setModal('none'); setError(null); }}>
          <div className="modal-content" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Nhập thiết bị mới</div>
              <button className="modal-close-btn" onClick={() => { setModal('none'); setError(null); }}>Đóng</button>
            </div>
            <form onSubmit={handleImportSubmit}>
              <div className="modal-body" style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="input-label">Mã tài sản (*)</label>
                    <input className="input-field" required placeholder="VD: M-001" value={importForm.code} onChange={e => setImportForm({...importForm, code: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Tên tài sản (*)</label>
                    <input className="input-field" required placeholder="VD: Máy ly tâm..." value={importForm.name} onChange={e => setImportForm({...importForm, name: e.target.value})} />
                  </div>
                </div>
                
                <div className="input-group">
                  <label className="input-label">Đơn vị sử dụng (*)</label>
                  <select className="input-field" required value={importForm.department} onChange={e => setImportForm({...importForm, department: e.target.value})}>
                    <option value="Phòng Công nghệ Dược">Phòng Công nghệ Dược</option>
                    <option value="Chung">Chung</option>
                    <option value="Phòng Thử nghiệm Sinh học">Phòng Thử nghiệm Sinh học</option>
                    <option value="Văn phòng Công ty">Văn phòng Công ty</option>
                    <option value="Phòng Tài nguyên và Công nghệ Sinh học">Phòng Tài nguyên và Công nghệ Sinh học</option>
                    <option value="Phòng Khoa học Công nghệ">Phòng Khoa học Công nghệ</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="input-label">Phân loại</label>
                    <input className="input-field" placeholder="VD: Thiết bị văn phòng..." value={importForm.category} onChange={e => setImportForm({...importForm, category: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Tình trạng</label>
                    <select className="input-field" value={importForm.status} onChange={e => setImportForm({...importForm, status: e.target.value})}>
                      <option value="IN_USE">Có sử dụng</option>
                      <option value="NOT_IN_USE">Không sử dụng</option>
                    </select>
                  </div>
                </div>

                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Đặc điểm</label>
                  <textarea className="input-field" style={{ minHeight: '60px', resize: 'vertical' }} placeholder="VD: Ghi chú tình trạng máy..." value={importForm.characteristics} onChange={e => setImportForm({...importForm, characteristics: e.target.value})} />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setModal('none'); setError(null); }}>Huỷ</button>
                <button type="submit" className="btn btn-primary">Lưu thiết bị</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TIÊU HAO */}
      {modal === 'consume' && (
        <div className="modal-overlay" onClick={() => { setModal('none'); setError(null); }}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Ghi nhận tiêu hao thiết bị</div>
              <button className="modal-close-btn" onClick={() => { setModal('none'); setError(null); }}>Đóng</button>
            </div>
            <form onSubmit={handleConsumeSubmit}>
              <div className="modal-body" style={{ display: 'grid', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Chọn máy móc (*)</label>
                  <select className="input-field" required value={consumeForm.machineId} onChange={e => setConsumeForm({...consumeForm, machineId: e.target.value})}>
                    <option value="">-- Chọn thiết bị --</option>
                    {machines.filter(m => m.status === 'IN_USE').map(m => (
                      <option key={m.id} value={m.id}>{m.code} - {m.name}</option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Dự án sử dụng (*)</label>
                  <select className="input-field" required value={consumeForm.projectId} onChange={e => setConsumeForm({...consumeForm, projectId: e.target.value})}>
                    <option value="">-- Chọn dự án --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.code ? `${p.code} - ${p.name}` : p.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Ngày tiêu hao (*)</label>
                    <input type="date" className="input-field" required value={consumeForm.date} onChange={e => setConsumeForm({...consumeForm, date: e.target.value})} />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Số phút (*)</label>
                    <input type="number" className="input-field" required min="1" placeholder="VD: 120" value={consumeForm.minutes} onChange={e => setConsumeForm({...consumeForm, minutes: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setModal('none'); setError(null); }}>Huỷ</button>
                <button type="submit" className="btn btn-primary">Ghi nhận</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
