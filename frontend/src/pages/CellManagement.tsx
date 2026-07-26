import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../api/client';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';

interface Cell {
  id: number;
  code: string;
  name: string;
  ref: string | null;
  lot: string | null;
  v: string | null;
  p: string | null;
  unit: string;
  quantity: number;
  maxQuantity: number;
  specification: number;
  invoicePrice: number;
  unitPrice: number;
  importDate: string;
  alertThreshold: number;
  department: string | null;
  location: string | null;
  note: string | null;
}

interface CellTransaction {
  id: number;
  type: 'IMPORT' | 'EXPORT';
  cellId: number;
  projectCode: string | null;
  quantity: number;
  note: string | null;
  createdAt: string;
  cell?: {
    code: string;
    name: string;
    unit: string;
    department: string | null;
    ref: string | null;
    lot: string | null;
  };
}

interface Project {
  id: number;
  code: string;
  name: string;
  department?: string | null;
}

interface CellProposalItem {
  id?: number;
  cellName: string;
  ref?: string;
  lot?: string;
  v?: string;
  p?: string;
  unit: string;
  quantity: string | number;
  phase?: string;
  projectId?: string | number;
  projectCode?: string;
  project?: {
    code: string;
    name: string;
  };
}

interface CellProposal {
  id: number;
  status: string;
  note: string | null;
  creator: { id: number; name: string; department?: string } | null;
  approver1: { id: number; name: string } | null;
  approver2: { id: number; name: string } | null;
  level1Status: string;
  level2Status: string;
  createdAt: string;
  items: CellProposalItem[];
}

const CELL_DEPARTMENTS = [
  'Phòng Công nghệ Dược',
  'Phòng Thử nghiệm Sinh học',
  'Phòng Tài nguyên và Công nghệ Sinh học',
  'Phòng Khoa học Công nghệ',
];

const emptyImport = () => ({
  code: '', name: '', ref: '', lot: '', v: '', p: '', unit: 'Ống',
  quantity: '' as number | '', maxQuantity: '' as number | '',
  specification: '' as number | '', invoicePrice: '' as number | '',
  importDate: new Date().toISOString().split('T')[0],
  alertThreshold: 10, department: 'Phòng Thử nghiệm Sinh học', location: '', note: ''
});

const fmtVND = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('vi-VN') : '--';
const isLow = (c: Cell) => {
  if (!c.maxQuantity || c.maxQuantity <= 0) return false;
  return (c.quantity / c.maxQuantity) * 100 <= c.alertThreshold;
};

