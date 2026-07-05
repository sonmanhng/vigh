import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Chemical {
  id: number;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  maxQuantity: number;
  specification: number;
  invoicePrice: number;
  unitPrice: number;
  importDate: string;
  alertThreshold: number;
  location?: string;
  note?: string;
  updatedAt: string;
}

interface Transaction {
  id: number;
  type: 'IMPORT' | 'EXPORT';
  quantity: number;
  projectCode?: string;
  note?: string;
  createdAt: string;
  chemical: { code: string; name: string; unit: string };
}

interface Project {
  id: number;
  name: string;
  code: string;
}

interface ProposalItem {
  chemicalName: string;
  unit: string;
  quantity: string | number;
  phase: string;
  projectId: string | number;
}

interface Proposal {
  id: number;
  status: string;
  level1Status: string;
  level2Status: string;
  note: string;
  createdById: number;
  creator: { name: string; email: string };
  approver1?: { name: string; email: string };
  approver2?: { name: string; email: string };
  createdAt: string;
  items: {
    id: number;
    chemicalName: string;
    unit: string;
    quantity: number;
    phase: string;
    project: { name: string; code: string } | null;
  }[];
}

type Tab = 'warehouse' | 'proposals' | 'statistics' | 'history';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtVND = (n: number) => n.toLocaleString('vi-VN') + ' đ';
const fmtDate = (d: string) => new Date(d).toLocaleDateString('vi-VN');
const getPercent = (c: Chemical) => Math.round((c.quantity / c.maxQuantity) * 100);
const isLow = (c: Chemical) => c.quantity < c.alertThreshold;

// ─── Notification helper ───────────────────────────────────────────────────────
async function fireAlert(name: string, quantity: number, threshold: number, unit: string) {
  const body = `⚠️ ${name} còn lại ${quantity} ${unit} — dưới ngưỡng cảnh báo (${threshold} ${unit})! Cần bổ sung ngay.`;
  try {
    const { isTauri } = await import('@tauri-apps/api/core');
    if (isTauri()) {
      const { isPermissionGranted, requestPermission, sendNotification } = await import('@tauri-apps/plugin-notification');
      let perm = await isPermissionGranted();
      if (!perm) { const r = await requestPermission(); perm = r === 'granted'; }
      if (perm) sendNotification({ title: '🚨 CẢNH BÁO KHO VIGH', body });
      return;
    }
  } catch {}
  if ('Notification' in window && Notification.permission === 'granted') new Notification('🚨 CẢNH BÁO KHO VIGH', { body });
  else if (Notification.permission === 'default') { await Notification.requestPermission(); }
}

// ─── Empty form defaults ───────────────────────────────────────────────────────
const emptyImport = () => ({
  code: '', name: '', unit: 'Lít', quantity: '' as number | '',
  maxQuantity: '' as number | '', specification: '' as number | '',
  invoicePrice: '' as number | '', importDate: new Date().toISOString().split('T')[0],
  alertThreshold: 5, location: '', note: '',
});

