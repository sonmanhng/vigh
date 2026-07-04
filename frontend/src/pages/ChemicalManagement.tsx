import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useSocket } from '../context/SocketContext';

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

type Tab = 'warehouse' | 'proposals' | 'statistics' | 'history';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtVND = (n: number) => n.toLocaleString('vi-VN') + ' đ';
const fmtDate = (d: string) => new Date(d).toLocaleDateString('vi-VN');
const getPercent = (c: Chemical) => Math.round((c.quantity / c.maxQuantity) * 100);
const isLow = (c: Chemical) => getPercent(c) < c.alertThreshold;

// ─── Notification helper ───────────────────────────────────────────────────────
async function fireAlert(name: string, pct: number, threshold: number) {
  const body = `⚠️ ${name} còn ${pct}% — dưới ngưỡng cảnh báo ${threshold}%! Cần bổ sung ngay.`;
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
  alertThreshold: 50, location: '', note: '',
});

// ═════════════════════════════════════════════════════════════════════════════
export const ChemicalManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('warehouse');
  const [chemicals, setChemicals] = useState<Chemical[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alertBanner, setAlertBanner] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { socket } = useSocket();

  // Modal state
  const [modal, setModal] = useState<'none' | 'import' | 'export' | 'edit' | 'alert'>('none');
  const [editingId, setEditingId] = useState<number | null>(null);

  // Import form
  const [importForm, setImportForm] = useState(emptyImport());

  // Export form
  const [exportForm, setExportForm] = useState({ chemicalId: '', projectCode: '', quantity: '' as number | '', note: '' });

  // Alert threshold form
  const [alertForm, setAlertForm] = useState({ chemicalId: '', threshold: 50 });

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchChemicals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<Chemical[]>('/chemicals');
      setChemicals(res.data);
      // Fire alert for any low items
      res.data.filter(isLow).forEach(c => {
        fireAlert(c.name, getPercent(c), c.alertThreshold);
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
  }, [fetchChemicals, fetchTransactions]);
  useEffect(() => { if (activeTab === 'history') fetchTransactions(); }, [activeTab, fetchTransactions]);

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
        if (chem) fireAlert(chem.name, getPercent({ ...chem, quantity: chem.quantity - Number(exportForm.quantity) }), chem.alertThreshold);
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

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = chemicals.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );
  const lowCount = chemicals.filter(isLow).length;
  const totalValue = chemicals.reduce((s, c) => s + c.unitPrice * c.quantity, 0);

  // ── Styles ────────────────────────────────────────────────────────────────
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'warehouse', label: 'Kho Hoá Chất', icon: '🧪' },
    { key: 'proposals', label: 'Tiến Trình Đề Xuất', icon: '📋' },
    { key: 'statistics', label: 'Thống Kê', icon: '📊' },
    { key: 'history', label: 'Lịch Sử', icon: '📜' },
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
          <span>⚠️ {error}</span>
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
            <button onClick={() => {}} style={{ padding: '0.55rem 1.1rem', borderRadius: 'var(--radius-md)', border: '1.5px solid #722ED1', background: 'rgba(114,46,209,0.05)', color: '#722ED1', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
                      <th style={{ padding: '0.9rem 1rem', textAlign: 'center', width: '220px' }}>Số Lượng & Tiến Độ</th>
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
                          <td style={{ padding: '0.9rem 1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.88rem', fontWeight: 600 }}>
                              <span style={{ color: low ? '#CF1322' : 'var(--text-main)' }}>{c.quantity} {c.unit}</span>
                              <span style={{ color: low ? '#FF4D4F' : pct > 70 ? '#52C41A' : '#FAAD14' }}>{pct}%</span>
                            </div>
                            <div style={{ background: '#E2E8F0', borderRadius: '6px', height: '7px', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: low ? '#FF4D4F' : pct > 70 ? '#52C41A' : '#FAAD14', transition: 'width 0.4s' }} />
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
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}></div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>Tiến Trình Đề Xuất</div>
          <div>Tính năng đang được phát triển — phiên bản tiếp theo sẽ có luồng duyệt đề xuất hoá chất đa cấp.</div>
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
                        {t.type === 'IMPORT' ? '📥 Nhập' : '📤 Xuất'}
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
              <div className="modal-title">{modal === 'edit' ? '✏️ Cập Nhật Hoá Chất' : '📥 Nhập Hoá Chất'}</div>
              <button className="modal-close-btn" onClick={() => setModal('none')}>Đóng</button>
            </div>
            <form onSubmit={modal === 'edit' ? handleEditSubmit : handleImportSubmit}>
              <div className="modal-body" style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="input-label">Mã Hoá Chất (*)</label>
                    <input type="text" className="input-field" required placeholder="HC-001" value={importForm.code} onChange={e => setImportForm(p => ({ ...p, code: e.target.value }))} />
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
                    <label className="input-label">Ngưỡng Cảnh Báo (%)</label>
                    <input type="number" min="1" max="99" className="input-field" value={importForm.alertThreshold} onChange={e => setImportForm(p => ({ ...p, alertThreshold: Number(e.target.value) }))} />
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
                <button type="submit" className="btn btn-primary">{modal === 'edit' ? '💾 Lưu Cập Nhật' : '📥 Xác Nhận Nhập Kho'}</button>
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
              <div className="modal-title">📤 Xuất Hoá Chất</div>
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
                <button type="submit" className="btn btn-primary">📤 Xác Nhận Xuất Kho</button>
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
              <div className="modal-title">🔔 Tuỳ Chỉnh Cảnh Báo</div>
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
                <label className="input-label">Ngưỡng Cảnh Báo: <strong style={{ color: 'var(--primary)' }}>{alertForm.threshold}%</strong></label>
                <input type="range" min="5" max="90" step="5" value={alertForm.threshold} onChange={e => setAlertForm(p => ({ ...p, threshold: Number(e.target.value) }))} style={{ width: '100%' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}><span>5%</span><span>90%</span></div>
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
    </div>
  );
};

export default ChemicalManagement;
