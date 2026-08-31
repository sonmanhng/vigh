import React, { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../api/client';
import { 
  weeklyReportService, 
  type WeeklyReport, 
  type WeeklyReportResultItem, 
  type WeeklyReportPlanItem 
} from '../services/weeklyReport.service';

interface UserOption {
  id: number;
  name: string;
  email: string;
  department?: string;
  role?: string;
}

interface ProjectOption {
  id: number;
  name: string;
  code?: string;
  topicCode?: string;
}

export const WeeklyReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'submit' | 'manage'>('submit');
  const [manageFilter, setManageFilter] = useState<'received' | 'sent'>('received');

  // Data lists for form options
  const [users, setUsers] = useState<UserOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Form State
  const [recipientId, setRecipientId] = useState<number | ''>('');
  const [results, setResults] = useState<WeeklyReportResultItem[]>([
    { projectId: null, description: '', file: null, fileName: '' }
  ]);
  const [plans, setPlans] = useState<WeeklyReportPlanItem[]>([
    { projectId: null, customTitle: '', description: '' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manage State
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [expandedReports, setExpandedReports] = useState<Record<number, boolean>>({});

  // Filter & Sort State
  const [sortMode, setSortMode] = useState<'date_desc' | 'date_asc' | 'person'>('date_desc');
  const [filterProject, setFilterProject] = useState<number | 'all'>('all');
  const [filterPerson, setFilterPerson] = useState<number | 'all'>('all');

  // Synthesis State
  const [showSynthesisModal, setShowSynthesisModal] = useState(false);
  const [synthStartDate, setSynthStartDate] = useState('');
  const [synthEndDate, setSynthEndDate] = useState('');
  const [synthProject, setSynthProject] = useState<number | 'all'>('all');
  const [synthUser, setSynthUser] = useState<number | 'all'>('all');
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Preview State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewFileName, setPreviewFileName] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const filteredAndSortedReports = useMemo(() => {
    let result = [...reports];

    // Filter by project
    if (filterProject !== 'all') {
      result = result.filter(r => 
        r.results.some(res => res.projectId === filterProject) || 
        r.plans.some(plan => plan.projectId === filterProject)
      );
    }

    // Filter by person
    if (filterPerson !== 'all') {
      result = result.filter(r => r.reporterId === filterPerson);
    }

    // Sort
    if (sortMode === 'date_desc') {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortMode === 'date_asc') {
      result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortMode === 'person') {
      result.sort((a, b) => a.reporter.name.localeCompare(b.reporter.name));
    }

    return result;
  }, [reports, filterProject, filterPerson, sortMode]);

  const handleDownloadDocx = async (reportId: number) => {
    try {
      const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/weekly-reports/${reportId}/docx`;
      const token = localStorage.getItem('token');
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Failed to download DOCX');
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Bao_cao_tuan_${reportId}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi xuất báo cáo ra Word');
    }
  };

  const handleSynthesisDownload = async () => {
    try {
      setIsSynthesizing(true);
      let url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/weekly-reports/synthesis/docx?`;
      if (synthStartDate) url += `startDate=${synthStartDate}&`;
      if (synthEndDate) url += `endDate=${synthEndDate}&`;
      if (synthProject !== 'all') url += `projectId=${synthProject}&`;
      if (synthUser !== 'all') url += `userId=${synthUser}&`;
      
      const token = localStorage.getItem('token');
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Failed to download synthesis');
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Tong_hop_bao_cao_${Date.now()}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setShowSynthesisModal(false);
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi xuất báo cáo tổng hợp');
    } finally {
      setIsSynthesizing(false);
    }
  };

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch (e) {}
    }
    fetchUsersAndProjects();
  }, []);

  useEffect(() => {
    if (activeTab === 'manage') {
      fetchReports();
    }
  }, [activeTab, manageFilter]);

  const fetchUsersAndProjects = async () => {
    try {
      const [usersRes, projectsRes] = await Promise.all([
        apiClient.get('/users'),
        apiClient.get('/projects')
      ]);
      setUsers(usersRes.data || []);
      setProjects(projectsRes.data || []);
    } catch (err) {
      console.error('Lỗi khi tải danh sách người dùng và đề tài:', err);
    }
  };

  const fetchReports = async () => {
    setIsLoadingReports(true);
    try {
      const data = await weeklyReportService.getReports(manageFilter);
      setReports(data || []);
    } catch (err) {
      console.error('Lỗi khi tải danh sách báo cáo:', err);
    } finally {
      setIsLoadingReports(false);
    }
  };

  // Form Handlers
  const handleAddResultCard = () => {
    setResults(prev => [...prev, { projectId: null, description: '', file: null, fileName: '' }]);
  };

  const handleRemoveResultCard = (index: number) => {
    if (results.length === 1) {
      alert('Cần ít nhất 1 mục kết quả trong báo cáo!');
      return;
    }
    setResults(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleResultChange = (
    index: number,
    fieldOrFields: keyof WeeklyReportResultItem | Partial<WeeklyReportResultItem>,
    value?: any
  ) => {
    setResults(prev => {
      return prev.map((item, i) => {
        if (i !== index) return item;
        if (typeof fieldOrFields === 'string') {
          return { ...item, [fieldOrFields]: value };
        } else {
          return { ...item, ...fieldOrFields };
        }
      });
    });
  };

  const handleFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      handleResultChange(index, { file, fileName: file.name });
    }
  };

  const handleAddPlanCard = () => {
    setPlans(prev => [...prev, { projectId: null, customTitle: '', description: '' }]);
  };

  const handleRemovePlanCard = (index: number) => {
    if (plans.length === 1) {
      alert('Cần ít nhất 1 mục kế hoạch cho tuần tới!');
      return;
    }
    setPlans(prev => prev.filter((_, idx) => idx !== index));
  };

  const handlePlanChange = (
    index: number,
    fieldOrFields: keyof WeeklyReportPlanItem | Partial<WeeklyReportPlanItem>,
    value?: any
  ) => {
    setPlans(prev => {
      return prev.map((item, i) => {
        if (i !== index) return item;
        if (typeof fieldOrFields === 'string') {
          return { ...item, [fieldOrFields]: value };
        } else {
          return { ...item, ...fieldOrFields };
        }
      });
    });
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId) {
      alert('Vui lòng chọn người nhận báo cáo!');
      return;
    }

    // Validate
    const hasEmptyResult = results.some(r => !r.description?.trim());
    if (hasEmptyResult) {
      alert('Vui lòng nhập mô tả cho tất cả thẻ Kết quả trong tuần!');
      return;
    }

    const hasEmptyPlan = plans.some(p => !p.description?.trim());
    if (hasEmptyPlan) {
      alert('Vui lòng nhập mô tả cho tất cả thẻ Kế hoạch tuần tới!');
      return;
    }

    setIsSubmitting(true);
    try {
      await weeklyReportService.createReport(Number(recipientId), results, plans);
      alert('Nộp báo cáo tuần thành công!');
      // Reset form
      setRecipientId('');
      setResults([{ projectId: null, description: '', file: null, fileName: '' }]);
      setPlans([{ projectId: null, customTitle: '', description: '' }]);
      // Switch to manage tab -> sent reports
      setManageFilter('sent');
      setActiveTab('manage');
    } catch (err: any) {
      console.error('Lỗi khi gửi báo cáo:', err);
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi nộp báo cáo tuần.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReport = async (id: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa báo cáo này không?')) return;
    try {
      await weeklyReportService.deleteReport(id);
      setReports(reports.filter(r => r.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể xóa báo cáo.');
    }
  };

  const toggleExpandReport = (id: number) => {
    setExpandedReports(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePreview = async (resultId: number, fileName: string) => {
    try {
      setIsPreviewLoading(true);
      setPreviewFileName(fileName);
      setPreviewModalOpen(true);
      
      const { url } = await weeklyReportService.previewFile(resultId);
      setPreviewUrl(url);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể xem trước file này. Vui lòng tải về.');
      setPreviewModalOpen(false);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewModalOpen(false);
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
  };

  return (
    <div className="content-area" style={{ padding: '1.5rem 2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
          Hệ Thống Báo Cáo Công Việc Tuần
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Tổng hợp kết quả, đính kèm tài liệu và đăng ký kế hoạch hoạt động theo tuần cho Lãnh đạo & Chủ nhiệm
        </p>
      </div>

      {/* Main Tab Switcher - Styled like ProjectDetail.tsx Chuyên môn / Hành chính */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid var(--border-color)', marginBottom: '1.75rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('submit')}
          style={{
            backgroundColor: activeTab === 'submit' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'submit' ? '#FFFFFF' : 'var(--text-muted)',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            borderTop: activeTab === 'submit' ? '3px solid var(--primary-light)' : '3px solid transparent',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === 'submit' ? 'var(--shadow-sm)' : 'none'
          }}
        >
          Nộp báo cáo tuần
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('manage')}
          style={{
            backgroundColor: activeTab === 'manage' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'manage' ? '#FFFFFF' : 'var(--text-muted)',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            borderTop: activeTab === 'manage' ? '3px solid var(--primary-light)' : '3px solid transparent',
            transition: 'all 0.2s ease',
            boxShadow: activeTab === 'manage' ? 'var(--shadow-sm)' : 'none'
          }}
        >
          Quản lý báo cáo
        </button>
      </div>

      {/* TAB 1: SUBMIT REPORT */}
      {activeTab === 'submit' && (
        <form onSubmit={handleSubmitReport}>
          {/* Info Banner box like ProjectDetail.tsx */}
          <div style={{
            backgroundColor: 'rgba(52, 144, 139, 0.08)',
            border: '1px solid rgba(52, 144, 139, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem 1.25rem',
            marginBottom: '1.75rem',
            color: 'var(--text-main)',
            fontSize: '0.9rem',
            lineHeight: 1.6
          }}>
            <strong style={{ color: 'var(--primary)', fontWeight: 700 }}>Hướng dẫn Nộp báo cáo tuần:</strong> Tổng hợp đầy đủ tiến độ các Nội dung và công việc đã hoàn thành trong tuần, đính kèm file minh chứng kết quả và đăng ký phương án triển khai cho tuần tới. Dữ liệu báo cáo được đồng bộ trực tiếp với Cơ sở dữ liệu và gửi thông báo đến Lãnh đạo.
          </div>

          {/* Card 0: Recipient Selector */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
            padding: '1.5rem',
            marginBottom: '2rem',
            borderLeft: '4px solid var(--primary)'
          }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Chọn người nhận báo cáo (Lãnh đạo / Chủ nhiệm / Quản lý): <span style={{ color: 'var(--accent-red)' }}>*</span>
            </label>
            <select
              className="input-field"
              style={{ maxWidth: '500px', fontWeight: 500, width: '100%' }}
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value ? Number(e.target.value) : '')}
              required
            >
              <option value="">-- Bấm để chọn người nhận báo cáo --</option>
              {users
                .filter(u => u.id !== currentUser?.id)
                .map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.department || 'Phòng ban chung'} ({u.role || 'Cán bộ'})
                  </option>
                ))}
            </select>
          </div>

          {/* Section 1: Weekly Results */}
          <div style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <span style={{ backgroundColor: 'var(--primary)', color: '#FFFFFF', width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem' }}>
                I
              </span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, textTransform: 'uppercase' }}>
                Kết quả thực hiện trong tuần
              </h2>
            </div>

            {results.map((item, idx) => (
              <div key={idx} style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)',
                padding: '1.5rem',
                marginBottom: '1.25rem',
                borderLeft: '4px solid var(--primary)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px dashed var(--border-color)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1rem', textTransform: 'uppercase' }}>
                    Thẻ kết quả #{idx + 1}
                  </span>
                  {results.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveResultCard(idx)}
                      style={{
                        backgroundColor: '#FEE2E2',
                        color: '#DC2626',
                        border: 'none',
                        borderRadius: '20px',
                        padding: '0.35rem 0.9rem',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        transition: 'opacity 0.2s'
                      }}
                    >
                      Xóa thẻ
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                      Chọn đề tài liên quan (tùy chọn):
                    </label>
                    <select
                      className="input-field"
                      style={{ width: '100%' }}
                      value={item.projectId || ''}
                      onChange={(e) => handleResultChange(idx, 'projectId', e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">-- Công việc chung / Khác (Không thuộc đề tài nào) --</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.topicCode ? `[${p.topicCode}] ` : ''}{p.name} {p.code ? `(${p.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                      Tải lên file minh chứng / kết quả (lưu hệ thống):
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <label style={{
                        padding: '0.6rem 1.2rem',
                        backgroundColor: '#FFFFFF',
                        color: 'var(--primary)',
                        border: '1.5px solid var(--primary)',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        display: 'inline-block',
                        transition: 'all 0.2s'
                      }}>
                        {item.fileName ? 'Thay file khác...' : 'Chọn file đính kèm...'}
                        <input
                          type="file"
                          style={{ display: 'none' }}
                          onChange={(e) => handleFileChange(idx, e)}
                        />
                      </label>
                      {item.fileName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#137333', fontWeight: 600, backgroundColor: '#E6F4EA', padding: '0.4rem 0.8rem', borderRadius: '20px' }}>
                          <span style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.fileName}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              handleResultChange(idx, { file: null, fileName: '' });
                            }}
                            style={{ background: 'none', border: 'none', color: '#137333', cursor: 'pointer', padding: 0, fontWeight: 700, fontSize: '1rem', marginLeft: '0.2rem' }}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa đính kèm file</span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    Mô tả chi tiết kết quả thực hiện trong tuần: <span style={{ color: 'var(--accent-red)' }}>*</span>
                  </label>
                  <textarea
                    className="input-field"
                    style={{ width: '100%' }}
                    rows={3}
                    placeholder="VD: Đã hoàn thành phỏng vấn 50 mẫu khảo sát tại cơ sở; phân tích số liệu sơ bộ và soạn thảo chương 1..."
                    value={item.description || ''}
                    onChange={(e) => handleResultChange(idx, 'description', e.target.value)}
                    required
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddResultCard}
              style={{
                width: '100%',
                padding: '0.85rem',
                border: '1.5px dashed var(--primary)',
                borderRadius: '20px',
                backgroundColor: '#FFFFFF',
                color: 'var(--primary)',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              + Thêm thẻ kết quả trong tuần
            </button>
          </div>

          {/* Section 2: Next Week Plans */}
          <div style={{ marginBottom: '3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <span style={{ backgroundColor: '#D97706', color: '#FFFFFF', width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem' }}>
                II
              </span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, textTransform: 'uppercase' }}>
                Kế hoạch tuần tiếp theo
              </h2>
            </div>

            {plans.map((item, idx) => (
              <div key={idx} style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)',
                padding: '1.5rem',
                marginBottom: '1.25rem',
                borderLeft: '4px solid #D97706'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px dashed var(--border-color)' }}>
                  <span style={{ fontWeight: 700, color: '#D97706', fontSize: '1rem', textTransform: 'uppercase' }}>
                    Thẻ kế hoạch #{idx + 1}
                  </span>
                  {plans.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePlanCard(idx)}
                      style={{
                        backgroundColor: '#FEE2E2',
                        color: '#DC2626',
                        border: 'none',
                        borderRadius: '20px',
                        padding: '0.35rem 0.9rem',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        transition: 'opacity 0.2s'
                      }}
                    >
                      Xóa thẻ
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: (item.projectId === null && item.customTitle !== null && item.customTitle !== undefined && item.customTitle !== '') ? '1fr 1fr' : '1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                      Chọn đề tài hoặc mục công việc:
                    </label>
                    <select
                      className="input-field"
                      style={{ width: '100%' }}
                      value={item.projectId !== null && item.projectId !== undefined ? String(item.projectId) : (item.customTitle !== null && item.customTitle !== undefined && item.customTitle !== '' ? '-1' : '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '-1') {
                          handlePlanChange(idx, { projectId: null, customTitle: 'Khác' });
                        } else if (!val || val === '') {
                          handlePlanChange(idx, { projectId: null, customTitle: '' });
                        } else {
                          handlePlanChange(idx, { projectId: Number(val), customTitle: '' });
                        }
                      }}
                    >
                      <option value="">-- Chọn đề tài nghiên cứu --</option>
                      {projects.map(p => (
                        <option key={p.id} value={String(p.id)}>
                          {p.topicCode ? `[${p.topicCode}] ` : ''}{p.name}
                        </option>
                      ))}
                      <option value="-1" style={{ fontWeight: 700, color: 'var(--primary)' }}>+ Khác (Nhập tên công việc / mục tiêu ngoài đề tài)</option>
                    </select>
                  </div>

                  {(item.projectId === null && item.customTitle !== null && item.customTitle !== undefined && item.customTitle !== '') && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                        Tên công việc / mục tiêu khác: <span style={{ color: 'var(--accent-red)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        style={{ width: '100%' }}
                        placeholder="VD: Viết bài báo hội thảo, Tổ chức seminar..."
                        value={item.customTitle === 'Khác' ? '' : (item.customTitle || '')}
                        onChange={(e) => handlePlanChange(idx, 'customTitle', e.target.value || 'Khác')}
                        required
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    Mô tả kế hoạch / dự kiến đầu ra trong tuần tới: <span style={{ color: 'var(--accent-red)' }}>*</span>
                  </label>
                  <textarea
                    className="input-field"
                    style={{ width: '100%' }}
                    rows={2}
                    placeholder="VD: Triển khai thí nghiệm mô hình đợt 2; hoàn thiện chỉnh sửa chuyên đề số 3..."
                    value={item.description || ''}
                    onChange={(e) => handlePlanChange(idx, 'description', e.target.value)}
                    required
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={handleAddPlanCard}
              style={{
                width: '100%',
                padding: '0.85rem',
                border: '1.5px dashed #D97706',
                borderRadius: '20px',
                backgroundColor: '#FFFFFF',
                color: '#D97706',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              + Thêm thẻ kế hoạch tuần tới
            </button>
          </div>

          {/* Submit Action Bar - Styled cleanly like bottom actions */}
          <div style={{ 
            padding: '1.5rem', 
            backgroundColor: '#FFFFFF', 
            borderRadius: 'var(--radius-lg)', 
            boxShadow: 'var(--shadow-md)', 
            border: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            bottom: '1.5rem',
            zIndex: 10
          }}>
            <div>
              <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem', display: 'block' }}>
                Hoàn tất soạn thảo?
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Báo cáo sẽ được gửi tới <strong>{users.find(u => u.id === Number(recipientId))?.name || 'Người nhận'}</strong>
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !recipientId}
              style={{
                padding: '0.75rem 2.5rem',
                backgroundColor: isSubmitting || !recipientId ? '#94A3B8' : 'var(--primary)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '20px',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: isSubmitting || !recipientId ? 'not-allowed' : 'pointer',
                boxShadow: isSubmitting || !recipientId ? 'none' : 'var(--shadow-sm)',
                transition: 'all 0.2s'
              }}
            >
              {isSubmitting ? 'Đang gửi báo cáo...' : 'Nộp báo cáo tuần'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: MANAGE REPORTS */}
      {activeTab === 'manage' && (
        <div>
          {/* Sub-filter Bar - Styled EXACTLY like ProjectDetail.tsx sub-tab bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 1.5rem',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.75rem',
            gap: '2.5rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <button
              type="button"
              onClick={() => setManageFilter('received')}
              style={{
                background: 'none',
                border: 'none',
                padding: '1rem 0',
                color: manageFilter === 'received' ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: manageFilter === 'received' ? 700 : 600,
                fontSize: '0.95rem',
                cursor: 'pointer',
                borderBottom: manageFilter === 'received' ? '3px solid var(--primary)' : '3px solid transparent'
              }}
            >
              Báo cáo nhận được ({reports.filter(r => r.reportedTo?.id === currentUser?.id || manageFilter === 'received').length})
            </button>

            <button
              type="button"
              onClick={() => setManageFilter('sent')}
              style={{
                background: 'none',
                border: 'none',
                padding: '1rem 0',
                color: manageFilter === 'sent' ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: manageFilter === 'sent' ? 700 : 600,
                fontSize: '0.95rem',
                cursor: 'pointer',
                borderBottom: manageFilter === 'sent' ? '3px solid var(--primary)' : '3px solid transparent'
              }}
            >
              Báo cáo tôi đã gửi
            </button>
          </div>

          {/* Info Banner box */}
          <div style={{
            backgroundColor: 'rgba(52, 144, 139, 0.08)',
            border: '1px solid rgba(52, 144, 139, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem 1.25rem',
            marginBottom: '1.75rem',
            color: 'var(--text-main)',
            fontSize: '0.9rem',
            lineHeight: 1.6
          }}>
            <strong style={{ color: 'var(--primary)', fontWeight: 700 }}>Quản lý Báo cáo tuần:</strong> Theo dõi chi tiết các kết quả thực hiện công việc và kế hoạch tuần tới của cán bộ/thành viên. Hỗ trợ tải trực tiếp từng file đính kèm hoặc xuất toàn bộ văn bản tổng hợp theo định dạng chuẩn (.docx).
          </div>

          {/* Filters & Sorting */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', flex: 1 }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label" style={{ fontSize: '0.85rem' }}>Sắp xếp theo</label>
              <select className="input-field" value={sortMode} onChange={e => setSortMode(e.target.value as any)}>
                <option value="date_desc">Thời gian nộp (Mới nhất trước)</option>
                <option value="date_asc">Thời gian nộp (Cũ nhất trước)</option>
                <option value="person">Tên người báo cáo (A-Z)</option>
              </select>
            </div>
            
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" style={{ fontSize: '0.85rem' }}>Lọc theo Dự án</label>
              <select className="input-field" value={filterProject} onChange={e => setFilterProject(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                <option value="all">Tất cả dự án</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.code ? `${p.code} - ${p.name}` : p.name}</option>
                ))}
              </select>
            </div>
            
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" style={{ fontSize: '0.85rem' }}>Lọc theo Người gửi</label>
              <select className="input-field" value={filterPerson} onChange={e => setFilterPerson(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                <option value="all">Tất cả thành viên</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            </div>
            
            <button 
              className="btn btn-primary"
              onClick={() => setShowSynthesisModal(true)}
              style={{ background: '#096dd9', borderColor: '#096dd9', padding: '0.65rem 1.25rem', height: 'fit-content' }}
            >
              <i className="fas fa-file-word" style={{ marginRight: '8px' }}></i>
              Tổng hợp báo cáo
            </button>
          </div>

          {isLoadingReports ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 600 }}>
              Đang tải danh sách báo cáo...
            </div>
          ) : reports.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '4rem 2rem',
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                Chưa có báo cáo tuần nào
              </div>
              <div style={{ fontSize: '0.95rem' }}>
                {manageFilter === 'received' 
                  ? 'Bạn chưa nhận được báo cáo công việc tuần từ cán bộ nào.' 
                  : 'Bạn chưa nộp báo cáo tuần nào. Hãy chuyển sang tab "Nộp báo cáo tuần" để tạo mới!'}
              </div>
            </div>
          ) : filteredAndSortedReports.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '4rem 2rem',
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                Không tìm thấy báo cáo nào
              </div>
              <div style={{ fontSize: '0.95rem' }}>
                Không có báo cáo tuần nào phù hợp với bộ lọc hiện tại. Hãy thử thay đổi bộ lọc.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {filteredAndSortedReports.map((report) => {
                const isExpanded = !!expandedReports[report.id];
                const dateFormatted = new Date(report.createdAt).toLocaleDateString('vi-VN', {
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                });

                return (
                  <div key={report.id} style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-sm)',
                    padding: '1.5rem',
                    borderLeft: '4px solid var(--primary)'
                  }}>
                    {/* Header Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(52, 144, 139, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '1.2rem',
                          color: 'var(--primary)'
                        }}>
                          {report.reporter?.name ? report.reporter.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase' }}>
                            {manageFilter === 'received' 
                              ? `Người gửi: ${report.reporter?.name || 'Cán bộ'} (${report.reporter?.department || 'Phòng ban chung'})`
                              : `Gửi tới: ${report.recipient?.name || 'Lãnh đạo'} (${report.recipient?.department || 'Phòng ban chung'})`}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                            <span>
                              Ngày nộp: <strong>{dateFormatted}</strong>
                            </span>
                            <span style={{ backgroundColor: '#E6F4EA', color: '#137333', padding: '0.2rem 0.7rem', borderRadius: '20px', fontWeight: 700, fontSize: '0.75rem' }}>
                              {report.results?.length || 0} kết quả
                            </span>
                            <span style={{ backgroundColor: '#FEF3C7', color: '#D97706', padding: '0.2rem 0.7rem', borderRadius: '20px', fontWeight: 700, fontSize: '0.75rem' }}>
                              {report.plans?.length || 0} kế hoạch
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons - Pure text, zero icons, rounded pill buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleDownloadDocx(report.id)}
                          style={{
                            padding: '0.55rem 1.25rem',
                            backgroundColor: 'var(--primary)',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '20px',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            boxShadow: 'var(--shadow-sm)',
                            transition: 'all 0.2s'
                          }}
                          title="Tải báo cáo DOCX chuẩn"
                        >
                          Tải báo cáo DOCX
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleExpandReport(report.id)}
                          style={{
                            padding: '0.55rem 1.25rem',
                            backgroundColor: '#FFFFFF',
                            color: 'var(--text-main)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '20px',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          {isExpanded ? 'Thu gọn' : 'Xem chi tiết'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteReport(report.id)}
                          style={{
                            padding: '0.55rem 1rem',
                            backgroundColor: '#FEE2E2',
                            color: '#DC2626',
                            border: 'none',
                            borderRadius: '20px',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          title="Xóa báo cáo này"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details Section */}
                    {isExpanded && (
                      <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                        {/* Results Table */}
                        <div style={{ marginBottom: '2rem' }}>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                            I. Kết quả thực hiện trong tuần ({report.results?.length || 0})
                          </h4>
                          
                          <div style={{ backgroundColor: '#FFFFFF', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#F8FAFC', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)' }}>
                                  <th style={{ padding: '0.85rem 1rem', width: '5%', fontWeight: 700 }}>STT</th>
                                  <th style={{ padding: '0.85rem 1rem', width: '30%', fontWeight: 700 }}>Đề tài / Công việc</th>
                                  <th style={{ padding: '0.85rem 1rem', width: '45%', fontWeight: 700 }}>Mô tả kết quả</th>
                                  <th style={{ padding: '0.85rem 1rem', width: '20%', textAlign: 'center', fontWeight: 700 }}>Minh chứng</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(!report.results || report.results.length === 0) ? (
                                  <tr>
                                    <td colSpan={4} style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa có mục kết quả nào</td>
                                  </tr>
                                ) : report.results.map((r, idx) => (
                                  <tr key={r.id || idx} style={{ borderTop: idx > 0 ? '1px solid var(--border-color)' : 'none' }}>
                                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>{idx + 1}</td>
                                    <td style={{ padding: '0.85rem 1rem' }}>
                                      {r.project ? (
                                        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                                          {r.project.topicCode ? `[${r.project.topicCode}] ` : ''}{r.project.name}
                                        </span>
                                      ) : (
                                        <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Công việc chung / Khác</span>
                                      )}
                                    </td>
                                    <td style={{ padding: '0.85rem 1rem', whiteSpace: 'pre-wrap', color: 'var(--text-main)' }}>{r.description}</td>
                                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                                      {r.fileName && r.id ? (
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                          {['pdf', 'docx', 'png', 'jpg', 'jpeg'].includes(r.fileName.split('.').pop()?.toLowerCase() || '') && (
                                            <button
                                              type="button"
                                              onClick={() => handlePreview(r.id!, r.fileName!)}
                                              style={{
                                                padding: '0.4rem 0.9rem',
                                                backgroundColor: '#E6F7FF',
                                                color: '#096DD9',
                                                border: 'none',
                                                borderRadius: '20px',
                                                fontWeight: 600,
                                                fontSize: '0.8rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                              }}
                                              title="Xem trước file"
                                            >
                                              Xem trước
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => weeklyReportService.downloadFile(r.id!, r.fileName!)}
                                            style={{
                                              padding: '0.4rem 0.9rem',
                                              backgroundColor: '#E6F4EA',
                                              color: '#137333',
                                              border: 'none',
                                              borderRadius: '20px',
                                              fontWeight: 600,
                                              fontSize: '0.8rem',
                                              cursor: 'pointer',
                                              transition: 'all 0.2s'
                                            }}
                                            title="Tải xuống file kết quả"
                                          >
                                            Tải ({r.fileName.length > 15 ? r.fileName.substring(0, 12) + '...' : r.fileName})
                                          </button>
                                        </div>
                                      ) : (
                                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>Không có</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Plans Table */}
                        <div>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#D97706', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                            II. Kế hoạch tuần tiếp theo ({report.plans?.length || 0})
                          </h4>

                          <div style={{ backgroundColor: '#FFFFFF', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#F8FAFC', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)' }}>
                                  <th style={{ padding: '0.85rem 1rem', width: '5%', fontWeight: 700 }}>STT</th>
                                  <th style={{ padding: '0.85rem 1rem', width: '35%', fontWeight: 700 }}>Đề tài / Công việc tuần tới</th>
                                  <th style={{ padding: '0.85rem 1rem', width: '60%', fontWeight: 700 }}>Kế hoạch / Dự kiến kết quả đầu ra</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(!report.plans || report.plans.length === 0) ? (
                                  <tr>
                                    <td colSpan={3} style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa có kế hoạch nào</td>
                                  </tr>
                                ) : report.plans.map((p, idx) => (
                                  <tr key={p.id || idx} style={{ borderTop: idx > 0 ? '1px solid var(--border-color)' : 'none' }}>
                                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>{idx + 1}</td>
                                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                      {p.project ? (
                                        <span>{p.project.topicCode ? `[${p.project.topicCode}] ` : ''}{p.project.name}</span>
                                      ) : (
                                        <span>{p.customTitle || 'Khác'}</span>
                                      )}
                                    </td>
                                    <td style={{ padding: '0.85rem 1rem', whiteSpace: 'pre-wrap', color: 'var(--text-main)' }}>{p.description}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showSynthesisModal && (
        <div className="modal-overlay" onClick={() => setShowSynthesisModal(false)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Tổng hợp báo cáo (Xuất File Word)</div>
              <button className="modal-close-btn" onClick={() => setShowSynthesisModal(false)}>Đóng</button>
            </div>
            
            <div className="modal-body" style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label className="input-label">Từ ngày</label>
                <input type="date" className="input-field" value={synthStartDate} onChange={e => setSynthStartDate(e.target.value)} />
              </div>
              <div>
                <label className="input-label">Đến ngày</label>
                <input type="date" className="input-field" value={synthEndDate} onChange={e => setSynthEndDate(e.target.value)} />
              </div>
              <div>
                <label className="input-label">Lọc theo Đề tài</label>
                <select className="input-field" value={synthProject} onChange={e => setSynthProject(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                  <option value="all">Tất cả đề tài</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.code ? `${p.code} - ${p.name}` : p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">Lọc theo Cán bộ / Thành viên</label>
                <select className="input-field" value={synthUser} onChange={e => setSynthUser(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                  <option value="all">Tất cả cán bộ</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowSynthesisModal(false)} disabled={isSynthesizing}>Hủy</button>
              <button className="btn btn-primary" onClick={handleSynthesisDownload} disabled={isSynthesizing}>
                {isSynthesizing ? 'Đang xử lý...' : 'Xuất File DOCX'}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewModalOpen && (
        <div className="modal-overlay" onClick={closePreview} style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '90vw', width: '1000px', height: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Xem trước: {previewFileName}</div>
              <button className="modal-close-btn" onClick={closePreview}>Đóng</button>
            </div>
            
            <div className="modal-body" style={{ flex: 1, padding: 0, overflow: 'hidden', backgroundColor: '#f0f2f5' }}>
              {isPreviewLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <span style={{ fontSize: '1.2rem', color: '#666' }}>Đang tải bản xem trước...</span>
                </div>
              ) : previewUrl ? (
                <iframe 
                  src={previewUrl} 
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title="File Preview"
                />
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <span style={{ fontSize: '1.2rem', color: '#dc2626' }}>Không thể tải bản xem trước</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyReports;
