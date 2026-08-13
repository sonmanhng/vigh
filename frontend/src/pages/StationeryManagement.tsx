import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Stationery {
  id: number;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  alertThreshold: number;
  note?: string;
  updatedAt: string;
}

interface Transaction {
  id: number;
  type: 'IMPORT' | 'EXPORT';
  quantity: number;
  note?: string;
  createdAt: string;
  stationery: { code: string; name: string; unit: string };
}

interface Project {
  id: number;
  name: string;
  code: string;
}

interface ProjectStatistic {
  stationerys: {
    stationeryId: number;
    stationeryCode: string;
    stationeryName: string;
    unit: string;
    totalQuantity: number;
    totalValue: number;
  }[];
}

interface ProposalItem {
  stationeryName: string;
  unit: string;
  quantity: string | number;
  note?: string;
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
    stationeryName: string;
    unit: string;
    quantity: number;
  }[];
}

type Tab = 'warehouse' | 'proposals' | 'statistics' | 'history';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtVND = (n: number) => n.toLocaleString('vi-VN') + ' đ';
const fmtDate = (d: string) => new Date(d).toLocaleDateString('vi-VN');
const isLow = (c: Stationery) => c.quantity < c.alertThreshold;

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
});

// ═════════════════════════════════════════════════════════════════════════════
export const StationeryManagement: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('warehouse');
  const [proposalTab, setProposalTab] = useState<'my_proposals' | 'pending'>('my_proposals');
  const [stationerys, setStationerys] = useState<Stationery[]>([]);
  const [selectedStationerys, setSelectedStationerys] = useState<number[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alertBanner, setAlertBanner] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { socket } = useSocket();

  // Modal state
  const [modal, setModal] = useState<'none' | 'import' | 'export' | 'edit' | 'alert' | 'proposal'>('none');
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Import form
  const [importForm, setImportForm] = useState(emptyImport());

  // Export form
  const [alertForm, setAlertForm] = useState({ stationeryId: '', stationerySearch: '', threshold: 0 });

  // Proposal form
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [approvers, setApprovers] = useState<{ level1: any[], level2: any[] }>({ level1: [], level2: [] });
  const [proposalForm, setProposalForm] = useState({ approver1Id: '', approver2Id: '' });
  const [proposalItems, setProposalItems] = useState<ProposalItem[]>([
    { stationeryName: '', unit: '', quantity: '', note: '' }
  ]);
  const [proposalNote, setProposalNote] = useState('');

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchStationerys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<Stationery[]>('/stationerys');
      setStationerys(res.data);
      // Fire alert for any low items
      res.data.filter(isLow).forEach(c => {
        fireAlert(c.name, c.quantity, c.alertThreshold, c.unit);
      });
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi tải danh sách văn phòng phẩm');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await apiClient.get<Transaction[]>('/stationerys/transactions');
      setTransactions(res.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      setProjects(res.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchProposals = useCallback(async () => {
    try {
      const res = await apiClient.get<Proposal[]>('/stationerys/proposals');
      setProposals(res.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchProjectStatistics = useCallback(async () => {
    try {
      setProjectStatistics(res.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchApprovers = useCallback(async () => {
    try {
      const res = await apiClient.get('/stationerys/approvers');
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
      console.log('🔄 Real-time update received! Reloading stationerys...');
      fetchStationerys();
      fetchTransactions();
    };

    socket.on('sync_stationerys', handleSync);
    
    return () => {
      socket.off('sync_stationerys', handleSync);
    };
  }, [socket, fetchStationerys, fetchTransactions]);

  useEffect(() => {
    fetchStationerys();
    fetchTransactions();
    fetchProjects();
    fetchProposals();
    fetchApprovers();
  }, [fetchStationerys, fetchTransactions, fetchProjects, fetchProposals, fetchApprovers]);
  
  useEffect(() => { if (activeTab === 'history') fetchTransactions(); }, [activeTab, fetchTransactions]);
  useEffect(() => { if (activeTab === 'proposals') fetchProposals(); }, [activeTab, fetchProposals]);
  useEffect(() => { if (activeTab === 'statistics') fetchProjectStatistics(); }, [activeTab, fetchProjectStatistics]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/stationerys', {
        ...importForm,
        quantity: Number(importForm.quantity),
      });
      setModal('none');
      setImportForm(emptyImport());
      fetchStationerys();
      fetchTransactions();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi nhập văn phòng phẩm');
    }
  };

  const handleExportInventoryExcel = () => {
    const dataToExport = stationerys.map(c => ({
      'Mã (*bắt buộc)': c.code,
      'Tên văn phòng phẩm (*bắt buộc)': c.name,
      'Đơn vị': c.unit,
      'Tồn kho hiện tại': c.quantity,
      'Ngưỡng cảnh báo': c.alertThreshold,
      'Ghi chú': c.note || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'HoaChat');
    XLSX.writeFile(workbook, `Danh_Sach_Hoa_Chat_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rows.length < 2) {
          setError('File Excel trống hoặc không đúng định dạng');
          return;
        }

        const stationerysPayload = [];
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i];
          if (cols && cols.length >= 3 && cols[0] && cols[1]) {
            stationerysPayload.push({
              code: String(cols[0]).trim(),
              name: String(cols[1]).trim(),
              unit: cols[2] ? String(cols[2]).trim() : 'Lít',
              quantity: Number(cols[3]) || 0,
              alertThreshold: Number(cols[8]) || 5,
              note: cols[11] ? String(cols[11]).trim() : ''
            });
          }
        }

        setLoading(true);
        const res = await apiClient.post('/stationerys/import', { stationerys: stationerysPayload });
        fetchStationerys();
        fetchTransactions();
        setError(null);
        alert(res.data.message);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Lỗi khi upload file');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleExportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.post(`/stationerys/${exportForm.stationeryId}/export`, {
        quantity: Number(exportForm.quantity),
        note: exportForm.note,
      });
      setModal('none');
      fetchStationerys();
      fetchTransactions();
      if (res.data.warning) {
        setAlertBanner(res.data.warning);
        const chem = stationerys.find(c => c.id === Number(exportForm.stationeryId));
        if (chem) {
          const remainingQuantity = chem.quantity - Number(exportForm.quantity);
          if (remainingQuantity < chem.alertThreshold) {
            fireAlert(chem.name, remainingQuantity, chem.alertThreshold, chem.unit);
          }
        }
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi xuất văn phòng phẩm');
    }
  };

  const handleUndoTransaction = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn hoàn tác giao dịch này?')) return;
    try {
      await apiClient.delete(`/stationerys/transactions/${id}`);
      fetchStationerys();
      fetchTransactions();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi hoàn tác giao dịch');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      await apiClient.put(`/stationerys/${editingId}`, {
        ...importForm,
        quantity: Number(importForm.quantity),
      });
      setModal('none');
      setEditingId(null);
      setImportForm(emptyImport());
      fetchStationerys();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi cập nhật văn phòng phẩm');
    }
  };

  const handleOpenProposal = async () => {
    try {
      const res = await apiClient.get('/stationeries/low-stock');
      const lowStockItems = res.data;
      if (lowStockItems.length > 0) {
        const initialItems = lowStockItems.map((s: any) => ({
          stationeryName: s.name,
          unit: s.unit,
          quantity: '',
          note: 'Sắp hết'
        }));
        setProposalItems(initialItems);
      } else {
        setProposalItems([{ stationeryName: '', unit: '', quantity: '', note: '' }]);
      }
      setModal('proposal');
    } catch (e: any) {
      console.error(e);
      setProposalItems([{ stationeryName: '', unit: '', quantity: '', note: '' }]);
      setModal('proposal');
    }
  };

  const handleProposalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (proposalItems.length === 0) return;
    try {
      await apiClient.post('/stationerys/proposals', {
        note: proposalNote,
        approver1Id: proposalForm.approver1Id,
        approver2Id: proposalForm.approver2Id,
        items: proposalItems,
      });
      setModal('none');
      setProposalItems([{ stationeryName: '', unit: '', quantity: '', note: '' }]);
      setProposalNote('');
      fetchProposals();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi gửi đề xuất');
    }
  };

  const handleUpdateProposalStatus = async (id: number, action: string) => {
    try {
      await apiClient.put(`/stationerys/proposals/${id}/status`, { action });
      fetchProposals();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi cập nhật trạng thái');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Xoá văn phòng phẩm "${name}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await apiClient.delete(`/stationerys/${id}`);
      fetchStationerys();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi xoá văn phòng phẩm');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedStationerys.length === 0) return;
    if (!confirm(`Xoá ${selectedStationerys.length} văn phòng phẩm đã chọn? Hành động này không thể hoàn tác.`)) return;
    try {
      await apiClient.post('/stationerys/bulk-delete', { ids: selectedStationerys });
      setSelectedStationerys([]);
      fetchStationerys();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi xoá văn phòng phẩm hàng loạt');
    }
  };

  const openEdit = (c: Stationery) => {
    setEditingId(c.id);
    setImportForm({
      code: c.code, name: c.name, unit: c.unit,
      alertThreshold: c.alertThreshold,
    });
    setModal('edit');
  };

  const handleExportExcel = async (id: number) => {
    try {
      const res = await apiClient.get(`/stationerys/proposals/${id}/export`, { responseType: 'blob' });
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
  const filtered = stationerys.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );
  const lowCount = stationerys.filter(isLow).length;

  // ── Styles ────────────────────────────────────────────────────────────────
  const tabs = [
    { key: 'warehouse', label: 'Kho Văn Phòng Phẩm' },
    { key: 'proposals', label: 'Tiến Trình Đề Xuất' },
    { key: 'statistics', label: 'Thống Kê' },
    { key: 'history', label: 'Lịch Sử' },
  ];

  return (
    <div style={{ padding: '1.5rem', maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
          Quản Lý Văn Phòng Phẩm
        </h1>
        <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
          Kho dược liệu & văn phòng phẩm thí nghiệm — VIGH
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
            <a href="/hoa_chat_mau.xlsx" download className="btn" style={{ background: 'var(--primary)', color: '#fff', textDecoration: 'none', border: 'none' }}>
              ⬇ File Excel Mẫu
            </a>
            <input type="file" accept=".xlsx, .xls, .csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
            <button className="btn" onClick={() => fileInputRef.current?.click()} disabled={loading} style={{ background: 'var(--primary)', color: '#fff', border: 'none' }}>
              ⬆ {loading ? 'Đang tải...' : 'Nhập Excel'}
            </button>
            <button className="btn" onClick={handleExportInventoryExcel} disabled={loading} style={{ background: 'var(--primary)', color: '#fff', border: 'none' }}>
              ⬇ Tải Excel Hiện Tại
            </button>
            {selectedStationerys.length > 0 && (
              <button className="btn" onClick={handleBulkDelete} disabled={loading} style={{ background: '#FF4D4F', color: '#fff', border: 'none' }}>
                Xoá ({selectedStationerys.length})
              </button>
            )}
            <button className="btn" onClick={() => { setImportForm(emptyImport()); setModal('import'); }} style={{ background: 'var(--primary)', color: '#fff', border: 'none' }}>
              Nhập Văn Phòng Phẩm Thường
            </button>
            <button className="btn" onClick={() => setModal('export')} style={{ background: 'var(--primary)', color: '#fff', border: 'none' }}>
              Xuất Văn Phòng Phẩm
            </button>
            <button className="btn" onClick={handleOpenProposal} style={{ background: 'var(--primary)', color: '#fff', border: 'none' }}>
              Đề Xuất Văn Phòng Phẩm
            </button>
            <button className="btn" onClick={() => setModal('alert')} style={{ background: 'var(--primary)', color: '#fff', border: 'none' }}>
              Tuỳ Chỉnh Cảnh Báo
            </button>
          </div>

          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ padding: '1.1rem', borderLeft: '4px solid var(--primary)' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>Tổng số văn phòng phẩm</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{stationerys.length} <span style={{ fontSize: '1rem' }}>loại</span></div>
            </div>
            <div className="card" style={{ padding: '1.1rem', borderLeft: lowCount > 0 ? '4px solid #FF4D4F' : '4px solid #52C41A', background: lowCount > 0 ? '#FFF9F9' : undefined }}>
              <div style={{ color: lowCount > 0 ? '#CF1322' : 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>Lượng văn phòng phẩm cảnh báo</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: lowCount > 0 ? '#CF1322' : 'var(--text-main)' }}>{lowCount} <span style={{ fontSize: '1rem' }}>loại</span></div>
            </div>
          </div>

          {/* Search */}
          <div style={{ marginBottom: '1rem' }}>
            <input className="input-field" type="text" placeholder="Tìm theo mã hoặc tên văn phòng phẩm..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: '380px', padding: '0.5rem 0.9rem' }} />
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
                      <th style={{ padding: '0.9rem 1rem', width: '40px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={filtered.length > 0 && selectedStationerys.length === filtered.length}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedStationerys(filtered.map(c => c.id));
                            else setSelectedStationerys([]);
                          }}
                          style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                        />
                      </th>
                      <th style={{ padding: '0.9rem 1rem' }}>Mã VPP</th>
                      <th style={{ padding: '0.9rem 1rem' }}>Tên Văn Phòng Phẩm</th>
                      <th style={{ padding: '0.9rem 1rem' }}>Phòng Quản Lý</th>
                      <th style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>Đơn Giá (VNĐ)</th>
                      <th style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>Ngày Nhập</th>
                      <th style={{ padding: '0.9rem 1rem', textAlign: 'center', width: '150px' }}>Số Lượng</th>
                      <th style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>Trạng Thái</th>
                      <th style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>Thao Tác</th>
                      <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Mã</th>
                      <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Tên Văn Phòng Phẩm</th>
                      <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Tồn kho</th>
                      <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Mức cảnh báo</th>
                      <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>Ghi chú</th>
                      <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {stationerys.length === 0 ? 'Kho chưa có văn phòng phẩm nào. Bấm "Nhập Văn Phòng Phẩm" để bắt đầu!' : 'Không tìm thấy kết quả.'}
                      </td></tr>
                    ) : filtered.map(c => {
                      const low = isLow(c);
                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)', background: low ? '#FFF9F9' : '#fff' }}>
                          <td style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>
                            <input type="checkbox" checked={selectedStationerys.includes(c.id)} onChange={(e) => {
                              if (e.target.checked) setSelectedStationerys(prev => [...prev, c.id]);
                              else setSelectedStationerys(prev => prev.filter(id => id !== c.id));
                            }} style={{ cursor: 'pointer', transform: 'scale(1.2)' }} />
                          </td>
                          <td style={{ padding: '0.9rem 1rem', fontWeight: 700, color: 'var(--primary)' }}>{c.code}</td>
                          <td style={{ padding: '0.9rem 1rem', fontWeight: 600 }}>{c.name}</td>
                          <td style={{ padding: '0.9rem 1rem', textAlign: 'center', color: low ? '#CF1322' : 'var(--text-main)', fontWeight: 700 }}>
                            {c.quantity} {c.unit}
                            {low && <div style={{ fontSize: '0.75rem', color: '#CF1322', marginTop: '0.2rem', fontWeight: 600 }}>(Sắp hết)</div>}
                          </td>
                          <td style={{ padding: '0.9rem 1rem', textAlign: 'center', color: 'var(--text-main)', fontWeight: 600 }}>{c.alertThreshold}</td>
                          <td style={{ padding: '0.9rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>{c.note || '-'}</td>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              Chưa có dữ liệu thống kê xuất kho cho dự án nào.
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
                  <th style={{ padding: '0.9rem 1rem' }}>Văn Phòng Phẩm</th>
                  <th style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>Số Lượng</th>
                  <th style={{ padding: '0.9rem 1rem' }}>Mã Dự Án</th>
                  <th style={{ padding: '0.9rem 1rem' }}>Ghi Chú</th>
                  <th style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>Thời Gian</th>
                  <th style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>Thao tác</th>
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
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t.stationery.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.stationery.code}</div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 700, color: t.type === 'IMPORT' ? '#389E0D' : '#CF1322' }}>
                      {t.type === 'EXPORT' ? '-' : '+'}{t.quantity} {t.stationery.unit}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '200px' }}>{t.note || '—'}</td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{new Date(t.createdAt).toLocaleString('vi-VN')}</td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      <button className="btn btn-sm" onClick={() => handleUndoTransaction(t.id)} style={{ background: '#FF4D4F', color: '#fff', border: 'none', padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>Hoàn tác</button>
                    </td>
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
              <div className="modal-title">{modal === 'edit' ? 'Cập Nhật Văn Phòng Phẩm' : 'Nhập Văn Phòng Phẩm'}</div>
              <button className="modal-close-btn" onClick={() => setModal('none')}>Đóng</button>
            </div>
            <form onSubmit={modal === 'edit' ? handleEditSubmit : handleImportSubmit}>
              <div className="modal-body" style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="input-label">Mã Văn Phòng Phẩm (*)</label>
                    <input type="text" className="input-field" required placeholder="VPP-001" value={importForm.code} onChange={e => {
                      const code = e.target.value;
                      const existing = stationerys.find(c => c.code === code);
                      if (existing && modal === 'import') {
                        setImportForm(p => ({
                          ...p,
                          code,
                          name: existing.name,
                          unit: existing.unit,
                          alertThreshold: existing.alertThreshold,
                          note: existing.note || '',
                        }));
                      } else {
                        setImportForm(p => ({ ...p, code }));
                      }
                    }} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Tên Văn Phòng Phẩm (*)</label>
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
                    <label className="input-label">Ngưỡng Cảnh Báo</label>
                    <input type="number" step="0.01" className="input-field" required value={importForm.alertThreshold} onChange={e => setImportForm(p => ({ ...p, alertThreshold: Number(e.target.value) }))} />
                  </div>
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
              <div className="modal-title">Xuất Văn Phòng Phẩm</div>
              <button className="modal-close-btn" onClick={() => setModal('none')}>Đóng</button>
            </div>
            <form onSubmit={handleExportSubmit}>
              <div className="modal-body" style={{ display: 'grid', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Chọn Văn Phòng Phẩm (*)</label>
                  <input
                    type="text"
                    list="stationery-export-list"
                    className="input-field"
                    required
                    placeholder="Nhập mã hoặc tên văn phòng phẩm..."
                    value={exportForm.stationerySearch || ''}
                    onChange={e => {
                      const val = e.target.value;
                      const match = stationerys.find(c => `${c.code} — ${c.name}` === val);
                      setExportForm({...exportForm, stationerySearch: val, stationeryId: match ? match.id.toString() : ''});
                    }}
                  />
                  <datalist id="stationery-export-list">
                    {stationerys.map(c => (
                      <option key={c.id} value={`${c.code} — ${c.name}`} />
                    ))}
                  </datalist>
                </div>
                <div className="input-group">
                  <label className="input-label">Số Lượng Xuất (*)</label>
                  <input type="number" step="any" min="0.001" className="input-field" required value={exportForm.quantity} onChange={e => setExportForm(p => ({ ...p, quantity: e.target.value === '' ? '' : Number(e.target.value) }))} />
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
                <label className="input-label">Chọn Văn Phòng Phẩm</label>
                <input
                  type="text"
                  list="stationery-alert-list"
                  className="input-field"
                  placeholder="Nhập mã hoặc tên văn phòng phẩm..."
                  value={alertForm.stationerySearch || ''}
                  onChange={e => {
                    const val = e.target.value;
                    const match = stationerys.find(c => `${c.code} — ${c.name}` === val);
                    setAlertForm({ stationerySearch: val, stationeryId: match ? match.id.toString() : '', threshold: match ? (match.alertThreshold || 50) : 0 });
                  }}
                />
                <datalist id="stationery-alert-list">
                  {stationerys.map(c => <option key={c.id} value={`${c.code} — ${c.name}`} />)}
                </datalist>
              </div>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Ngưỡng Cảnh Báo: <strong style={{ color: 'var(--primary)' }}>{alertForm.threshold}</strong></label>
                <input type="number" step="0.01" className="input-field" value={alertForm.threshold} onChange={e => setAlertForm(p => ({ ...p, threshold: Number(e.target.value) }))} style={{ width: '100%' }} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal('none')}>Huỷ</button>
              <button className="btn btn-primary" onClick={async () => {
                if (!alertForm.stationeryId) return;
                try {
                  fetchStationerys();
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
              <div className="modal-title">Đề Xuất Văn Phòng Phẩm</div>
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
                            <input type="text" className="input-field" required placeholder="Tên văn phòng phẩm..." value={item.stationeryName} onChange={e => {
                              const newItems = [...proposalItems];
                              newItems[idx].stationeryName = e.target.value;
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
                            <input type="text" className="input-field" placeholder="Ghi chú (tuỳ chọn)" value={item.note || ''} onChange={e => {
                              const newItems = [...proposalItems];
                              newItems[idx].note = e.target.value;
                              setProposalItems(newItems);
                            }} />
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
                    <button type="button" onClick={() => setProposalItems([...proposalItems, { stationeryName: '', unit: '', quantity: '', note: '' }])} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>+ Thêm dòng</button>
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

export default StationeryManagement;
