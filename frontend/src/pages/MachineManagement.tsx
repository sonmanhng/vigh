import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Download, Plus, Search, Filter, Edit, Trash2 } from 'lucide-react';

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


interface LaborLog {
  id: number;
  date: string;
  adminHours: number;
  proHours: number;
  cleanHours: number;
  project?: { name: string; code: string };
  createdAt: string;
}

interface LaborStat {
  adminPercent: number;
  proPercent: number;
  cleanPercent: number;
  totalHours: number;
  loggedDays: number;
  maxExpectedHours: number;
}

interface LaborStatsResponse {
  daily: LaborStat;
  weekly: LaborStat;
  monthly: LaborStat;
  projects: { projectId: number; projectName: string; projectCode: string; totalHours: number; percent: number }[];
}

interface AdminLaborStat {
  userId: number;
  userName: string;
  department: string;
  loggedDays: number;
  adminPercent: number;
  proPercent: number;
  cleanPercent: number;
  projects: { projectId: number; projectName: string; projectCode: string; totalHours: number; percent: number }[];
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
  const [laborLogs, setLaborLogs] = useState<LaborLog[]>([]);
  const [laborStats, setLaborStats] = useState<LaborStatsResponse | null>(null);
  const [adminLaborStats, setAdminLaborStats] = useState<AdminLaborStat[]>([]);
  
  const [laborForm, setLaborForm] = useState({
    date: new Date().toISOString().split('T')[0],
    projectId: '',
    adminHours: '',
    proHours: '',
    cleanHours: ''
  });
  
  const [laborMonth, setLaborMonth] = useState(new Date().toISOString().substring(0, 7));
  const [laborViewMode, setLaborViewMode] = useState<'task' | 'project'>('task');

  
  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [modal, setModal] = useState<'none' | 'import' | 'edit' | 'consume' | 'labor'>('none');
  const [editingId, setEditingId] = useState<number | null>(null);
  
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


