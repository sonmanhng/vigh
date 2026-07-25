import React, { useState, useEffect } from 'react';
import { 
  FileText, Upload, Plus, Trash2, Download, Send, 
  CheckCircle2, User as UserIcon, Folder, Calendar, 
  Briefcase, AlertCircle, ChevronDown, ChevronUp, File 
} from 'lucide-react';
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
    setResults([...results, { projectId: null, description: '', file: null, fileName: '' }]);
  };

  const handleRemoveResultCard = (index: number) => {
    if (results.length === 1) {
      alert('Cần ít nhất 1 mục kết quả trong báo cáo!');
      return;
    }
    setResults(results.filter((_, idx) => idx !== index));
  };

  const handleResultChange = (index: number, field: keyof WeeklyReportResultItem, value: any) => {
    const newResults = [...results];
    newResults[index] = { ...newResults[index], [field]: value };
    setResults(newResults);
  };

  const handleFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      handleResultChange(index, 'file', file);
      handleResultChange(index, 'fileName', file.name);
    }
  };

  const handleAddPlanCard = () => {
    setPlans([...plans, { projectId: null, customTitle: '', description: '' }]);
  };

  const handleRemovePlanCard = (index: number) => {
    if (plans.length === 1) {
      alert('Cần ít nhất 1 mục kế hoạch cho tuần tới!');
      return;
    }
    setPlans(plans.filter((_, idx) => idx !== index));
  };

  const handlePlanChange = (index: number, field: keyof WeeklyReportPlanItem, value: any) => {
    const newPlans = [...plans];
    newPlans[index] = { ...newPlans[index], [field]: value };
    setPlans(newPlans);
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
      alert('🎉 Nộp báo cáo tuần thành công!');
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

  return (
    <div className="content-area" style={{ padding: '1.5rem 2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FileText size={28} style={{ color: '#2B579A' }} />
            Hệ Thống Báo Cáo Công Việc Tuần
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            Tổng hợp kết quả, đính kèm tài liệu và đăng ký kế hoạch hoạt động theo tuần cho Lãnh đạo & Chủ nhiệm
          </p>
        </div>

        {/* Main Tab Switcher */}
        <div style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: '0.35rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <button
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '10px',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              backgroundColor: activeTab === 'submit' ? '#2B579A' : 'transparent',
              color: activeTab === 'submit' ? '#FFFFFF' : '#475569',
              boxShadow: activeTab === 'submit' ? '0 2px 4px rgba(43, 87, 154, 0.2)' : 'none'
            }}
            onClick={() => setActiveTab('submit')}
          >
            <Send size={18} />
            Nộp Báo Cáo Tuần
          </button>
          <button
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '10px',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
              backgroundColor: activeTab === 'manage' ? '#2B579A' : 'transparent',
              color: activeTab === 'manage' ? '#FFFFFF' : '#475569',
              boxShadow: activeTab === 'manage' ? '0 2px 4px rgba(43, 87, 154, 0.2)' : 'none'
            }}
            onClick={() => setActiveTab('manage')}
          >
            <Folder size={18} />
            Quản Lý Báo Cáo
          </button>
        </div>
      </div>

      {/* TAB 1: SUBMIT REPORT */}
      {activeTab === 'submit' && (
        <form onSubmit={handleSubmitReport}>
          {/* Card 0: Recipient Selector */}
          <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem', borderLeft: '4px solid #2B579A', backgroundColor: '#F8FAFC' }}>
            <label style={{ display: 'block', fontSize: '1rem', fontWeight: 700, color: '#1E293B', marginBottom: '0.75rem', displayFlex: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserIcon size={18} style={{ color: '#2B579A', display: 'inline' }} />
              Chọn người báo cáo tới (Lãnh đạo / Chủ nhiệm / Quản lý): <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <select
              className="input-field"
              style={{ maxWidth: '450px', fontWeight: 500 }}
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
              <span style={{ backgroundColor: '#10B981', color: '#fff', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                1
              </span>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Kết Quả Thực Hiện Trong Tuần
              </h2>
            </div>

            {results.map((item, idx) => (
              <div key={idx} className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem', border: '1px solid #E2E8F0', position: 'relative', transition: 'box-shadow 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px dashed #E2E8F0' }}>
                  <span style={{ fontWeight: 700, color: '#2B579A', fontSize: '1.05rem' }}>
                    Thẻ Kết Quả #{idx + 1}
                  </span>
                  {results.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveResultCard(idx)}
                      style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 600 }}
                      title="Xóa thẻ này"
                    >
                      <Trash2 size={16} /> Xóa thẻ
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>
                      Chọn đề tài liên quan (tùy chọn):
                    </label>
                    <select
                      className="input-field"
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
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>
                      Tải lên file minh chứng / kết quả (lưu database):
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <label style={{
                        padding: '0.55rem 1rem',
                        backgroundColor: '#F1F5F9',
                        color: '#334155',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'background-color 0.2s'
                      }}>
                        <Upload size={16} />
                        {item.fileName ? 'Thay file khác' : 'Chọn file đính kèm...'}
                        <input
                          type="file"
                          style={{ display: 'none' }}
                          onChange={(e) => handleFileChange(idx, e)}
                        />
                      </label>
                      {item.fileName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#059669', fontWeight: 600 }}>
                          <File size={16} />
                          <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.fileName}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              handleResultChange(idx, 'file', null);
                              handleResultChange(idx, 'fileName', '');
                            }}
                            style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 }}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontStyle: 'italic' }}>Chưa chọn file</span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>
                    Mô tả chi tiết kết quả thực hiện trong tuần: <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <textarea
                    className="input-field"
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
                border: '2px dashed #10B981',
                borderRadius: '10px',
                backgroundColor: '#ECFDF5',
                color: '#059669',
                fontWeight: 700,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <Plus size={20} />
              + Thêm Thẻ Kết Quả Trong Tuần
            </button>
          </div>

          {/* Section 2: Next Week Plans */}
          <div style={{ marginBottom: '3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <span style={{ backgroundColor: '#3B82F6', color: '#fff', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                2
              </span>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Kế Hoạch Tuần Tiếp Theo
              </h2>
            </div>

            {plans.map((item, idx) => (
              <div key={idx} className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem', border: '1px solid #E2E8F0', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px dashed #E2E8F0' }}>
                  <span style={{ fontWeight: 700, color: '#1D4ED8', fontSize: '1.05rem' }}>
                    Thẻ Kế Hoạch #{idx + 1}
                  </span>
                  {plans.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePlanCard(idx)}
                      style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 600 }}
                      title="Xóa thẻ này"
                    >
                      <Trash2 size={16} /> Xóa thẻ
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: item.projectId === -1 ? '1fr 1fr' : '1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>
                      Chọn đề tài hoặc mục công việc:
                    </label>
                    <select
                      className="input-field"
                      value={item.projectId === null && item.customTitle !== '' ? -1 : (item.projectId || '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '-1') {
                          handlePlanChange(idx, 'projectId', null);
                          handlePlanChange(idx, 'customTitle', 'Khác');
                        } else if (val === '') {
                          handlePlanChange(idx, 'projectId', null);
                          handlePlanChange(idx, 'customTitle', '');
                        } else {
                          handlePlanChange(idx, 'projectId', Number(val));
                          handlePlanChange(idx, 'customTitle', '');
                        }
                      }}
                    >
                      <option value="">-- Chọn đề tài nghiên cứu --</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.topicCode ? `[${p.topicCode}] ` : ''}{p.name}
                        </option>
                      ))}
                      <option value="-1" style={{ fontWeight: 700, color: '#2B579A' }}>+ Khác (Nhập tên công việc / mục tiêu ngoài đề tài)</option>
                    </select>
                  </div>

                  {(item.projectId === null && (item.customTitle || item.customTitle === 'Khác')) && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>
                        Tên công việc / mục tiêu khác: <span style={{ color: '#EF4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="VD: Viết bài báo hội thảo, Tổ chức seminar..."
                        value={item.customTitle === 'Khác' ? '' : (item.customTitle || '')}
                        onChange={(e) => handlePlanChange(idx, 'customTitle', e.target.value || 'Khác')}
                        required
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>
                    Mô tả kế hoạch / dự kiến đầu ra trong tuần tới: <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <textarea
                    className="input-field"
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
                border: '2px dashed #3B82F6',
                borderRadius: '10px',
                backgroundColor: '#EFF6FF',
                color: '#1D4ED8',
                fontWeight: 700,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <Plus size={20} />
              + Thêm Thẻ Kế Hoạch Tuần Tới
            </button>
          </div>

          {/* Submit Action Bar */}
          <div style={{ 
            padding: '1.5rem', 
            backgroundColor: '#FFFFFF', 
            borderRadius: '12px', 
            boxShadow: '0 4px 15px rgba(0,0,0,0.08)', 
            border: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            bottom: '1rem',
            zIndex: 10
          }}>
            <div>
              <span style={{ fontWeight: 700, color: '#0F172A', fontSize: '1.05rem', display: 'block' }}>
                Hoàn tất soạn thảo?
              </span>
              <span style={{ fontSize: '0.85rem', color: '#64748B' }}>
                Báo cáo sẽ được gửi tới <strong>{users.find(u => u.id === Number(recipientId))?.name || 'Người nhận'}</strong>
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !recipientId}
              style={{
                padding: '0.85rem 2rem',
                backgroundColor: isSubmitting || !recipientId ? '#94A3B8' : '#2B579A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '1.05rem',
                cursor: isSubmitting || !recipientId ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                boxShadow: isSubmitting || !recipientId ? 'none' : '0 4px 12px rgba(43, 87, 154, 0.3)',
                transition: 'all 0.2s'
              }}
            >
              <Send size={20} />
              {isSubmitting ? 'Đang gửi báo cáo...' : 'Nộp Báo Cáo Tuần'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: MANAGE REPORTS */}
      {activeTab === 'manage' && (
        <div>
          {/* Sub-filter Bar */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.75rem', borderBottom: '2px solid #E2E8F0', paddingBottom: '0.75rem' }}>
            <button
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
                backgroundColor: manageFilter === 'received' ? '#EFF6FF' : 'transparent',
                color: manageFilter === 'received' ? '#1D4ED8' : '#64748B',
                borderBottom: manageFilter === 'received' ? '2px solid #1D4ED8' : 'none'
              }}
              onClick={() => setManageFilter('received')}
            >
              📥 Báo Cáo Nhận Được (Gửi đến tôi)
            </button>
            <button
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
                backgroundColor: manageFilter === 'sent' ? '#ECFDF5' : 'transparent',
                color: manageFilter === 'sent' ? '#059669' : '#64748B',
                borderBottom: manageFilter === 'sent' ? '2px solid #059669' : 'none'
              }}
              onClick={() => setManageFilter('sent')}
            >
              📤 Báo Cáo Tôi Đã Gửi
            </button>
          </div>

          {isLoadingReports ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: '#64748B', fontSize: '1.1rem' }}>
              ⏳ Đang tải danh sách báo cáo...
            </div>
          ) : reports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px dashed #CBD5E1', color: '#64748B' }}>
              <AlertCircle size={48} style={{ margin: '0 auto 1rem', color: '#94A3B8' }} />
              <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#334155', marginBottom: '0.5rem' }}>
                Chưa có báo cáo tuần nào
              </div>
              <div>
                {manageFilter === 'received' 
                  ? 'Bạn chưa nhận được báo cáo công việc tuần từ cán bộ nào.' 
                  : 'Bạn chưa nộp báo cáo tuần nào. Hãy chuyển sang tab "Nộp Báo Cáo Tuần" để tạo mới!'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {reports.map((report) => {
                const isExpanded = !!expandedReports[report.id];
                const dateFormatted = new Date(report.createdAt).toLocaleDateString('vi-VN', {
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                });

                return (
                  <div key={report.id} className="card" style={{ padding: '1.5rem', border: '1px solid #E2E8F0', transition: 'box-shadow 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
                    {/* Header Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem', color: '#2B579A' }}>
                          {report.reporter?.name ? report.reporter.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                            {manageFilter === 'received' 
                              ? `Người gửi: ${report.reporter?.name || 'Cán bộ'} (${report.reporter?.department || 'Chung'})`
                              : `Gửi tới: ${report.recipient?.name || 'Lãnh đạo'} (${report.recipient?.department || 'Chung'})`}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.2rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Calendar size={14} /> {dateFormatted}
                            </span>
                            <span style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: 700 }}>
                              {report.results?.length || 0} kết quả
                            </span>
                            <span style={{ backgroundColor: '#F0FDF4', color: '#15803D', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: 700 }}>
                              {report.plans?.length || 0} kế hoạch
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button
                          type="button"
                          onClick={() => weeklyReportService.downloadDocx(report.id, report.reporter?.name)}
                          style={{
                            padding: '0.55rem 1rem',
                            backgroundColor: '#1E3A8A',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 2px 4px rgba(30, 58, 138, 0.2)'
                          }}
                          title="Tải báo cáo DOCX chuẩn"
                        >
                          <Download size={16} />
                          Tải Báo Cáo DOCX
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleExpandReport(report.id)}
                          style={{
                            padding: '0.55rem 1rem',
                            backgroundColor: '#F1F5F9',
                            color: '#334155',
                            border: '1px solid #CBD5E1',
                            borderRadius: '8px',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          {isExpanded ? 'Thu gọn' : 'Xem Chi Tiết'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteReport(report.id)}
                          style={{
                            padding: '0.55rem',
                            backgroundColor: '#FEE2E2',
                            color: '#DC2626',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Xóa báo cáo này"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details Section */}
                    {isExpanded && (
                      <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #E2E8F0' }}>
                        {/* Results Table */}
                        <div style={{ marginBottom: '1.5rem' }}>
                          <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E3A8A', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CheckCircle2 size={18} style={{ color: '#10B981' }} />
                            I. Kết Quả Thực Hiện Trong Tuần ({report.results?.length || 0})
                          </h4>
                          
                          <div style={{ backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#E2E8F0', color: '#334155' }}>
                                  <th style={{ padding: '0.75rem 1rem', width: '5%' }}>STT</th>
                                  <th style={{ padding: '0.75rem 1rem', width: '30%' }}>Đề tài / Công việc</th>
                                  <th style={{ padding: '0.75rem 1rem', width: '45%' }}>Mô tả kết quả</th>
                                  <th style={{ padding: '0.75rem 1rem', width: '20%', textAlign: 'center' }}>Minh chứng / File</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(!report.results || report.results.length === 0) ? (
                                  <tr>
                                    <td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: '#94A3B8', fontStyle: 'italic' }}>Chưa có kết quả</td>
                                  </tr>
                                ) : report.results.map((r, idx) => (
                                  <tr key={r.id || idx} style={{ borderTop: '1px solid #E2E8F0' }}>
                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{idx + 1}</td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                      {r.project ? (
                                        <span style={{ fontWeight: 700, color: '#1E3A8A' }}>
                                          {r.project.topicCode ? `[${r.project.topicCode}] ` : ''}{r.project.name}
                                        </span>
                                      ) : (
                                        <span style={{ fontStyle: 'italic', color: '#64748B' }}>Công việc chung / Khác</span>
                                      )}
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', whiteSpace: 'pre-wrap', color: '#334155' }}>{r.description}</td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                      {r.fileName && r.id ? (
                                        <button
                                          type="button"
                                          onClick={() => weeklyReportService.downloadFile(r.id!, r.fileName!)}
                                          style={{
                                            padding: '0.4rem 0.75rem',
                                            backgroundColor: '#10B981',
                                            color: '#FFFFFF',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontWeight: 600,
                                            fontSize: '0.8rem',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.35rem'
                                          }}
                                          title="Tải xuống file kết quả"
                                        >
                                          <Download size={14} />
                                          {r.fileName.length > 18 ? r.fileName.substring(0, 15) + '...' : r.fileName}
                                        </button>
                                      ) : (
                                        <span style={{ color: '#94A3B8', fontStyle: 'italic', fontSize: '0.8rem' }}>Không có</span>
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
                          <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E3A8A', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Briefcase size={18} style={{ color: '#3B82F6' }} />
                            II. Kế Hoạch Tuần Tiếp Theo ({report.plans?.length || 0})
                          </h4>

                          <div style={{ backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#E2E8F0', color: '#334155' }}>
                                  <th style={{ padding: '0.75rem 1rem', width: '5%' }}>STT</th>
                                  <th style={{ padding: '0.75rem 1rem', width: '35%' }}>Đề tài / Công việc tuần tới</th>
                                  <th style={{ padding: '0.75rem 1rem', width: '60%' }}>Kế hoạch / Dự kiến kết quả đầu ra</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(!report.plans || report.plans.length === 0) ? (
                                  <tr>
                                    <td colSpan={3} style={{ padding: '1rem', textAlign: 'center', color: '#94A3B8', fontStyle: 'italic' }}>Chưa có kế hoạch</td>
                                  </tr>
                                ) : report.plans.map((p, idx) => (
                                  <tr key={p.id || idx} style={{ borderTop: '1px solid #E2E8F0' }}>
                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{idx + 1}</td>
                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#1E3A8A' }}>
                                      {p.project ? (
                                        <span>{p.project.topicCode ? `[${p.project.topicCode}] ` : ''}{p.project.name}</span>
                                      ) : (
                                        <span>{p.customTitle || 'Khác'}</span>
                                      )}
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', whiteSpace: 'pre-wrap', color: '#334155' }}>{p.description}</td>
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
    </div>
  );
};

export default WeeklyReports;