export const CellManagement: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'warehouse' | 'proposals' | 'statistics' | 'history'>('warehouse');
  const [cells, setCells] = useState<Cell[]>([]);
  const [transactions, setTransactions] = useState<CellTransaction[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [statistics, setStatistics] = useState<any>(null);

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<'none' | 'import' | 'export' | 'edit' | 'alert' | 'proposal'>('none');
  const [importForm, setImportForm] = useState(emptyImport());
  const [editingId, setEditingId] = useState<number | null>(null);

  const [exportForm, setExportForm] = useState({
    cellId: '' as number | '',
    projectCode: '',
    quantity: '' as number | '',
    note: ''
  });

  const [proposals, setProposals] = useState<CellProposal[]>([]);
  const [proposalTab, setProposalTab] = useState<'my_proposals' | 'to_review' | 'reviewed'>('my_proposals');
  const [approvers, setApprovers] = useState<{ approver1: any[]; approver2: any[] }>({ approver1: [], approver2: [] });
  const [proposalForm, setProposalForm] = useState({ approver1Id: '', approver2Id: '' });
  const [proposalItems, setProposalItems] = useState<CellProposalItem[]>([
    { cellName: '', ref: '', lot: '', v: '', p: '', unit: 'Ống', quantity: '', phase: '', projectId: '' }
  ]);
  const [proposalNote, setProposalNote] = useState('');

  const [alertForm, setAlertForm] = useState({ id: 0, alertThreshold: 10, maxQuantity: 0 });
  const [alertBanner, setAlertBanner] = useState<string | null>(null);

  const fetchCells = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/cells');
      setCells(res.data);
      const low = res.data.filter(isLow);
      if (low.length > 0) {
        setAlertBanner(`Cảnh báo tồn kho: Có ${low.length} dòng tế bào dưới ngưỡng tồn kho an toàn!`);
      } else {
        setAlertBanner(null);
      }
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi tải danh sách tế bào');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await apiClient.get('/cells/transactions');
      setTransactions(res.data);
    } catch (e) {
      console.error('Error fetching transactions:', e);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await apiClient.get('/projects');
      setProjects(res.data);
    } catch (e) {
      console.error('Error fetching projects:', e);
    }
  }, []);

  const fetchStatistics = useCallback(async () => {
    try {
      const res = await apiClient.get('/cells/statistics/projects');
      setStatistics(res.data);
    } catch (e) {
      console.error('Error fetching statistics:', e);
    }
  }, []);

  const fetchProposals = useCallback(async () => {
    try {
      const res = await apiClient.get('/cells/proposals');
      setProposals(res.data);
    } catch (e) {
      console.error('Error fetching proposals:', e);
    }
  }, []);

  const fetchApprovers = useCallback(async () => {
    try {
      const res = await apiClient.get('/cells/approvers');
      setApprovers(res.data);
      if (res.data.approver1?.length > 0) {
        setProposalForm(p => ({ ...p, approver1Id: res.data.approver1[0].id }));
      }
      if (res.data.approver2?.length > 0) {
        setProposalForm(p => ({ ...p, approver2Id: res.data.approver2[0].id }));
      }
    } catch (e) {
      console.error('Error fetching approvers:', e);
    }
  }, []);

  useEffect(() => {
    fetchCells();
    fetchTransactions();
    fetchProjects();
  }, [fetchCells, fetchTransactions, fetchProjects]);

  useEffect(() => {
    if (activeTab === 'statistics') fetchStatistics();
    if (activeTab === 'proposals') {
      fetchProposals();
      fetchApprovers();
    }
    if (activeTab === 'history') fetchTransactions();
  }, [activeTab, fetchStatistics, fetchProposals, fetchApprovers, fetchTransactions]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => {
      fetchCells();
      fetchTransactions();
      if (activeTab === 'statistics') fetchStatistics();
    };
    const handleProposalUpdate = () => {
      if (activeTab === 'proposals') fetchProposals();
    };
    socket.on('cell_updated', handleUpdate);
    socket.on('cell_proposal_updated', handleProposalUpdate);
    return () => {
      socket.off('cell_updated', handleUpdate);
      socket.off('cell_proposal_updated', handleProposalUpdate);
    };
  }, [socket, fetchCells, fetchTransactions, fetchStatistics, fetchProposals, activeTab]);

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        "Mã TB": "TB-001",
        "Tên tế bào": "SH-SY5Y",
        "REF": "CRL-2266",
        "LOT": "8051234",
        "V (Thể tích/Nồng độ)": "1 mL",
        "P": "P5",
        "Đơn vị": "Ống",
        "Số lượng": 10,
        "Định mức tối đa": 100,
        "Quy cách": 1,
        "Giá hoá đơn (VNĐ)": 5000000,
        "Ngày nhập (YYYY-MM-DD)": new Date().toISOString().split('T')[0],
        "Ngưỡng cảnh báo (%)": 10,
        "Phòng ban": "Phòng Thử nghiệm Sinh học",
        "Vị trí lưu trữ": "Tủ đông -80°C (Tủ số 1)",
        "Ghi chú": "Bảo quản đúng quy định"
      }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mẫu Nhập Tế Bào");
    XLSX.writeFile(wb, "mau_nhap_te_bao.xlsx");
  };

  const handleExportWarehouseExcel = () => {
    if (cells.length === 0) {
      alert("Kho hiện tại không có dữ liệu để xuất");
      return;
    }
    const data = cells.map((c, idx) => ({
      "STT": idx + 1,
      "Mã TB": c.code,
      "Tên tế bào": c.name,
      "REF": c.ref || "",
      "LOT": c.lot || "",
      "V (Thể tích/Nồng độ)": c.v || "",
      "P": c.p || "",
      "Đơn vị": c.unit,
      "Tồn kho": c.quantity,
      "Định mức tối đa": c.maxQuantity,
      "Quy cách": c.specification,
      "Đơn giá": c.unitPrice,
      "Giá hoá đơn": c.invoicePrice,
      "Ngày nhập": fmtDate(c.importDate),
      "Phòng ban": c.department || "",
      "Vị trí": c.location || "",
      "Ghi chú": c.note || ""
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kho Tế Bào");
    XLSX.writeFile(wb, `Danh_sach_kho_te_bao_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (rows.length < 2) {
          setError('File Excel trống hoặc không đúng định dạng');
          return;
        }

        const cellsPayload = [];
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i];
          if (cols && cols.length >= 2 && cols[0] && cols[1]) {
            cellsPayload.push({
              code: String(cols[0]).trim(),
              name: String(cols[1]).trim(),
              ref: cols[2] ? String(cols[2]).trim() : '',
              lot: cols[3] ? String(cols[3]).trim() : '',
              v: cols[4] ? String(cols[4]).trim() : '',
              p: cols[5] ? String(cols[5]).trim() : '',
              unit: cols[6] ? String(cols[6]).trim() : 'Ống',
              quantity: Number(cols[7]) || 0,
              maxQuantity: Number(cols[8]) || 0,
              specification: Number(cols[9]) || 1,
              invoicePrice: Number(cols[10]) || 0,
              importDate: cols[11] ? String(cols[11]).trim() : new Date().toISOString().split('T')[0],
              alertThreshold: Number(cols[12]) || 10,
              department: cols[13] ? String(cols[13]).trim() : '',
              location: cols[14] ? String(cols[14]).trim() : '',
              note: cols[15] ? String(cols[15]).trim() : ''
            });
          }
        }

        setLoading(true);
        const res = await apiClient.post('/cells/import', { cells: cellsPayload });
        fetchCells();
        fetchTransactions();
        setError(null);
        alert(res.data.message);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Lỗi khi upload file Excel');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/cells', {
        ...importForm,
        quantity: Number(importForm.quantity),
        maxQuantity: Number(importForm.maxQuantity),
        specification: Number(importForm.specification),
        invoicePrice: Number(importForm.invoicePrice),
      });
      setModal('none');
      setImportForm(emptyImport());
      fetchCells();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi thêm tế bào');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      await apiClient.put(`/cells/${editingId}`, {
        ...importForm,
        quantity: Number(importForm.quantity),
        maxQuantity: Number(importForm.maxQuantity),
        specification: Number(importForm.specification),
        invoicePrice: Number(importForm.invoicePrice),
      });
      setModal('none');
      setEditingId(null);
      setImportForm(emptyImport());
      fetchCells();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi cập nhật tế bào');
    }
  };

  const handleExportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post(`/cells/${exportForm.cellId}/export`, {
        projectCode: exportForm.projectCode,
        quantity: Number(exportForm.quantity),
        note: exportForm.note,
      });
      setModal('none');
      setExportForm({ cellId: '', projectCode: '', quantity: '', note: '' });
      fetchCells();
      fetchTransactions();
      if (activeTab === 'statistics') fetchStatistics();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi xuất tế bào');
    }
  };

  const handleProposalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (proposalItems.length === 0) return;
    try {
      await apiClient.post('/cells/proposals', {
        note: proposalNote,
        approver1Id: proposalForm.approver1Id,
        approver2Id: proposalForm.approver2Id,
        items: proposalItems,
      });
      setModal('none');
      setProposalItems([{ cellName: '', ref: '', lot: '', v: '', p: '', unit: 'Ống', quantity: '', phase: '', projectId: '' }]);
      setProposalNote('');
      fetchProposals();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi gửi đề xuất');
    }
  };

  const handleUpdateProposalStatus = async (id: number, action: string) => {
    try {
      await apiClient.put(`/cells/proposals/${id}/status`, { level: user?.role === 'ADMIN' || user?.role === 'TruongPhong' ? 1 : 2, status: action });
      fetchProposals();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi cập nhật trạng thái đề xuất');
    }
  };

  const handleExportProposalExcel = async (id: number) => {
    try {
      const res = await apiClient.get(`/cells/proposals/${id}/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DeXuat_TeBao_${id}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (e) {
      setError('Lỗi khi tải file Excel phiếu đề xuất');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Bạn có chắc muốn xoá tế bào "${name}"?`)) return;
    try {
      await apiClient.delete(`/cells/${id}`);
      fetchCells();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi xoá tế bào');
    }
  };

  const openEdit = (c: Cell) => {
    setEditingId(c.id);
    setImportForm({
      code: c.code,
      name: c.name,
      ref: c.ref || '',
      lot: c.lot || '',
      v: c.v || '',
      p: c.p || '',
      unit: c.unit,
      quantity: c.quantity,
      maxQuantity: c.maxQuantity,
      specification: c.specification,
      invoicePrice: c.invoicePrice,
      importDate: c.importDate.split('T')[0],
      alertThreshold: c.alertThreshold,
      department: c.department || '',
      location: c.location || '',
      note: c.note || ''
    });
    setModal('edit');
  };

  const handleAlertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.put(`/cells/${alertForm.id}`, {
        alertThreshold: Number(alertForm.alertThreshold),
        maxQuantity: Number(alertForm.maxQuantity),
      });
      setModal('none');
      fetchCells();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi lưu định mức');
    }
  };

  const filtered = cells.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    (c.ref && c.ref.toLowerCase().includes(search.toLowerCase())) ||
    (c.lot && c.lot.toLowerCase().includes(search.toLowerCase()))
  );
  const lowCount = cells.filter(isLow).length;
  const totalValue = cells.reduce((s, c) => s + c.unitPrice * c.quantity, 0);

  const tabs = [
    { key: 'warehouse', label: 'Kho Tế Bào' },
    { key: 'proposals', label: 'Tiến Trình Đề Xuất' },
    { key: 'statistics', label: 'Thống Kê' },
    { key: 'history', label: 'Lịch Sử' },
  ];

  return (
    <div style={{ padding: '1.5rem', maxWidth: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
          Quản Lý Tế Bào
        </h1>
        <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
          Kho chủng dòng tế bào & sinh phẩm nghiên cứu — VIGH
        </p>
      </div>

      {/* Alert Banner */}
      {alertBanner && (
        <div style={{ background: '#FFF1F0', border: '1px solid #FFA39E', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#CF1322', fontWeight: 600 }}>
          <span>{alertBanner}</span>
          <button onClick={() => setAlertBanner(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#CF1322' }}>Đóng</button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div style={{ background: '#FFF2F0', border: '1px solid #FFCCC7', color: '#FF4D4F', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#FF4D4F' }}>Đóng</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border-color)', marginBottom: '1.5rem', gap: '0.5rem' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            style={{
              padding: '0.7rem 1.25rem',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === t.key ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === t.key ? 700 : 500,
              cursor: 'pointer',
              fontSize: '0.95rem',
              marginBottom: '-2px',
              transition: 'all 0.2s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: KHO TẾ BÀO ── */}
      {activeTab === 'warehouse' && (
        <>
          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <button onClick={handleDownloadTemplate} className="btn" style={{ background: 'var(--primary)', color: '#fff', border: 'none' }}>
              Tải File Excel Mẫu
            </button>
            <input type="file" accept=".xlsx, .xls, .csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
            <button className="btn" onClick={() => fileInputRef.current?.click()} disabled={loading} style={{ background: 'var(--primary)', color: '#fff', border: 'none' }}>
              {loading ? 'Đang tải...' : 'Nhập Excel'}
            </button>
            <button className="btn" onClick={handleExportWarehouseExcel} style={{ background: 'var(--primary)', color: '#fff', border: 'none' }}>
              Xuất Excel Kho Tế Bào
            </button>
            <button className="btn" onClick={() => { setImportForm(emptyImport()); setModal('import'); }} style={{ background: 'var(--primary)', color: '#fff', border: 'none' }}>
              Thêm Tế Bào Mới
            </button>
            <button className="btn" onClick={() => setModal('export')} style={{ background: 'var(--primary)', color: '#fff', border: 'none' }}>
              Xuất Tế Bào Cho Dự Án
            </button>
            <button className="btn" onClick={() => setModal('proposal')} style={{ background: 'var(--primary)', color: '#fff', border: 'none' }}>
              Đề Xuất Mua Tế Bào
            </button>
          </div>

          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tổng số dòng tế bào</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.25rem' }}>{cells.length}</div>
            </div>
            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Dòng tế bào dưới ngưỡng an toàn</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: lowCount > 0 ? '#CF1322' : '#389E0D', marginTop: '0.25rem' }}>{lowCount}</div>
            </div>
            <div className="card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tổng giá trị kho tế bào</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.25rem' }}>{fmtVND(totalValue)}</div>
            </div>
          </div>

          {/* Search Bar */}
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Tìm kiếm theo mã, tên tế bào, REF, LOT..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field"
              style={{ maxWidth: '400px' }}
            />
          </div>

          {/* Table */}
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải dữ liệu kho tế bào...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Không tìm thấy tế bào nào trong kho</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid var(--border-color)', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                      <th style={{ padding: '0.9rem 1rem' }}>Mã TB</th>
                      <th style={{ padding: '0.9rem 1rem' }}>Tên Tế Bào / Vị Trí</th>
                      <th style={{ padding: '0.9rem 1rem' }}>REF / LOT</th>
                      <th style={{ padding: '0.9rem 1rem' }}>V (Thể tích) / P</th>
                      <th style={{ padding: '0.9rem 1rem' }}>Phòng Ban</th>
                      <th style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>Đơn Giá</th>
                      <th style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>Ngày Nhập</th>
                      <th style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>Tồn Kho</th>
                      <th style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>Trạng Thái</th>
                      <th style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(c => {
                      const low = isLow(c);
                      return (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)', background: low ? '#FFF9F9' : '#fff' }}>
                          <td style={{ padding: '0.9rem 1rem', fontWeight: 700, color: 'var(--primary)' }}>{c.code}</td>
                          <td style={{ padding: '0.9rem 1rem' }}>
                            <div style={{ fontWeight: 600 }}>{c.name}</div>
                            {c.location && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.location}</div>}
                            {c.note && <div style={{ fontSize: '0.78rem', color: 'var(--primary)', fontStyle: 'italic' }}>{c.note}</div>}
                          </td>
                          <td style={{ padding: '0.9rem 1rem', fontSize: '0.85rem' }}>
                            <div><strong>REF:</strong> {c.ref || '--'}</div>
                            <div><strong>LOT:</strong> {c.lot || '--'}</div>
                          </td>
                          <td style={{ padding: '0.9rem 1rem', fontSize: '0.85rem' }}>
                            <div><strong>V:</strong> {c.v || '--'}</div>
                            <div><strong>P:</strong> {c.p || '--'}</div>
                          </td>
                          <td style={{ padding: '0.9rem 1rem' }}>
                            {c.department ? (
                              <span style={{ background: 'rgba(52,144,139,0.08)', color: 'var(--primary)', padding: '0.15rem 0.6rem', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {c.department}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>Chưa phân</span>
                            )}
                          </td>
                          <td style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{fmtVND(c.unitPrice)}/{c.unit}</div>
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
                              <button onClick={() => { setAlertForm({ id: c.id, alertThreshold: c.alertThreshold, maxQuantity: c.maxQuantity }); setModal('alert'); }} style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>Định mức</button>
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
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: '#F8FAFC' }}>
            <button
              onClick={() => setProposalTab('my_proposals')}
              style={{
                padding: '0.85rem 1.25rem',
                border: 'none',
                background: proposalTab === 'my_proposals' ? '#fff' : 'transparent',
                fontWeight: proposalTab === 'my_proposals' ? 700 : 500,
                color: proposalTab === 'my_proposals' ? 'var(--primary)' : 'var(--text-muted)',
                borderTop: proposalTab === 'my_proposals' ? '2px solid var(--primary)' : '2px solid transparent',
                cursor: 'pointer'
              }}
            >
              Đề Xuất Của Tôi
            </button>
          </div>

          <div style={{ padding: '1.25rem' }}>
            {proposals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Chưa có phiếu đề xuất nào</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {proposals.map(p => (
                  <div key={p.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.25rem', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <span style={{ fontWeight: 700, color: 'var(--primary)', marginRight: '0.5rem' }}>Phiếu Đề Xuất #{p.id}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Người tạo: {p.creator?.name || '---'} | Ngày: {fmtDate(p.createdAt)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          background: p.status === 'APPROVED' ? '#F6FFED' : p.status === 'REJECTED' ? '#FFF1F0' : '#FFFBE6',
                          color: p.status === 'APPROVED' ? '#389E0D' : p.status === 'REJECTED' ? '#CF1322' : '#D46B08',
                          border: `1px solid ${p.status === 'APPROVED' ? '#B7EB8F' : p.status === 'REJECTED' ? '#FFA39E' : '#FFE58F'}`
                        }}>
                          {p.status === 'APPROVED' ? 'Đã Phê Duyệt' : p.status === 'REJECTED' ? 'Từ Chối' : p.status === 'PENDING_LEVEL_2' ? 'Chờ Duyệt Cấp 2' : 'Chờ Duyệt Cấp 1'}
                        </span>
                        <button
                          onClick={() => handleExportProposalExcel(p.id)}
                          style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid var(--primary)', background: '#fff', color: 'var(--primary)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                        >
                          Tải Phiếu Excel
                        </button>
                        {(user?.role === 'ADMIN' || user?.role === 'TruongPhong' || ['VienTruong', 'VienPho', 'SuperAdmin'].includes(user?.role || '')) && p.status !== 'APPROVED' && p.status !== 'REJECTED' && (
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button onClick={() => handleUpdateProposalStatus(p.id, 'APPROVED')} style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', border: 'none', background: '#389E0D', color: '#fff', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>Duyệt</button>
                            <button onClick={() => handleUpdateProposalStatus(p.id, 'REJECTED')} style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', border: 'none', background: '#CF1322', color: '#fff', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>Từ chối</button>
                          </div>
                        )}
                      </div>
                    </div>

                    {p.note && <div style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-main)' }}><strong>Nội dung:</strong> {p.note}</div>}

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>STT</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Tên tế bào / REF / LOT / V / P</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Đơn vị</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Số lượng</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>Dự án sử dụng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.items?.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '0.5rem' }}>{idx + 1}</td>
                            <td style={{ padding: '0.5rem', fontWeight: 600 }}>
                              {item.cellName}
                              {(item.ref || item.lot || item.v || item.p) && (
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                  {item.ref && `REF: ${item.ref} `}
                                  {item.lot && `| LOT: ${item.lot} `}
                                  {item.v && `| V: ${item.v} `}
                                  {item.p && `| P: ${item.p}`}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>{item.unit}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 700 }}>{item.quantity}</td>
                            <td style={{ padding: '0.5rem' }}>{item.project ? `${item.project.code} - ${item.project.name}` : item.projectCode || '---'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: THỐNG KÊ ── */}
      {activeTab === 'statistics' && statistics && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tổng số lần xuất sử dụng</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.25rem' }}>{statistics.totalExportCount || 0} lần</div>
            </div>
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tổng giá trị tế bào đã xuất</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#389E0D', marginTop: '0.25rem' }}>{fmtVND(statistics.totalExportValue || 0)}</div>
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-main)' }}>Thống kê sử dụng theo đề tài</h3>
            {statistics.byProject?.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Chưa có dữ liệu xuất kho tế bào cho đề tài nào</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '2px solid var(--border-color)', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Mã Đề Tài</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Số Lần Xuất</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Tổng Giá Trị</th>
                  </tr>
                </thead>
                <tbody>
                  {statistics.byProject?.map((p: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--primary)' }}>{p.projectCode}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{p.exportCount}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 700, color: '#389E0D' }}>{fmtVND(p.totalValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: LỊCH SỬ ── */}
      {activeTab === 'history' && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          {transactions.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có lịch sử giao dịch kho tế bào</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '2px solid var(--border-color)', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '0.85rem 1rem' }}>Ngày Giờ</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Loại</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Tế Bào / REF / LOT</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Phòng Ban</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Số Lượng</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Đề Tài / Ghi Chú</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {new Date(t.createdAt).toLocaleString('vi-VN')}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{ background: t.type === 'IMPORT' ? '#F6FFED' : '#FFF1F0', color: t.type === 'IMPORT' ? '#389E0D' : '#CF1322', border: `1px solid ${t.type === 'IMPORT' ? '#B7EB8F' : '#FFA39E'}`, borderRadius: '10px', padding: '0.15rem 0.65rem', fontSize: '0.8rem', fontWeight: 700 }}>
                          {t.type === 'IMPORT' ? 'Nhập' : 'Xuất'}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{t.cell?.code || '---'}</div>
                        <div style={{ fontSize: '0.85rem' }}>{t.cell?.name}</div>
                        {(t.cell?.ref || t.cell?.lot) && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {t.cell?.ref && `REF: ${t.cell.ref} `}
                            {t.cell?.lot && `| LOT: ${t.cell.lot}`}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem' }}>{t.cell?.department || '---'}</td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 700, color: t.type === 'IMPORT' ? '#389E0D' : '#CF1322' }}>
                        {t.type === 'IMPORT' ? '+' : '-'}{t.quantity} {t.cell?.unit}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem' }}>
                        {t.projectCode && <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{t.projectCode}</div>}
                        {t.note && <div style={{ color: 'var(--text-muted)' }}>{t.note}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── MODALS ── */}

      {/* Import / Edit Modal */}
      {(modal === 'import' || modal === 'edit') && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--primary)' }}>
              {modal === 'edit' ? 'Cập Nhật Thông Tin Tế Bào' : 'Thêm Tế Bào Mới Vào Kho'}
            </h2>
            <form onSubmit={modal === 'edit' ? handleEditSubmit : handleImportSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Mã quản lý *</label>
                  <input type="text" className="input-field" required placeholder="TB-001" value={importForm.code} disabled={modal === 'edit'} onChange={e => setImportForm(p => ({ ...p, code: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Tên tế bào / chủng dòng *</label>
                  <input type="text" className="input-field" required placeholder="VD: SH-SY5Y, HEK293..." value={importForm.name} onChange={e => setImportForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>REF (Catalog number)</label>
                  <input type="text" className="input-field" placeholder="VD: CRL-2266" value={importForm.ref} onChange={e => setImportForm(p => ({ ...p, ref: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>LOT (Số lô)</label>
                  <input type="text" className="input-field" placeholder="VD: 8051234" value={importForm.lot} onChange={e => setImportForm(p => ({ ...p, lot: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>V (Thể tích / Nồng độ / Độ sống)</label>
                  <input type="text" className="input-field" placeholder="VD: 1 mL, 1x10^6 cells/mL..." value={importForm.v} onChange={e => setImportForm(p => ({ ...p, v: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>P</label>
                  <input type="text" className="input-field" placeholder="VD: P5, P12..." value={importForm.p} onChange={e => setImportForm(p => ({ ...p, p: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Đơn vị tính *</label>
                  <input type="text" className="input-field" required placeholder="Ống, Vial, Chai..." value={importForm.unit} onChange={e => setImportForm(p => ({ ...p, unit: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Số lượng tồn kho ban đầu *</label>
                  <input type="number" step="any" min="0" className="input-field" required value={importForm.quantity} onChange={e => setImportForm(p => ({ ...p, quantity: e.target.value === '' ? '' : Number(e.target.value) }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Định mức tối đa (kho) *</label>
                  <input type="number" step="any" min="0" className="input-field" required value={importForm.maxQuantity} onChange={e => setImportForm(p => ({ ...p, maxQuantity: e.target.value === '' ? '' : Number(e.target.value) }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Quy cách (đóng gói) *</label>
                  <input type="number" step="any" min="0.001" className="input-field" required placeholder="VD: 1" value={importForm.specification} onChange={e => setImportForm(p => ({ ...p, specification: e.target.value === '' ? '' : Number(e.target.value) }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Giá trị hoá đơn (VNĐ) *</label>
                  <input type="number" step="any" min="0" className="input-field" required placeholder="Tổng tiền" value={importForm.invoicePrice} onChange={e => setImportForm(p => ({ ...p, invoicePrice: e.target.value === '' ? '' : Number(e.target.value) }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Ngày nhập kho *</label>
                  <input type="date" className="input-field" required value={importForm.importDate} onChange={e => setImportForm(p => ({ ...p, importDate: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Ngưỡng cảnh báo tồn (%) *</label>
                  <input type="number" step="any" min="0" max="100" className="input-field" required value={importForm.alertThreshold} onChange={e => setImportForm(p => ({ ...p, alertThreshold: Number(e.target.value) }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Phòng ban quản lý</label>
                  <select className="input-field" value={importForm.department} onChange={e => setImportForm(p => ({ ...p, department: e.target.value }))}>
                    {CELL_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Vị trí lưu trữ (Tủ đông / Nitơ lỏng...)</label>
                  <input type="text" className="input-field" placeholder="VD: Tủ -80°C số 2, Ngăn 3..." value={importForm.location} onChange={e => setImportForm(p => ({ ...p, location: e.target.value }))} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Ghi chú thêm</label>
                  <textarea className="input-field" rows={2} placeholder="Lưu ý bảo quản, trạng thái..." value={importForm.note} onChange={e => setImportForm(p => ({ ...p, note: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setModal('none')} className="btn" style={{ background: '#F1F5F9', color: 'var(--text-main)', border: 'none' }}>Hủy</button>
                <button type="submit" className="btn" style={{ background: 'var(--primary)', color: '#fff', border: 'none' }}>Lưu Dữ Liệu</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {modal === 'export' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--primary)' }}>Xuất Tế Bào Cho Dự Án</h2>
            <form onSubmit={handleExportSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Chọn dòng tế bào *</label>
                <select className="input-field" required value={exportForm.cellId} onChange={e => setExportForm(p => ({ ...p, cellId: Number(e.target.value) }))}>
                  <option value="">-- Chọn tế bào --</option>
                  {cells.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name} (Tòn: {c.quantity} {c.unit})</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Đề tài sử dụng *</label>
                <select className="input-field" required value={exportForm.projectCode} onChange={e => setExportForm(p => ({ ...p, projectCode: e.target.value }))}>
                  <option value="">-- Chọn đề tài --</option>
                  {projects.map(p => <option key={p.id} value={p.code}>{p.code} - {p.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Số lượng xuất *</label>
                <input type="number" step="any" min="0.001" className="input-field" required placeholder="0" value={exportForm.quantity} onChange={e => setExportForm(p => ({ ...p, quantity: e.target.value === '' ? '' : Number(e.target.value) }))} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Ghi chú / Mục đích</label>
                <textarea className="input-field" rows={2} placeholder="Ghi chú thêm khi xuất kho..." value={exportForm.note} onChange={e => setExportForm(p => ({ ...p, note: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setModal('none')} className="btn" style={{ background: '#F1F5F9', color: 'var(--text-main)', border: 'none' }}>Hủy</button>
                <button type="submit" className="btn" style={{ background: '#CF1322', color: '#fff', border: 'none' }}>Xác Nhận Xuất</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Proposal Modal */}
      {modal === 'proposal' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--primary)' }}>Tạo Phiếu Đề Xuất Mua Tế Bào</h2>
            <form onSubmit={handleProposalSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Người duyệt Cấp 1 (Phòng KHCN/Admin) *</label>
                  <select className="input-field" required value={proposalForm.approver1Id} onChange={e => setProposalForm(p => ({ ...p, approver1Id: e.target.value }))}>
                    <option value="">-- Chọn Trưởng phòng / KHCN --</option>
                    {approvers.approver1?.map(u => <option key={u.id} value={u.id}>{u.name} ({u.department || 'Admin'})</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Người duyệt Cấp 2 (Ban Lãnh Đạo) *</label>
                  <select className="input-field" required value={proposalForm.approver2Id} onChange={e => setProposalForm(p => ({ ...p, approver2Id: e.target.value }))}>
                    <option value="">-- Chọn Viện Trưởng / Viện Phó --</option>
                    {approvers.approver2?.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role === 'VienTruong' ? 'Viện Trưởng' : 'Viện Phó'})</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Nội dung đề xuất / Mục đích chung</label>
                <textarea className="input-field" rows={2} placeholder="Đề nghị mua sắm dòng tế bào và sinh phẩm phục vụ nghiên cứu..." value={proposalNote} onChange={e => setProposalNote(e.target.value)} />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>Danh sách dòng tế bào đề xuất mua *</label>
                  <button
                    type="button"
                    onClick={() => setProposalItems([...proposalItems, { cellName: '', ref: '', lot: '', v: '', p: '', unit: 'Ống', quantity: '', phase: '', projectId: '' }])}
                    style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', background: 'var(--primary)', color: '#fff', border: 'none', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    + Thêm Dòng
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {proposalItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr 1.2fr auto', gap: '0.5rem', alignItems: 'center', background: '#F8FAFC', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <input type="text" placeholder="Tên tế bào *" required className="input-field" value={item.cellName} onChange={e => {
                        const next = [...proposalItems]; next[idx].cellName = e.target.value; setProposalItems(next);
                      }} />
                      <input type="text" placeholder="REF" className="input-field" value={item.ref} onChange={e => {
                        const next = [...proposalItems]; next[idx].ref = e.target.value; setProposalItems(next);
                      }} />
                      <input type="text" placeholder="LOT" className="input-field" value={item.lot} onChange={e => {
                        const next = [...proposalItems]; next[idx].lot = e.target.value; setProposalItems(next);
                      }} />
                      <input type="text" placeholder="V" className="input-field" value={item.v} onChange={e => {
                        const next = [...proposalItems]; next[idx].v = e.target.value; setProposalItems(next);
                      }} />
                      <input type="text" placeholder="P" className="input-field" value={item.p} onChange={e => {
                        const next = [...proposalItems]; next[idx].p = e.target.value; setProposalItems(next);
                      }} />
                      <input type="text" placeholder="Đơn vị *" required className="input-field" value={item.unit} onChange={e => {
                        const next = [...proposalItems]; next[idx].unit = e.target.value; setProposalItems(next);
                      }} />
                      <input type="number" step="any" min="0.001" placeholder="SL *" required className="input-field" value={item.quantity} onChange={e => {
                        const next = [...proposalItems]; next[idx].quantity = e.target.value; setProposalItems(next);
                      }} />
                      <select className="input-field" value={item.projectId} onChange={e => {
                        const next = [...proposalItems]; next[idx].projectId = e.target.value; setProposalItems(next);
                      }}>
                        <option value="">-- Đề tài --</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
                      </select>
                      {proposalItems.length > 1 && (
                        <button type="button" onClick={() => setProposalItems(proposalItems.filter((_, i) => i !== idx))} style={{ background: '#FFCCC7', color: '#FF4D4F', border: 'none', borderRadius: '6px', padding: '0.45rem 0.6rem', fontWeight: 700, cursor: 'pointer' }}>X</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setModal('none')} className="btn" style={{ background: '#F1F5F9', color: 'var(--text-main)', border: 'none' }}>Hủy</button>
                <button type="submit" className="btn" style={{ background: 'var(--primary)', color: '#fff', border: 'none' }}>Gửi Phiếu Đề Xuất</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Alert Threshold Modal */}
      {modal === 'alert' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ width: '100%', maxWidth: '450px', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--primary)' }}>Tuỳ Chỉnh Định Mức Cảnh Báo</h2>
            <form onSubmit={handleAlertSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Định mức tối đa *</label>
                <input type="number" step="any" min="0" className="input-field" required value={alertForm.maxQuantity} onChange={e => setAlertForm(p => ({ ...p, maxQuantity: Number(e.target.value) }))} />
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>Ngưỡng cảnh báo (%) *</label>
                <input type="number" step="any" min="0" max="100" className="input-field" required value={alertForm.alertThreshold} onChange={e => setAlertForm(p => ({ ...p, alertThreshold: Number(e.target.value) }))} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setModal('none')} className="btn" style={{ background: '#F1F5F9', color: 'var(--text-main)', border: 'none' }}>Hủy</button>
                <button type="submit" className="btn" style={{ background: 'var(--primary)', color: '#fff', border: 'none' }}>Lưu Thay Đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CellManagement;