  const fetchLaborLogs = useCallback(async () => {
    try {
      const res = await apiClient.get<LaborLog[]>('/labor/my-logs');
      setLaborLogs(res.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchLaborStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<LaborStatsResponse>('/labor/my-statistics');
      setLaborStats(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAdminLaborStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<AdminLaborStat[]>('/labor/admin-statistics?month=' + laborMonth);
      setAdminLaborStats(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [laborMonth]);

  const fetchStats = useCallback(async () => {
    if (statType === 'labor') { fetchAdminLaborStats(); return; }
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
  useEffect(() => { if (activeTab === 'labor') { fetchLaborLogs(); fetchLaborStats(); } }, [activeTab, fetchLaborLogs, fetchLaborStats]);


  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modal === 'edit' && editingId) {
        await apiClient.put(`/machines/${editingId}`, importForm);
      } else {
        await apiClient.post('/machines', importForm);
      }
      setModal('none');
      setEditingId(null);
      fetchMachines();
      setImportForm({ code: '', name: '', category: '', department: 'Phòng Công nghệ Dược', characteristics: '', status: 'IN_USE' });
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi lưu thiết bị');
    }
  };

  const handleEdit = (m: Machine) => {
    setImportForm({
      code: m.code,
      name: m.name,
      category: m.category || '',
      department: m.department,
      characteristics: m.characteristics || '',
      status: m.status
    });
    setEditingId(m.id);
    setModal('edit');
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xoá thiết bị này?')) return;
    try {
      await apiClient.delete(`/machines/${id}`);
      fetchMachines();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi xoá thiết bị');
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


  const handleLaborSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/labor', laborForm);
      setModal('none');
      setLaborForm({ date: new Date().toISOString().split('T')[0], projectId: '', adminHours: '', proHours: '', cleanHours: '' });
      fetchLaborLogs();
      fetchLaborStats();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi thêm giờ công');
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
          
          {activeTab === 'labor' && (
            <button className="btn btn-primary" onClick={() => setModal('labor')}>
              <Plus size={18} /> Thêm giờ công
            </button>
          )}
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
                  <th style={{ padding: '1rem', width: '100px', textAlign: 'center' }}>Thao tác</th>
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
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(m)} title="Sửa thông tin">
                          Sửa
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m.id)} title="Xóa thiết bị">
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: LABOR */}
      {activeTab === 'labor' && (
        <div style={{ display: 'grid', gap: '2rem' }}>
          {/* STATS */}
          {laborStats && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="card">
                <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem', textTransform: 'uppercase' }}>Hôm nay</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>Hành chính:</span>
                    <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{laborStats.daily.adminPercent.toFixed(1)}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>Chuyên môn:</span>
                    <span style={{ color: '#096dd9', fontWeight: 700 }}>{laborStats.daily.proPercent.toFixed(1)}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>Dọn dẹp:</span>
                    <span style={{ color: '#d46b08', fontWeight: 700 }}>{laborStats.daily.cleanPercent.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
              <div className="card">
                <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem', textTransform: 'uppercase' }}>Tuần này</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>Hành chính:</span>
                    <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{laborStats.weekly.adminPercent.toFixed(1)}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>Chuyên môn:</span>
                    <span style={{ color: '#096dd9', fontWeight: 700 }}>{laborStats.weekly.proPercent.toFixed(1)}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>Dọn dẹp:</span>
                    <span style={{ color: '#d46b08', fontWeight: 700 }}>{laborStats.weekly.cleanPercent.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
              <div className="card">
                <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem', textTransform: 'uppercase' }}>Tháng này (Theo dự án)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '100px', overflowY: 'auto' }}>
                  {laborStats.projects.length === 0 && <div style={{ color: 'var(--text-muted)' }}>Chưa có dữ liệu</div>}
                  {laborStats.projects.map(p => (
                    <div key={p.projectId} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600 }} title={p.projectName}>{p.projectCode || p.projectName}:</span>
                      <span style={{ color: '#389e0d', fontWeight: 700 }}>{p.percent.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* LIST */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', fontWeight: 700, fontSize: '1.1rem' }}>
              Lịch sử ghi nhận giờ công
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '1rem' }}>Ngày</th>
                    <th style={{ padding: '1rem' }}>Dự án</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Hành chính (H)</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Chuyên môn (H)</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Dọn dẹp (H)</th>
                  </tr>
                </thead>
                <tbody>
                  {laborLogs.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có ghi nhận nào</td></tr>
                  ) : laborLogs.map(l => (
                    <tr key={l.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{new Date(l.date).toLocaleDateString('vi-VN')}</td>
                      <td style={{ padding: '1rem', color: 'var(--primary)', fontWeight: 600 }}>{l.project?.name || '—'}</td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>{l.adminHours}</td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>{l.proHours}</td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>{l.cleanHours}</td>
                    </tr>
                  ))}

                  {statType === 'labor' && adminLaborStats.map(s => (
                    <tr key={s.userId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--primary)' }}>{s.userName}</td>
                      <td style={{ padding: '1rem' }}>{s.department || '—'}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700 }}>{s.loggedDays}</td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>{s.adminPercent.toFixed(1)}%</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: '#096dd9' }}>{s.proPercent.toFixed(1)}%</td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: '#d46b08' }}>{s.cleanPercent.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
            {statType === 'labor' && (
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Chế độ xem</label>
                <select className="input-field" value={laborViewMode} onChange={e => setLaborViewMode(e.target.value as any)}>
                  <option value="task">Theo công việc (Hành chính/Chuyên môn...)</option>
                  <option value="project">Theo Dự án tham gia</option>
                </select>
              </div>
            )}
          </div>

          {statType === 'labor' ? (
            laborViewMode === 'task' ? (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                        <th style={{ padding: '1rem' }}>Nhân sự</th>
                        <th style={{ padding: '1rem' }}>Phòng ban</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>Số ngày làm</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>Hành chính (%)</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>Chuyên môn (%)</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>Dọn dẹp (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminLaborStats.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Không có dữ liệu trong tháng này</td></tr>
                      ) : adminLaborStats.map(s => (
                        <tr key={s.userId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--primary)' }}>{s.userName}</td>
                          <td style={{ padding: '1rem' }}>{s.department || '—'}</td>
                          <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700 }}>{s.loggedDays}</td>
                          <td style={{ padding: '1rem', textAlign: 'right' }}>{s.adminPercent.toFixed(1)}%</td>
                          <td style={{ padding: '1rem', textAlign: 'right', color: '#096dd9' }}>{s.proPercent.toFixed(1)}%</td>
                          <td style={{ padding: '1rem', textAlign: 'right', color: '#d46b08' }}>{s.cleanPercent.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                {adminLaborStats.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', background: '#fff', borderRadius: '8px' }}>
                    Không có dữ liệu trong tháng này.
                  </div>
                ) : adminLaborStats.map(s => (
                  <div key={s.userId} className="card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>{s.userName}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{s.department || '—'}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--primary)' }}>
                          {s.loggedDays} ngày
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Có ghi nhận</div>
                      </div>
                    </div>
                    
                    <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-muted)' }}>PHÂN BỔ DỰ ÁN TRONG THÁNG</div>
                      {!s.projects || s.projects.length === 0 ? (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Không có dự án nào</div>
                      ) : s.projects.map(p => (
                        <div key={p.projectId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }} title={p.projectName}>{p.projectCode || p.projectName}</span>
                          <span style={{ color: '#389e0d', fontWeight: 700 }}>{p.percent.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
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

      {/* MODAL: NHẬP THIẾT BỊ / SỬA THIẾT BỊ */}
      {(modal === 'import' || modal === 'edit') && (
        <div className="modal-overlay" onClick={() => { setModal('none'); setError(null); setEditingId(null); }}>
          <div className="modal-content" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{modal === 'edit' ? 'Cập nhật thiết bị' : 'Nhập thiết bị mới'}</div>
              <button className="modal-close-btn" onClick={() => { setModal('none'); setError(null); setEditingId(null); }}>Đóng</button>
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
                <button type="button" className="btn btn-secondary" onClick={() => { setModal('none'); setError(null); setEditingId(null); }}>Huỷ</button>
                <button type="submit" className="btn btn-primary">{modal === 'edit' ? 'Lưu cập nhật' : 'Lưu thiết bị'}</button>
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

      {/* MODAL: NHÂN CÔNG */}
      {modal === 'labor' && (
        <div className="modal-overlay" onClick={() => { setModal('none'); setError(null); }}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Khai báo Giờ công</div>
              <button className="modal-close-btn" onClick={() => { setModal('none'); setError(null); }}>Đóng</button>
            </div>
            <form onSubmit={handleLaborSubmit}>
              <div className="modal-body" style={{ display: 'grid', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Ngày ghi nhận (*)</label>
                  <input type="date" className="input-field" required value={laborForm.date} onChange={e => setLaborForm({...laborForm, date: e.target.value})} />
                </div>

                <div className="input-group">
                  <label className="input-label">Dự án thực hiện (*)</label>
                  <select className="input-field" required value={laborForm.projectId} onChange={e => setLaborForm({...laborForm, projectId: e.target.value})}>
                    <option value="">-- Chọn dự án --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.code ? `${p.code} - ${p.name}` : p.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Hành chính (H)</label>
                    <input type="number" step="0.5" min="0" max="24" className="input-field" value={laborForm.adminHours} onChange={e => setLaborForm({...laborForm, adminHours: e.target.value})} />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Chuyên môn (H)</label>
                    <input type="number" step="0.5" min="0" max="24" className="input-field" value={laborForm.proHours} onChange={e => setLaborForm({...laborForm, proHours: e.target.value})} />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Dọn dẹp (H)</label>
                    <input type="number" step="0.5" min="0" max="24" className="input-field" value={laborForm.cleanHours} onChange={e => setLaborForm({...laborForm, cleanHours: e.target.value})} />
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