// ═════════════════════════════════════════════════════════════════════════════
export const ChemicalManagement: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('warehouse');
  const [proposalTab, setProposalTab] = useState<'my_proposals' | 'pending'>('my_proposals');
  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alertBanner, setAlertBanner] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { socket } = useSocket();

  // Modal state
  const [modal, setModal] = useState<'none' | 'import' | 'export' | 'edit' | 'alert' | 'proposal'>('none');
  const [editingId, setEditingId] = useState<number | null>(null);

  // Import form
  const [importForm, setImportForm] = useState(emptyImport());

  // Export form
  const [exportForm, setExportForm] = useState({ chemicalId: '', projectCode: '', quantity: '' as number | '', note: '' });

  // Alert threshold form
  const [alertForm, setAlertForm] = useState({ chemicalId: '', threshold: 50 });

  // Proposal form
  const [projects, setProjects] = useState<Project[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [approvers, setApprovers] = useState<{ level1: any[], level2: any[] }>({ level1: [], level2: [] });
  const [proposalForm, setProposalForm] = useState({ approver1Id: '', approver2Id: '' });
  const [proposalItems, setProposalItems] = useState<ProposalItem[]>([
    { chemicalName: '', unit: '', quantity: '', phase: '', projectId: '' }
  ]);
  const [proposalNote, setProposalNote] = useState('');

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchChemicals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<Chemical[]>('/chemicals');
      setChemicals(res.data);
      // Fire alert for any low items
      res.data.filter(isLow).forEach(c => {
        fireAlert(c.name, c.quantity, c.alertThreshold, c.unit);
      });
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi tải danh sách hoá chất');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await apiClient.get<Transaction[]>('/chemicals/transactions');
      setTransactions(res.data);
    } catch (e) {
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

  const fetchProposals = useCallback(async () => {
    try {
      const res = await apiClient.get<Proposal[]>('/chemicals/proposals');
      setProposals(res.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchApprovers = useCallback(async () => {
    try {
      const res = await apiClient.get('/chemicals/approvers');
      setApprovers(res.data);
      if (res.data.level2 && res.data.level2.length > 0) {
        setProposalForm(p => ({ ...p, approver2Id: res.data.level2[0].id.toString() }));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleSync = () => {
      console.log('🔄 Real-time update received! Reloading chemicals...');
      fetchChemicals();
      fetchTransactions();
    };

    socket.on('sync_chemicals', handleSync);
    
    return () => {
      socket.off('sync_chemicals', handleSync);
    };
  }, [socket, fetchChemicals, fetchTransactions]);

  useEffect(() => {
    fetchChemicals();
    fetchTransactions();
    fetchProjects();
    fetchProposals();
    fetchApprovers();
  }, [fetchChemicals, fetchTransactions, fetchProjects, fetchProposals, fetchApprovers]);
  
  useEffect(() => { if (activeTab === 'history') fetchTransactions(); }, [activeTab, fetchTransactions]);
  useEffect(() => { if (activeTab === 'proposals') fetchProposals(); }, [activeTab, fetchProposals]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/chemicals', {
        ...importForm,
        quantity: Number(importForm.quantity),
        maxQuantity: Number(importForm.maxQuantity),
        specification: Number(importForm.specification),
        invoicePrice: Number(importForm.invoicePrice),
      });
      setModal('none');
      setImportForm(emptyImport());
      fetchChemicals();
      fetchTransactions();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi nhập hoá chất');
    }
  };

  const handleExportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.post(`/chemicals/${exportForm.chemicalId}/export`, {
        projectCode: exportForm.projectCode,
        quantity: Number(exportForm.quantity),
        note: exportForm.note,
      });
      setModal('none');
      setExportForm({ chemicalId: '', projectCode: '', quantity: '', note: '' });
      fetchChemicals();
      fetchTransactions();
      if (res.data.warning) {
        setAlertBanner(res.data.warning);
        const chem = chemicals.find(c => c.id === Number(exportForm.chemicalId));
        if (chem) {
          const remainingQuantity = chem.quantity - Number(exportForm.quantity);
          if (remainingQuantity < chem.alertThreshold) {
            fireAlert(chem.name, remainingQuantity, chem.alertThreshold, chem.unit);
          }
        }
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi xuất hoá chất');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      await apiClient.put(`/chemicals/${editingId}`, {
        ...importForm,
        quantity: Number(importForm.quantity),
        maxQuantity: Number(importForm.maxQuantity),
        specification: Number(importForm.specification),
        invoicePrice: Number(importForm.invoicePrice),
      });
      setModal('none');
      setEditingId(null);
      setImportForm(emptyImport());
      fetchChemicals();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi cập nhật hoá chất');
    }
  };

  const handleProposalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (proposalItems.length === 0) return;
    try {
      await apiClient.post('/chemicals/proposals', {
        note: proposalNote,
        approver1Id: proposalForm.approver1Id,
        approver2Id: proposalForm.approver2Id,
        items: proposalItems,
      });
      setModal('none');
      setProposalItems([{ chemicalName: '', unit: '', quantity: '', phase: '', projectId: '' }]);
      setProposalNote('');
      fetchProposals();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi gửi đề xuất');
    }
  };

  const handleUpdateProposalStatus = async (id: number, action: string) => {
    try {
      await apiClient.put(`/chemicals/proposals/${id}/status`, { action });
      fetchProposals();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi cập nhật trạng thái');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Xoá hoá chất "${name}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await apiClient.delete(`/chemicals/${id}`);
      fetchChemicals();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi xoá hoá chất');
    }
  };

  const openEdit = (c: Chemical) => {
    setEditingId(c.id);
    setImportForm({
      code: c.code, name: c.name, unit: c.unit,
      quantity: c.quantity, maxQuantity: c.maxQuantity,
      specification: c.specification, invoicePrice: c.invoicePrice,
      importDate: c.importDate.split('T')[0],
      alertThreshold: c.alertThreshold,
      location: c.location || '', note: c.note || '',
    });
    setModal('edit');
  };

  const handleExportExcel = async (id: number) => {
    try {
      const res = await apiClient.get(`/chemicals/proposals/${id}/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DeXuat_${id}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (e: any) {
      setError('Lỗi khi xuất file Excel');
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = chemicals.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );
  const lowCount = chemicals.filter(isLow).length;
  const totalValue = chemicals.reduce((s, c) => s + c.unitPrice * c.quantity, 0);

  // ── Styles ────────────────────────────────────────────────────────────────
  const tabs = [
    { key: 'warehouse', label: 'Kho Hoá Chất' },
    { key: 'proposals', label: 'Tiến Trình Đề Xuất' },
    { key: 'statistics', label: 'Thống Kê' },
    { key: 'history', label: 'Lịch Sử' },
  ];

  return (
    <div style={{ padding: '1.5rem', maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
          Quản Lý Hoá Chất
        </h1>
        <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
          Kho dược liệu & hoá chất thí nghiệm — VIGH
        </p>
      </div>

      {/* Alert Banner */}
      {alertBanner && (
        <div style={{ background: '#FFF1F0', border: '1px solid #FFA39E', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#CF1322', fontWeight: 600 }}>
          <span>{alertBanner}</span>
          <button onClick={() => setAlertBanner(null)} style={{ border: 'none', background: 'none', color: '#CF1322', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>
      )}
      {error && (
        <div style={{ background: '#FFF1F0', border: '1px solid #FFA39E', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#CF1322' }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ border: 'none', background: 'none', color: '#CF1322', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{
        backgroundColor: '#F8F9FA',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        marginBottom: '1.5rem'
      }}>
        <div style={{
          backgroundColor: 'rgba(52, 144, 139, 0.06)',
          display: 'flex',
          alignItems: 'center',
          padding: '0.6rem 1.25rem 0 1.25rem',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-color)',
          overflowX: 'auto'
        }}>
          {tabs.map(t => {
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                style={{
                  backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                  color: isActive ? '#FFFFFF' : 'var(--text-muted)',
                  border: 'none',
                  padding: '0.75rem 1.4rem',
                  borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  cursor: 'pointer',
                  borderTop: isActive ? '3px solid var(--primary-light)' : '3px solid transparent',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>{t.label}</span>
                {t.key === 'warehouse' && lowCount > 0 && (
                  <span style={{
                    backgroundColor: isActive ? '#FFFFFF' : '#FF4D4F',
                    color: isActive ? '#CF1322' : '#FFFFFF',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.55rem',
                    borderRadius: '12px'
                  }}>
                    {lowCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TAB: KHO HOÁ CHẤT ── */}
      {activeTab === 'warehouse' && (
        <>
          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => { setImportForm(emptyImport()); setModal('import'); }} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
              Nhập Hoá Chất
            </button>
            <button onClick={() => setModal('export')} style={{ padding: '0.55rem 1.1rem', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--primary)', background: 'rgba(0,150,136,0.06)', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Xuất Hoá Chất
            </button>
            <button onClick={() => setModal('proposal')} style={{ padding: '0.55rem 1.1rem', borderRadius: 'var(--radius-md)', border: '1.5px solid #722ED1', background: 'rgba(114,46,209,0.05)', color: '#722ED1', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Đề Xuất Hoá Chất
            </button>
            <button onClick={() => setModal('alert')} style={{ padding: '0.55rem 1.1rem', borderRadius: 'var(--radius-md)', border: '1.5px solid #FAAD14', background: 'rgba(250,173,20,0.06)', color: '#D48806', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Tuỳ Chỉnh Cảnh Báo
            </button>
          </div>

          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid var(--primary)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>Tổng số hoá chất</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{chemicals.length} <span style={{ fontSize: '1rem' }}>loại</span></div>
            </div>
            <div className="card" style={{ padding: '1.1rem', borderLeft: lowCount > 0 ? '4px solid #FF4D4F' : '4px solid #52C41A', background: lowCount > 0 ? '#FFF9F9' : undefined }}>
              <div style={{ color: lowCount > 0 ? '#CF1322' : 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>Lượng hoá chất cảnh báo</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: lowCount > 0 ? '#CF1322' : 'var(--text-main)' }}>{lowCount} <span style={{ fontSize: '1rem' }}>loại</span></div>
            </div>
          </div>

          {/* Search */}
          <div style={{ marginBottom: '1rem' }}>
            <input className="input-field" type="text" placeholder="Tìm theo mã hoặc tên hoá chất..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: '380px', padding: '0.5rem 0.9rem' }} />
          </div>

          {/* Table */}
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.82rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '0.9rem 1rem' }}>Mã HC</th>
                      <th style={{ padding: '0.9rem 1rem' }}>Tên Hoá Chất</th>
                      <th style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>Đơn Giá (VNĐ)</th>
                      <th style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>Ngày Nhập</th>
                      <th style={{ padding: '0.9rem 1rem', textAlign: 'center', width: '150px' }}>Số Lượng</th>
                      <th style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>Trạng Thái</th>
                      <th style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {chemicals.length === 0 ? 'Kho chưa có hoá chất nào. Bấm "Nhập Hoá Chất" để bắt đầu!' : 'Không tìm thấy kết quả.'}
                      </td></tr>
                    ) : filtered.map(c => {
                      const pct = getPercent(c);
                      const low = isLow(c);
                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)', background: low ? '#FFF9F9' : '#fff', transition: 'background 0.2s' }}>
                          <td style={{ padding: '0.9rem 1rem', fontWeight: 700, color: 'var(--primary)' }}>{c.code}</td>
                          <td style={{ padding: '0.9rem 1rem' }}>
                            <div style={{ fontWeight: 600 }}>{c.name}</div>
                            {c.location && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.location}</div>}
                          </td>
                          <td style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{fmtVND(c.unitPrice)}/{c.unit}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>HĐ: {fmtVND(c.invoicePrice)} / {c.specification} {c.unit}</div>
                          </td>
                          <td style={{ padding: '0.9rem 1rem', textAlign: 'center', fontSize: '0.88rem', color: 'var(--text-muted)' }}>{fmtDate(c.importDate)}</td>
                          <td style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: low ? '#CF1322' : 'var(--text-main)' }}>
                              {c.quantity} {c.unit}
                            </div>
                          </td>
                          <td style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>
                            {low ? (
                              <span style={{ background: '#FFF1F0', color: '#CF1322', border: '1px solid #FFA39E', borderRadius: '12px', padding: '0.2rem 0.7rem', fontSize: '0.8rem', fontWeight: 700 }}>Dưới {c.alertThreshold}%</span>
                            ) : (
                              <span style={{ background: '#F6FFED', color: '#389E0D', border: '1px solid #B7EB8F', borderRadius: '12px', padding: '0.2rem 0.7rem', fontSize: '0.8rem', fontWeight: 600 }}>Ổn định</span>
                            )}
                          </td>
                          <td style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                              <button onClick={() => openEdit(c)} style={{ padding: '0.3rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>Sửa</button>
                              <button onClick={() => handleDelete(c.id, c.name)} style={{ padding: '0.3rem 0.75rem', borderRadius: '6px', border: '1px solid #FFCCC7', background: '#fff', color: '#FF4D4F', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>Xoá</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── TAB: ĐỀ XUẤT ── */}
      {activeTab === 'proposals' && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          {['SuperAdmin', 'VienTruong', 'VienPho', 'TruongPhong'].includes(user?.role || '') && (
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: '#F8FAFC' }}>
              <button
                onClick={() => setProposalTab('my_proposals')}
                style={{
                  padding: '0.75rem 1.5rem', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700,
                  color: proposalTab === 'my_proposals' ? 'var(--primary)' : 'var(--text-muted)',
                  borderBottom: proposalTab === 'my_proposals' ? '2px solid var(--primary)' : '2px solid transparent'
                }}
              >Đề xuất của tôi</button>
              <button
                onClick={() => setProposalTab('pending')}
                style={{
                  padding: '0.75rem 1.5rem', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700,
                  color: proposalTab === 'pending' ? 'var(--primary)' : 'var(--text-muted)',
                  borderBottom: proposalTab === 'pending' ? '2px solid var(--primary)' : '2px solid transparent'
                }}
              >Đề xuất cần duyệt</button>
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.82rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.9rem 1rem' }}>ID</th>
                  <th style={{ padding: '0.9rem 1rem' }}>Người Đề Xuất</th>
                  <th style={{ padding: '0.9rem 1rem' }}>Nội Dung</th>
                  <th style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>Trạng Thái</th>
                  <th style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>Ngày Đề Xuất</th>
                </tr>
              </thead>
              <tbody>
                {proposals.filter(p => {
                  if (proposalTab === 'my_proposals') return p.createdById === user?.id;
                  if (proposalTab === 'pending') {
                    if (p.level1Status === 'PENDING' && p.approver1?.email === user?.email) return true;
                    if (p.level1Status === 'APPROVED' && p.level2Status === 'PENDING' && (p.approver2?.email === user?.email || user?.role === 'VienTruong' || user?.role === 'SuperAdmin')) return true;
                    return false;
                  }
                  return true;
                }).length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có đề xuất nào.</td></tr>
                ) : proposals.filter(p => {
                  if (proposalTab === 'my_proposals') return p.createdById === user?.id;
                  if (proposalTab === 'pending') {
                    if (p.level1Status === 'PENDING' && p.approver1?.email === user?.email) return true;
                    if (p.level1Status === 'APPROVED' && p.level2Status === 'PENDING' && (p.approver2?.email === user?.email || user?.role === 'VienTruong' || user?.role === 'SuperAdmin')) return true;
                    return false;
                  }
                  return true;
                }).map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>#{p.id}</td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 600 }}>{p.creator?.name || 'Ẩn danh'}</div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{p.note || 'Không có ghi chú'}</div>
                      <div style={{ fontSize: '0.8rem' }}>
                        {p.items.map((i, idx) => (
                          <div key={idx}>- {i.chemicalName}: {i.quantity} {i.unit} (DA: {i.project?.code || 'Không có'})</div>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      {p.status === 'PENDING' && <span style={{ background: '#FFF7E6', color: '#D46B08', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>Chờ duyệt Cấp 1</span>}
                      {p.status === 'PENDING_LEVEL_2' && <span style={{ background: '#FFF7E6', color: '#D46B08', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>Chờ duyệt Cấp 2</span>}
                      {p.status === 'APPROVED' && <span style={{ background: '#F6FFED', color: '#389E0D', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>Đã duyệt toàn bộ</span>}
                      {p.status === 'REJECTED' && <span style={{ background: '#FFF1F0', color: '#CF1322', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>Từ chối</span>}
                      
                      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                        {proposalTab === 'pending' && p.status !== 'APPROVED' && p.status !== 'REJECTED' && (
                          <>
                            <button onClick={() => handleUpdateProposalStatus(p.id, 'APPROVE')} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: '#52C41A', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Duyệt</button>
                            <button onClick={() => handleUpdateProposalStatus(p.id, 'REJECT')} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: '#FF4D4F', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Từ chối</button>
                          </>
                        )}
                        <button onClick={() => handleExportExcel(p.id)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: '#1890FF', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>In/Xuất File</button>
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{new Date(p.createdAt).toLocaleString('vi-VN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: THỐNG KÊ ── */}
      {activeTab === 'statistics' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem', color: 'var(--text-main)' }}>Tỉ lệ tồn kho</div>
            {chemicals.map(c => {
              const pct = getPercent(c);
              const low = isLow(c);
              return (
                <div key={c.id} style={{ marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    <span style={{ color: low ? '#FF4D4F' : '#52C41A', fontWeight: 700 }}>{pct}%</span>
                  </div>
                  <div style={{ background: '#E2E8F0', borderRadius: '4px', height: '6px' }}>
                    <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: low ? '#FF4D4F' : pct > 70 ? '#52C41A' : '#FAAD14', borderRadius: '4px' }} />
                  </div>
                </div>
              );
            })}
            {chemicals.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Chưa có dữ liệu</div>}
          </div>
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem', color: 'var(--text-main)' }}>Giá trị kho theo hoá chất</div>
            {chemicals.sort((a, b) => (b.unitPrice * b.quantity) - (a.unitPrice * a.quantity)).map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.88rem' }}>
                <span style={{ fontWeight: 600 }}>{c.code} — {c.name}</span>
                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{fmtVND(c.unitPrice * c.quantity)}</span>
              </div>
            ))}
            {chemicals.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0 0', fontWeight: 700, fontSize: '0.95rem' }}>
                <span>Tổng cộng</span>
                <span style={{ color: 'var(--primary)' }}>{fmtVND(totalValue)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: LỊCH SỬ ── */}
      {activeTab === 'history' && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.82rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.9rem 1rem' }}>Loại</th>
                  <th style={{ padding: '0.9rem 1rem' }}>Hoá Chất</th>
                  <th style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>Số Lượng</th>
                  <th style={{ padding: '0.9rem 1rem' }}>Mã Dự Án</th>
                  <th style={{ padding: '0.9rem 1rem' }}>Ghi Chú</th>
                  <th style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>Thời Gian</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>📭 Chưa có lịch sử xuất nhập</td></tr>
                ) : transactions.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ background: t.type === 'IMPORT' ? '#F6FFED' : '#FFF1F0', color: t.type === 'IMPORT' ? '#389E0D' : '#CF1322', border: `1px solid ${t.type === 'IMPORT' ? '#B7EB8F' : '#FFA39E'}`, borderRadius: '10px', padding: '0.15rem 0.65rem', fontSize: '0.8rem', fontWeight: 700 }}>
                        {t.type === 'IMPORT' ? 'Nhập' : 'Xuất'}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t.chemical.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.chemical.code}</div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 700, color: t.type === 'IMPORT' ? '#389E0D' : '#CF1322' }}>
                      {t.type === 'EXPORT' ? '-' : '+'}{t.quantity} {t.chemical.unit}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.88rem' }}>{t.projectCode || '—'}</td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '200px' }}>{t.note || '—'}</td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{new Date(t.createdAt).toLocaleString('vi-VN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════ MODALS ══════════ */}

      {/* Import / Edit Modal */}
      {(modal === 'import' || modal === 'edit') && (
        <div className="modal-overlay" onClick={() => setModal('none')}>
          <div className="modal-content" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{modal === 'edit' ? 'Cập Nhật Hoá Chất' : 'Nhập Hoá Chất'}</div>
              <button className="modal-close-btn" onClick={() => setModal('none')}>Đóng</button>
            </div>
            <form onSubmit={modal === 'edit' ? handleEditSubmit : handleImportSubmit}>
              <div className="modal-body" style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="input-label">Mã Hoá Chất (*)</label>
                    <input type="text" className="input-field" required placeholder="HC-001" value={importForm.code} onChange={e => {
                      const code = e.target.value;
                      const existing = chemicals.find(c => c.code === code);
                      if (existing && modal === 'import') {
                        setImportForm(p => ({
                          ...p,
                          code,
                          name: existing.name,
                          unit: existing.unit,
                          maxQuantity: existing.maxQuantity,
                          specification: existing.specification,
                          invoicePrice: existing.invoicePrice,
                          alertThreshold: existing.alertThreshold,
                          location: existing.location || '',
                          note: existing.note || '',
                        }));
                      } else {
                        setImportForm(p => ({ ...p, code }));
                      }
                    }} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Tên Hoá Chất (*)</label>
                    <input type="text" className="input-field" required placeholder="VD: Ethanol 96%..." value={importForm.name} onChange={e => setImportForm(p => ({ ...p, name: e.target.value }))} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="input-label">Đơn vị tính</label>
                    <input type="text" className="input-field" placeholder="Lít, Kg, Chai..." value={importForm.unit} onChange={e => setImportForm(p => ({ ...p, unit: e.target.value }))} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Số lượng nhập (*)</label>
                    <input type="number" step="any" min="0" className="input-field" required value={importForm.quantity} onChange={e => setImportForm(p => ({ ...p, quantity: e.target.value === '' ? '' : Number(e.target.value) }))} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Định mức tối đa (*)</label>
                    <input type="number" step="any" min="0" className="input-field" required value={importForm.maxQuantity} onChange={e => setImportForm(p => ({ ...p, maxQuantity: e.target.value === '' ? '' : Number(e.target.value) }))} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px dashed #CBD5E1' }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Quy Cách (*)</label>
                    <input type="number" step="any" min="0.001" className="input-field" required placeholder="VD: 10" value={importForm.specification} onChange={e => setImportForm(p => ({ ...p, specification: e.target.value === '' ? '' : Number(e.target.value) }))} />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Giá Hoá Đơn (VNĐ) (*)</label>
                    <input type="number" step="any" min="0" className="input-field" required placeholder="Tổng tiền" value={importForm.invoicePrice} onChange={e => setImportForm(p => ({ ...p, invoicePrice: e.target.value === '' ? '' : Number(e.target.value) }))} />
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Đơn Giá (tự tính)</label>
                    <div style={{ padding: '0.55rem 0.75rem', background: '#EEF2FF', borderRadius: '6px', fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>
                      {importForm.invoicePrice && importForm.specification
                        ? fmtVND(Number(importForm.invoicePrice) / Number(importForm.specification)) + '/' + (importForm.unit || 'đv')
                        : '—'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="input-label">Ngày Nhập Kho (*)</label>
                    <input type="date" className="input-field" required value={importForm.importDate} onChange={e => setImportForm(p => ({ ...p, importDate: e.target.value }))} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Ngưỡng Cảnh Báo (Số lượng)</label>
                    <input type="number" step="0.01" className="input-field" required value={importForm.alertThreshold} onChange={e => setImportForm(p => ({ ...p, alertThreshold: Number(e.target.value) }))} />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Vị trí lưu trữ</label>
                  <input type="text" className="input-field" placeholder="VD: Tủ A1 — Phòng Thí nghiệm" value={importForm.location} onChange={e => setImportForm(p => ({ ...p, location: e.target.value }))} />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Ghi chú / Bảo quản</label>
                  <textarea className="input-field" style={{ minHeight: '60px', resize: 'vertical' }} placeholder="VD: Bảo quản lạnh 2–8°C, tránh ánh sáng..." value={importForm.note} onChange={e => setImportForm(p => ({ ...p, note: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal('none')}>Huỷ</button>
                <button type="submit" className="btn btn-primary">{modal === 'edit' ? 'Lưu Cập Nhật' : 'Xác Nhận Nhập Kho'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {modal === 'export' && (
        <div className="modal-overlay" onClick={() => setModal('none')}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Xuất Hoá Chất</div>
              <button className="modal-close-btn" onClick={() => setModal('none')}>Đóng</button>
            </div>
            <form onSubmit={handleExportSubmit}>
              <div className="modal-body" style={{ display: 'grid', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Chọn Hoá Chất (*)</label>
                  <select className="input-field" required value={exportForm.chemicalId} onChange={e => setExportForm(p => ({ ...p, chemicalId: e.target.value }))}>
                    <option value="">— Chọn hoá chất —</option>
                    {chemicals.map(c => (
                      <option key={c.id} value={c.id}>{c.code} — {c.name} (còn: {c.quantity} {c.unit})</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Mã Dự Án (*)</label>
                  <input type="text" className="input-field" required placeholder="VD: SAM-003, DE-012..." value={exportForm.projectCode} onChange={e => setExportForm(p => ({ ...p, projectCode: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Số Lượng Xuất (*)</label>
                  <input type="number" step="any" min="0.001" className="input-field" required value={exportForm.quantity} onChange={e => setExportForm(p => ({ ...p, quantity: e.target.value === '' ? '' : Number(e.target.value) }))} />
                  {exportForm.chemicalId && exportForm.quantity !== '' && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Tồn sau xuất: {(chemicals.find(c => c.id === Number(exportForm.chemicalId))?.quantity || 0) - Number(exportForm.quantity)} {chemicals.find(c => c.id === Number(exportForm.chemicalId))?.unit}
                    </span>
                  )}
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Ghi Chú</label>
                  <input type="text" className="input-field" placeholder="Mục đích sử dụng..." value={exportForm.note} onChange={e => setExportForm(p => ({ ...p, note: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal('none')}>Huỷ</button>
                <button type="submit" className="btn btn-primary">Xác Nhận Xuất Kho</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Alert Threshold Modal */}
      {modal === 'alert' && (
        <div className="modal-overlay" onClick={() => setModal('none')}>
          <div className="modal-content" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Tuỳ Chỉnh Cảnh Báo</div>
              <button className="modal-close-btn" onClick={() => setModal('none')}>Đóng</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: '1rem' }}>
              <div className="input-group">
                <label className="input-label">Chọn Hoá Chất</label>
                <select className="input-field" value={alertForm.chemicalId} onChange={e => {
                  const c = chemicals.find(x => x.id === Number(e.target.value));
                  setAlertForm({ chemicalId: e.target.value, threshold: c?.alertThreshold || 50 });
                }}>
                  <option value="">— Chọn hoá chất —</option>
                  {chemicals.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                </select>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Ngưỡng Cảnh Báo (Số lượng): <strong style={{ color: 'var(--primary)' }}>{alertForm.threshold} {chemicals.find(c => c.id === Number(alertForm.chemicalId))?.unit}</strong></label>
                <input type="number" step="0.01" className="input-field" value={alertForm.threshold} onChange={e => setAlertForm(p => ({ ...p, threshold: Number(e.target.value) }))} style={{ width: '100%' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal('none')}>Huỷ</button>
              <button className="btn btn-primary" onClick={async () => {
                if (!alertForm.chemicalId) return;
                try {
                  const chem = chemicals.find(c => c.id === Number(alertForm.chemicalId));
                  if (!chem) return;
                  await apiClient.put(`/chemicals/${alertForm.chemicalId}`, { ...chem, importDate: chem.importDate.split('T')[0], alertThreshold: alertForm.threshold });
                  fetchChemicals();
                  setModal('none');
                } catch (e: any) { setError(e.response?.data?.error || 'Lỗi cập nhật ngưỡng cảnh báo'); }
              }}>💾 Lưu Cảnh Báo</button>
            </div>
          </div>
        </div>
      )}
      {/* Proposal Modal */}
      {modal === 'proposal' && (
        <div className="modal-overlay" onClick={() => setModal('none')}>
          <div className="modal-content" style={{ maxWidth: '900px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Đề Xuất Hoá Chất</div>
              <button className="modal-close-btn" onClick={() => setModal('none')}>Đóng</button>
            </div>
            <form onSubmit={handleProposalSubmit}>
              <div className="modal-body" style={{ display: 'grid', gap: '1rem', maxHeight: '60vh', overflowY: 'auto' }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="input-label">Người duyệt 1 (Trưởng phòng / Viện phó)</label>
                    <select className="input-field" value={proposalForm.approver1Id} onChange={e => setProposalForm(p => ({ ...p, approver1Id: e.target.value }))}>
                      <option value="">— Không có / Tự duyệt —</option>
                      {approvers.level1.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Người duyệt 2 (Viện trưởng)</label>
                    <select className="input-field" required value={proposalForm.approver2Id} onChange={e => setProposalForm(p => ({ ...p, approver2Id: e.target.value }))}>
                      <option value="">— Chọn người duyệt 2 —</option>
                      {approvers.level2.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Ghi Chú Đề Xuất</label>
                  <input type="text" className="input-field" placeholder="Mục đích chung của đề xuất này..." value={proposalNote} onChange={e => setProposalNote(e.target.value)} />
                </div>

                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ background: '#F8FAFC' }}>
                      <tr style={{ fontSize: '0.85rem' }}>
                        <th style={{ padding: '0.5rem' }}>Tên vật tư</th>
                        <th style={{ padding: '0.5rem', width: '80px' }}>ĐVT</th>
                        <th style={{ padding: '0.5rem', width: '100px' }}>Số lượng</th>
                        <th style={{ padding: '0.5rem', width: '120px' }}>Giai đoạn</th>
                        <th style={{ padding: '0.5rem' }}>Dự án</th>
                        <th style={{ padding: '0.5rem', width: '50px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {proposalItems.map((item, idx) => (
                        <tr key={idx} style={{ borderTop: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.5rem' }}>
                            <input type="text" className="input-field" required placeholder="Tên hoá chất..." value={item.chemicalName} onChange={e => {
                              const newItems = [...proposalItems];
                              newItems[idx].chemicalName = e.target.value;
                              setProposalItems(newItems);
                            }} />
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <input type="text" className="input-field" required placeholder="Lít, kg..." value={item.unit} onChange={e => {
                              const newItems = [...proposalItems];
                              newItems[idx].unit = e.target.value;
                              setProposalItems(newItems);
                            }} />
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <input type="number" step="any" min="0" className="input-field" required value={item.quantity} onChange={e => {
                              const newItems = [...proposalItems];
                              newItems[idx].quantity = e.target.value;
                              setProposalItems(newItems);
                            }} />
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <input type="text" className="input-field" value={item.phase} onChange={e => {
                              const newItems = [...proposalItems];
                              newItems[idx].phase = e.target.value;
                              setProposalItems(newItems);
                            }} />
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <select className="input-field" value={item.projectId} onChange={e => {
                              const newItems = [...proposalItems];
                              newItems[idx].projectId = e.target.value;
                              setProposalItems(newItems);
                            }}>
                              <option value="">— Chọn dự án —</option>
                              {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <button type="button" onClick={() => {
                              if (proposalItems.length > 1) {
                                setProposalItems(proposalItems.filter((_, i) => i !== idx));
                              }
                            }} style={{ border: 'none', background: 'none', color: '#CF1322', cursor: 'pointer', fontWeight: 800 }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ padding: '0.5rem', background: '#F8FAFC', borderTop: '1px solid var(--border-color)' }}>
                    <button type="button" onClick={() => setProposalItems([...proposalItems, { chemicalName: '', unit: '', quantity: '', phase: '', projectId: '' }])} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>+ Thêm dòng</button>
                  </div>
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal('none')}>Huỷ</button>
                <button type="submit" className="btn btn-primary">Gửi Đề Xuất</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChemicalManagement;
