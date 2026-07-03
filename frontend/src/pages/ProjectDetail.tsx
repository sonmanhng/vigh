import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

export const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState<any | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [researchContents, setResearchContents] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Tabs state
  const [mainTab, setMainTab] = useState<'professional' | 'admin'>('professional');
  const [subTab, setSubTab] = useState<'overview' | 'implementation' | 'tasks' | 'personal' | 'accounting'>('overview');

  // Edit General Info Modal State
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<any>({});

  // Research Content Modal State
  const [showResearchModal, setShowResearchModal] = useState<boolean>(false);
  const [editingResearchId, setEditingResearchId] = useState<number | null>(null);
  const [researchForm, setResearchForm] = useState<any>({
    code: '',
    title: '',
    status: 'Xong 100%',
    description: '',
    activitiesList: [{ activity: '', result: '' }]
  });

  // New Task State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState<number | ''>('');
  const [newTaskExpectedResult, setNewTaskExpectedResult] = useState('');
  const [newTaskAssignDate, setNewTaskAssignDate] = useState(new Date().toISOString().slice(0, 10));
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [selectedActivityCode, setSelectedActivityCode] = useState('');
  const [uploadFiles, setUploadFiles] = useState<{ [taskId: number]: { file: File, dataUrl: string, name: string, size: string } }>({});
  const [submittingReportTaskId, setSubmittingReportTaskId] = useState<number | null>(null);

  const isManagerOrAdmin = user && ['SuperAdmin', 'VienTruong', 'VienPho', 'TruongPhong', 'ADMIN', 'MANAGER'].includes(user.role);

  // Cấp bậc PHỤ trong đề tài: chỉ SuperAdmin hoặc Chủ nhiệm đề tài mới có quyền phê duyệt / giao việc / xóa công việc
  const isSuperAdmin = user?.role === 'SuperAdmin';
  const isProjectManager = !!(project && user && project.managerId === user.id);
  const canApproveInProject = isSuperAdmin || isProjectManager; // Duyệt báo cáo, nghiệm thu
  const canAssignTasks = isSuperAdmin || isProjectManager; // Giao việc, xóa công việc

  const canEditGeneralInfo = user && (
    ['SuperAdmin', 'VienTruong', 'VienPho', 'ADMIN'].includes(user.role) ||
    project?.managerId === user.id
  );

  useEffect(() => {
    fetchProjectDetails();
    fetchUsersForAssignee();
  }, [id]);

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/projects/${id}`);
      setProject(res.data);
      setTasks(res.data.tasks || []);
      setResearchContents(res.data.researchContents || []);
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching project details:', err);
      setError(err.response?.data?.message || 'Không thể tải thông tin đề tài hoặc không có quyền truy cập.');
      setLoading(false);
    }
  };

  const fetchUsersForAssignee = async () => {
    try {
      const res = await apiClient.get('/users/assignable');
      setUsersList(res.data);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const openEditModal = () => {
    if (!project) return;
    setEditForm({
      name: project.name || '',
      nameEn: project.nameEn || '',
      code: project.code || '',
      projectType: project.projectType || '',
      managementUnit: project.managementUnit || '',
      hostOrganization: project.hostOrganization || '',
      advisor: project.advisor || '',
      executionTime: project.executionTime || '',
      budget: project.budget || '',
      laborBudget: project.laborBudget || 0,
      generalObjective: project.generalObjective || project.description || '',
      memberIds: project.members?.map((m: any) => m.id) || []
    });
    setShowEditModal(true);
  };

  const handleUpdateGeneralInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    try {
      await apiClient.put(`/projects/${project.id}`, editForm);
      setShowEditModal(false);
      alert('Đã cập nhật thông tin chung đề tài thành công!');
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi cập nhật thông tin đề tài');
    }
  };

  // Research Content Handlers
  const openCreateResearchModal = () => {
    setEditingResearchId(null);
    setResearchForm({
      code: `ND${researchContents.length + 1}`,
      title: '',
      status: 'Xong 100%',
      description: '',
      activitiesList: [{ activity: '', result: '' }]
    });
    setShowResearchModal(true);
  };

  const openEditResearchModal = (content: any) => {
    setEditingResearchId(content.id);
    let parsed = [{ activity: '', result: '' }];
    try {
      if (content.activities) {
        const p = typeof content.activities === 'string' ? JSON.parse(content.activities) : content.activities;
        if (Array.isArray(p) && p.length > 0) parsed = p;
      }
    } catch (e) {
      console.error(e);
    }
    setResearchForm({
      code: content.code || '',
      title: content.title || '',
      status: content.status || 'Xong 100%',
      description: content.description || '',
      activitiesList: parsed
    });
    setShowResearchModal(true);
  };

  const handleAddActivityRow = () => {
    setResearchForm({
      ...researchForm,
      activitiesList: [...researchForm.activitiesList, { activity: '', result: '' }]
    });
  };

  const handleRemoveActivityRow = (index: number) => {
    const next = researchForm.activitiesList.filter((_: any, idx: number) => idx !== index);
    setResearchForm({
      ...researchForm,
      activitiesList: next.length > 0 ? next : [{ activity: '', result: '' }]
    });
  };

  const handleActivityChange = (index: number, field: 'activity' | 'result', value: string) => {
    const next = [...researchForm.activitiesList];
    next[index][field] = value;
    setResearchForm({ ...researchForm, activitiesList: next });
  };

  const handleSaveResearchContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !researchForm.code.trim() || !researchForm.title.trim()) return;
    try {
      const payload = {
        code: researchForm.code.trim(),
        title: researchForm.title.trim(),
        status: researchForm.status,
        description: researchForm.description,
        activities: JSON.stringify(
          researchForm.activitiesList
            .filter((item: any) => item.activity?.trim() || item.result?.trim())
            .map((item: any, idx: number) => ({
              id: `${researchForm.code.trim()}.${idx + 1}`,
              activity: item.activity?.trim() || '',
              result: item.result?.trim() || ''
            }))
        )
      };
      if (editingResearchId) {
        await apiClient.put(`/projects/${project.id}/research-contents/${editingResearchId}`, payload);
        alert('Đã cập nhật nội dung nghiên cứu thành công!');
      } else {
        await apiClient.post(`/projects/${project.id}/research-contents`, payload);
        alert('Đã thêm nội dung nghiên cứu mới thành công!');
      }
      setShowResearchModal(false);
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi lưu nội dung nghiên cứu');
    }
  };

  const handleDeleteResearchContent = async (contentId: number, title: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa nội dung "${title}"?`)) return;
    try {
      await apiClient.delete(`/projects/${project.id}/research-contents/${contentId}`);
      alert('Đã xóa nội dung thành công.');
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi xóa nội dung');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !newTaskTitle.trim()) {
      alert('Vui lòng chọn hoặc nhập tên công việc cần giao!');
      return;
    }
    try {
      const payload: any = {
        title: newTaskTitle.trim(),
        projectId: project.id,
        description: JSON.stringify({
          expectedResult: newTaskExpectedResult.trim(),
          assignerName: user?.name || 'Lãnh đạo Viện',
          assignDate: newTaskAssignDate || new Date().toISOString().slice(0, 10),
          deadline: newTaskDeadline || '',
          activityCode: selectedActivityCode || ''
        })
      };
      if (newTaskAssignee) {
        payload.assigneeId = Number(newTaskAssignee);
      }
      await apiClient.post('/tasks', payload);
      setNewTaskTitle('');
      setNewTaskAssignee('');
      setNewTaskExpectedResult('');
      setNewTaskDeadline('');
      setSelectedActivityCode('');
      alert('Đã giao việc cho thành viên thành công!');
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi tạo công việc');
    }
  };

  const updateTaskStatus = async (task: any, newStatus: string) => {
    try {
      await apiClient.put(`/tasks/${task.id}`, { status: newStatus });
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi cập nhật trạng thái');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!window.confirm('Bạn có chắc muốn xóa công việc này?')) return;
    try {
      await apiClient.delete(`/tasks/${taskId}`);
      fetchProjectDetails();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi xóa công việc');
    }
  };

  const renderTaskDetails = (desc?: string) => {
    if (!desc) return null;
    try {
      const parsed = JSON.parse(desc);
      if (typeof parsed === 'object' && parsed !== null && (parsed.expectedResult !== undefined || parsed.assignerName !== undefined)) {
        return (
          <div style={{ backgroundColor: 'rgba(241, 245, 249, 0.8)', padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--text-main)', marginBottom: '0.75rem', border: '1px solid var(--border-color)', lineHeight: 1.45 }}>
            {parsed.expectedResult && (
              <div style={{ marginBottom: '0.4rem' }}>
                <strong style={{ color: 'var(--primary)' }}>Kết quả cần đạt:</strong> {parsed.expectedResult}
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              {parsed.assignerName && <span><strong>Người giao:</strong> {parsed.assignerName}</span>}
              {parsed.assignDate && <span><strong>Ngày giao:</strong> {parsed.assignDate}</span>}
              {parsed.deadline && <span><strong>Deadline:</strong> {parsed.deadline}</span>}
            </div>
          </div>
        );
      }
    } catch (e) { }
    return (
      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: 1.4 }}>
        {desc}
      </div>
    );
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    if (!window.confirm(`Bạn có chắc muốn xóa hoàn toàn đề tài "${project.name}"?`)) return;
    try {
      await apiClient.delete(`/projects/${project.id}`);
      alert('Đã xóa đề tài thành công.');
      navigate('/dashboard');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi xóa đề tài');
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length > 1) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  const renderRow = (label: string, value: React.ReactNode | null | undefined, isTitle = false, subValue?: string | null) => {
    const hasValue = value !== undefined && value !== null && value !== '';
    return (
      <div style={{
        display: 'flex',
        padding: '1.1rem 1.5rem',
        borderBottom: '1px solid var(--border-color)',
        alignItems: 'flex-start',
        gap: '1.5rem'
      }}>
        <div style={{ width: '220px', minWidth: '180px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.92rem', paddingTop: '0.15rem' }}>
          {label}
        </div>
        <div style={{ flex: 1, fontSize: '0.95rem', color: hasValue ? 'var(--text-main)' : 'var(--text-muted)' }}>
          {isTitle ? (
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)', lineHeight: 1.45 }}>
                {value || 'Chưa đặt tên đề tài'}
              </div>
              {subValue && subValue.trim() !== '' ? (
                <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.4rem', lineHeight: 1.4 }}>
                  {subValue}
                </div>
              ) : (
                <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.4rem' }}>
                  Vui lòng bổ sung
                </div>
              )}
            </div>
          ) : (
            hasValue ? (
              <span style={{ fontWeight: label === 'Chủ nhiệm' ? 700 : 400, color: 'var(--text-main)', lineHeight: 1.5 }}>
                {value}
              </span>
            ) : (
              <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Vui lòng bổ sung</span>
            )
          )}
        </div>
      </div>
    );
  };

  // canManageReports: xem toàn bộ & phê duyệt báo cáo — chỉ SuperAdmin và Chủ nhiệm đề tài
  const canManageReports = canApproveInProject;

  const handleFileChange = (taskId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const sizeKB = Math.round(file.size / 1024);
      const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
      setUploadFiles(prev => ({ ...prev, [taskId]: { file, dataUrl, name: file.name, size: sizeStr } }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitReport = async (t: any) => {
    const fileInfo = uploadFiles[t.id];
    if (!fileInfo) {
      alert('Vui lòng chọn file báo cáo trước khi nộp.');
      return;
    }
    setSubmittingReportTaskId(t.id);
    try {
      let descObj: any = {};
      try {
        descObj = typeof t.description === 'string' ? JSON.parse(t.description) : (t.description || {});
      } catch (e) { }

      descObj.reportFile = {
        name: fileInfo.name,
        size: fileInfo.size,
        dataUrl: fileInfo.dataUrl,
        submittedAt: new Date().toLocaleString('vi-VN')
      };
      delete descObj.rejectReason;

      const res = await apiClient.put(`/tasks/${t.id}`, {
        status: 'REVIEW',
        progress: Math.max(t.progress || 0, 90),
        description: JSON.stringify(descObj)
      });
      if (res) {
        alert('Đã nộp báo cáo thành công! Vui lòng chờ Lãnh đạo hoặc Chủ nhiệm đề tài nghiệm thu.');
        setUploadFiles(prev => {
          const next = { ...prev };
          delete next[t.id];
          return next;
        });
        fetchProjectDetails();
      }
    } catch (e: any) {
      alert(`Lỗi nộp báo cáo: ${e.message || 'Không xác định'}`);
    } finally {
      setSubmittingReportTaskId(null);
    }
  };

  const handleApproveReport = async (taskId: number) => {
    if (!window.confirm('Xác nhận nghiệm thu báo cáo và chuyển công việc này sang trạng thái Hoàn thành (100%)?')) return;
    try {
      const res = await apiClient.put(`/tasks/${taskId}`, {
        status: 'DONE',
        progress: 100
      });
      if (res) {
        alert('Đã nghiệm thu hoàn thành công việc!');
        fetchProjectDetails();
      }
    } catch (e: any) {
      alert(`Lỗi nghiệm thu: ${e.message || 'Không xác định'}`);
    }
  };

  const handleRequestRevision = async (t: any) => {
    const reason = window.prompt('Nhập ý kiến yêu cầu bổ sung / chỉnh sửa báo cáo:', 'Yêu cầu làm lại báo cáo theo ý kiến chỉnh sửa');
    if (reason === null) return;
    try {
      let descObj: any = {};
      try {
        descObj = typeof t.description === 'string' ? JSON.parse(t.description) : (t.description || {});
      } catch (e) { }

      descObj.rejectReason = reason || 'Yêu cầu bổ sung báo cáo';

      const res = await apiClient.put(`/tasks/${t.id}`, {
        status: 'IN_PROGRESS',
        description: JSON.stringify(descObj)
      });
      if (res) {
        alert('Đã gửi yêu cầu chỉnh sửa báo cáo!');
        fetchProjectDetails();
      }
    } catch (e: any) {
      alert(`Lỗi: ${e.message || 'Không xác định'}`);
    }
  };

  const handleUpdateTaskAccounting = async (taskId: number, field: 'workDays' | 'paymentPercentage', value: number) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      let descObj: any = {};
      try {
        descObj = typeof task.description === 'string' ? JSON.parse(task.description) : (task.description || {});
      } catch (e) { }

      descObj[field] = value;

      await apiClient.put(`/tasks/${taskId}`, {
        description: JSON.stringify(descObj)
      });
      fetchProjectDetails(); // Sync with backend
    } catch (error) {
      console.error('Error saving accounting data', error);
      alert('Có lỗi khi lưu thông tin tính công');
    }
  };


  const todoTasks = tasks.filter(t => t.status === 'TODO');
  const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'REVIEW');
  const doneTasks = tasks.filter(t => t.status === 'DONE');

  return (
    <div className="app-container">
      {/* Left Sidebar Menu */}
      <aside className="sidebar">
        <div className="sidebar-header" style={{ backgroundColor: '#FFFFFF', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'center', borderBottom: '1px solid var(--border-color)' }}>
          <img
            src="/logo.png"
            alt="Viện VIGH Logo"
            style={{ maxHeight: '54px', maxWidth: '100%', objectFit: 'contain', cursor: 'pointer' }}
            onClick={() => navigate('/dashboard')}
          />
        </div>

        <nav className="sidebar-menu">
          <button
            className="menu-item active"
            onClick={() => navigate('/dashboard')}
          >
            <span>Tiến độ đề tài</span>
          </button>

          <button
            className="menu-item"
            onClick={() => navigate('/dashboard?tab=personnel')}
          >
            <span>Quản lý nhân sự</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)' }}>
            <div style={{ fontWeight: 600, color: '#fff' }}>Hệ Thống Nội Bộ VIGH</div>
            <div>2026</div>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="main-area">
        <Navbar />

        <div className="content-area" style={{ padding: '1.5rem 2rem' }}>
          {/* Back button & Top header info */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--border-color)',
                padding: '0.55rem 1.15rem',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontWeight: 600,
                color: 'var(--primary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.2s ease',
                fontSize: '0.9rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.backgroundColor = 'rgba(52, 144, 139, 0.04)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.backgroundColor = '#FFFFFF';
              }}
            >
              Quay lại danh sách đề tài
            </button>

            {isManagerOrAdmin && project && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleDeleteProject}
                style={{ padding: '0.55rem 1.15rem', fontSize: '0.88rem', fontWeight: 600 }}
              >
                Xóa Đề Tài Này
              </button>
            )}
          </div>

          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              Đang tải chi tiết đề tài...
            </div>
          ) : error ? (
            <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--accent-red)' }}>
              {error}
            </div>
          ) : project ? (
            <div>
              {/* TOP TABS & SUB-TABS CONTAINER */}
              <div style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-sm)',
                marginBottom: '1.5rem',
                overflow: 'hidden'
              }}>
                {/* 1. Main Header Tabs */}
                <div style={{
                  backgroundColor: 'rgba(52, 144, 139, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.6rem 1.25rem 0 1.25rem',
                  gap: '0.5rem',
                  borderBottom: '1px solid var(--border-color)'
                }}>
                  <button
                    type="button"
                    onClick={() => setMainTab('professional')}
                    style={{
                      backgroundColor: mainTab === 'professional' ? 'var(--primary)' : 'transparent',
                      color: mainTab === 'professional' ? '#FFFFFF' : 'var(--text-muted)',
                      border: 'none',
                      padding: '0.75rem 1.4rem',
                      borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      cursor: 'pointer',
                      borderTop: mainTab === 'professional' ? '3px solid var(--primary-light)' : '3px solid transparent',
                      transition: 'all 0.2s ease',
                      boxShadow: mainTab === 'professional' ? 'var(--shadow-sm)' : 'none'
                    }}
                  >
                    <span>Chuyên môn</span>
                    <span style={{
                      backgroundColor: mainTab === 'professional' ? '#FFFFFF' : 'rgba(0, 0, 0, 0.08)',
                      color: mainTab === 'professional' ? 'var(--primary)' : 'var(--text-main)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.55rem',
                      borderRadius: '12px'
                    }}>
                      {tasks.length || 5}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMainTab('admin')}
                    style={{
                      backgroundColor: mainTab === 'admin' ? 'var(--primary)' : 'transparent',
                      color: mainTab === 'admin' ? '#FFFFFF' : 'var(--text-muted)',
                      border: 'none',
                      padding: '0.75rem 1.4rem',
                      borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      cursor: 'pointer',
                      borderTop: mainTab === 'admin' ? '3px solid var(--primary-light)' : '3px solid transparent',
                      transition: 'all 0.2s ease',
                      boxShadow: mainTab === 'admin' ? 'var(--shadow-sm)' : 'none'
                    }}
                  >
                    <span>Hành chính</span>
                  </button>
                </div>

                {/* 2. Sub Tabs (Only when Chuyên môn is selected) */}
                {mainTab === 'professional' && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 1.5rem',
                    backgroundColor: '#FFFFFF',
                    borderBottom: '1px solid var(--border-color)',
                    overflowX: 'auto',
                    gap: '2.5rem'
                  }}>
                    {[
                      { id: 'overview', label: 'Tổng quan' },
                      { id: 'implementation', label: 'Triển khai' },
                      { id: 'tasks', label: 'Giao việc' },
                      { id: 'personal', label: 'Tiến độ cá nhân' },
                      { id: 'accounting', label: 'Tính công' },
                    ].map((st) => {
                      const isActive = subTab === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setSubTab(st.id as any)}
                          style={{
                            backgroundColor: 'transparent',
                            border: 'none',
                            padding: '1.1rem 0',
                            borderBottom: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                            fontWeight: isActive ? 700 : 500,
                            fontSize: '0.95rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <span>{st.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* CONTENT BASED ON SELECTED TAB */}
              {mainTab === 'admin' ? (
                <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
                  <div style={{ display: 'inline-block', padding: '0.5rem 1rem', borderRadius: '20px', backgroundColor: 'rgba(52, 144, 139, 0.1)', color: 'var(--primary)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '1rem' }}>
                    MODULE HÀNH CHÍNH
                  </div>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    Hồ sơ & Tài liệu Hành chính
                  </h3>
                  <p style={{ color: 'var(--text-muted)', maxWidth: '520px', margin: '0 auto', fontSize: '0.95rem' }}>
                    Khu vực quản lý các biểu mẫu, quyết định, hợp đồng và chứng từ tài chính thuộc đề tài. Chức năng đang được tích hợp.
                  </p>
                </div>
              ) : subTab === 'overview' ? (
                /* SUB-TAB 1: TỔNG QUAN */
                <div>
                  {/* CARD 1: THÔNG TIN CHUNG */}
                  <div style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-sm)',
                    overflow: 'hidden'
                  }}>
                    {/* Card Header */}
                    <div style={{
                      padding: '1.25rem 1.5rem',
                      backgroundColor: '#FFFFFF',
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '4px', height: '22px', backgroundColor: 'var(--primary)', borderRadius: '2px' }}></div>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          Thông tin chung
                        </h3>
                      </div>

                      {canEditGeneralInfo && (
                        <button
                          type="button"
                          onClick={openEditModal}
                          style={{
                            backgroundColor: 'var(--primary)',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '0.5rem 1.15rem',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: 600,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            boxShadow: 'var(--shadow-sm)',
                            transition: 'background-color 0.2s ease'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary-light)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary)'; }}
                        >
                          Chỉnh sửa thông tin
                        </button>
                      )}
                    </div>

                    {/* Table Rows */}
                    <div>
                      {renderRow('Tên đề tài', project.name, true, project.nameEn)}
                      {renderRow('Mã số', project.code)}
                      {renderRow('Loại đề tài', project.projectType)}
                      {renderRow('Đơn vị quản lý', project.managementUnit)}
                      {renderRow('Tổ chức chủ trì', project.hostOrganization)}
                      {renderRow('Chủ nhiệm', project.manager?.name)}
                      {renderRow('Cố vấn', project.advisor)}
                      {renderRow('Thành viên tham gia', project.members && project.members.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {project.members.map((m: any) => (
                            <span key={m.id} style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              backgroundColor: 'var(--bg-light)',
                              border: '1px solid var(--border-color)',
                              padding: '0.25rem 0.6rem',
                              borderRadius: '20px',
                              fontSize: '0.85rem',
                              fontWeight: 500,
                              color: 'var(--text-main)'
                            }}>
                              {m.avatar ? (
                                <img src={m.avatar} alt={m.name} style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700 }}>
                                  {getInitials(m.name)}
                                </div>
                              )}
                              {m.name}
                            </span>
                          ))}
                        </div>
                      ) : '')}
                      {renderRow('Thời gian', project.executionTime)}
                      {renderRow('Kinh phí', project.budget)}
                      {renderRow('Kinh phí nhân công (ước tính)', project.laborBudget ? project.laborBudget.toLocaleString('vi-VN') + ' VNĐ' : '0 VNĐ')}
                      {renderRow('Mục tiêu tổng quát', project.generalObjective || project.description)}
                    </div>
                  </div>

                  {/* CARD 2: MỤC TIÊU & NỘI DUNG NGHIÊN CỨU (HOẠT ĐỘNG & MỤC TIÊU) */}
                  <div style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-sm)',
                    overflow: 'hidden',
                    marginTop: '1.5rem'
                  }}>
                    {/* Card Header */}
                    <div style={{
                      padding: '1.25rem 1.5rem',
                      backgroundColor: '#FFFFFF',
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '1rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '4px', height: '22px', backgroundColor: 'var(--primary)', borderRadius: '2px' }}></div>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', display: 'inline' }}>
                            Mục tiêu & Nội dung nghiên cứu
                          </h3>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginLeft: '0.5rem', fontStyle: 'italic' }}>
                            (hoạt động - kết quả)
                          </span>
                        </div>
                      </div>

                      {canEditGeneralInfo && (
                        <button
                          type="button"
                          onClick={openCreateResearchModal}
                          style={{
                            backgroundColor: 'var(--primary)',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '0.5rem 1.15rem',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: 600,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            boxShadow: 'var(--shadow-sm)',
                            transition: 'background-color 0.2s ease'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary-light)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary)'; }}
                        >
                          Thêm nội dung nghiên cứu
                        </button>
                      )}
                    </div>

                    {/* Card Body / Sub-cards list */}
                    <div style={{ padding: '1.5rem' }}>
                      {researchContents.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Chưa có nội dung nghiên cứu nào được bổ sung.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          {researchContents.map((rc) => {
                            let parsedActivities: any[] = [];
                            try {
                              if (rc.activities) {
                                parsedActivities = typeof rc.activities === 'string' ? JSON.parse(rc.activities) : rc.activities;
                              }
                            } catch (e) {
                              console.error(e);
                            }

                            return (
                              <div key={rc.id} style={{
                                backgroundColor: '#EEF2F6',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                padding: '1.25rem 1.5rem',
                                position: 'relative'
                              }}>
                                {/* Top Row: Code, Title, Status, Edit/Delete */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.5rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    <span style={{
                                      backgroundColor: '#FFFFFF',
                                      color: 'var(--primary)',
                                      fontWeight: 700,
                                      fontSize: '0.85rem',
                                      padding: '0.25rem 0.65rem',
                                      borderRadius: '6px',
                                      border: '1px solid rgba(52, 144, 139, 0.3)',
                                      letterSpacing: '0.5px'
                                    }}>
                                      {rc.code}
                                    </span>
                                    <h4 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                      {rc.title}
                                    </h4>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{
                                      backgroundColor: rc.status?.includes('Xong') ? 'rgba(47, 160, 132, 0.15)' : 'rgba(255, 201, 77, 0.25)',
                                      color: rc.status?.includes('Xong') ? '#15803D' : '#92400E',
                                      fontWeight: 700,
                                      fontSize: '0.82rem',
                                      padding: '0.25rem 0.75rem',
                                      borderRadius: '20px'
                                    }}>
                                      {rc.status}
                                    </span>
                                    {canEditGeneralInfo && (
                                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                                        <button
                                          type="button"
                                          onClick={() => openEditResearchModal(rc)}
                                          style={{
                                            background: '#FFFFFF',
                                            border: '1px solid var(--border-color)',
                                            padding: '0.25rem 0.6rem',
                                            borderRadius: '4px',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            color: 'var(--text-main)',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          Sửa
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteResearchContent(rc.id, rc.title)}
                                          style={{
                                            background: 'rgba(250, 103, 129, 0.1)',
                                            border: '1px solid rgba(250, 103, 129, 0.3)',
                                            padding: '0.25rem 0.6rem',
                                            borderRadius: '4px',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            color: 'var(--accent-red)',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          Xóa
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Description */}
                                {rc.description && (
                                  <div style={{ color: 'var(--text-muted)', fontSize: '0.93rem', margin: '0.5rem 0 1rem 0', lineHeight: 1.5 }}>
                                    {rc.description}
                                  </div>
                                )}

                                {/* Activities Table */}
                                {parsedActivities && parsedActivities.length > 0 && (
                                  <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(226, 232, 240, 0.8)', paddingTop: '0.5rem' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', padding: '0.5rem 0', borderBottom: '1px solid rgba(226, 232, 240, 0.8)' }}>
                                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        HOẠT ĐỘNG
                                      </div>
                                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        KẾT QUẢ TƯƠNG ỨNG
                                      </div>
                                    </div>
                                    {parsedActivities.map((item: any, idx: number) => (
                                      <div key={idx} style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr',
                                        gap: '1.5rem',
                                        padding: '0.75rem 0',
                                        borderBottom: idx === parsedActivities.length - 1 ? 'none' : '1px solid rgba(226, 232, 240, 0.6)',
                                        fontSize: '0.92rem',
                                        color: 'var(--text-main)',
                                        lineHeight: 1.5
                                      }}>
                                        <div>
                                          {item.id ? (
                                            <span style={{
                                              fontWeight: 700,
                                              color: 'var(--primary)',
                                              marginRight: '0.5rem',
                                              backgroundColor: 'rgba(52, 144, 139, 0.08)',
                                              padding: '0.15rem 0.45rem',
                                              borderRadius: '4px',
                                              fontSize: '0.82rem'
                                            }}>
                                              {item.id}
                                            </span>
                                          ) : (
                                            <span style={{
                                              fontWeight: 700,
                                              color: 'var(--primary)',
                                              marginRight: '0.5rem',
                                              backgroundColor: 'rgba(52, 144, 139, 0.08)',
                                              padding: '0.15rem 0.45rem',
                                              borderRadius: '4px',
                                              fontSize: '0.82rem'
                                            }}>
                                              {rc.code}.{idx + 1}
                                            </span>
                                          )}
                                          {item.activity || '—'}
                                        </div>
                                        <div>{item.result || '—'}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : subTab === 'implementation' ? (
                /* SUB-TAB: TRIỂN KHAI (THEO DÕI NỘI DUNG & THỐNG KÊ DEADLINE) */
                <div>
                  <div style={{ backgroundColor: 'rgba(240, 248, 255, 0.8)', border: '1px solid rgba(180, 210, 240, 0.8)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', color: 'var(--text-main)', fontSize: '0.93rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                    <strong>Theo dõi Triển khai</strong> — tổng hợp tiến độ các Nội dung nghiên cứu (Tỷ lệ hoàn thiện dựa trên số công việc đã xong / tổng hoạt động) và cảnh báo tiến độ hạn chót (Deadline) đồng bộ trực tiếp từ Cơ sở dữ liệu.
                  </div>

                  {/* 1. THỐNG KÊ CÔNG VIỆC: ĐANG LÀM, SẮP TỚI HẠN, TRỄ HẠN */}
                  {(() => {
                    const nowStr = new Date().toISOString().slice(0, 10);
                    const sevenDaysLater = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

                    const inProgressList: any[] = [];
                    const dueSoonList: any[] = [];
                    const overdueList: any[] = [];

                    tasks.forEach((t: any) => {
                      if (t.status !== 'DONE') {
                        inProgressList.push(t);

                        let deadline = '';
                        try {
                          const d = typeof t.description === 'string' ? JSON.parse(t.description) : t.description;
                          deadline = d?.deadline || t.dueDate || '';
                        } catch (e) { }

                        if (deadline) {
                          if (deadline < nowStr) {
                            overdueList.push({ ...t, deadline });
                          } else if (deadline >= nowStr && deadline <= sevenDaysLater) {
                            dueSoonList.push({ ...t, deadline });
                          }
                        }
                      }
                    });

                    return (
                      <div style={{ marginBottom: '2.5rem' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span>Thống kê theo dõi trạng thái & deadline công việc đã giao</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '1.25rem' }}>
                          {/* Card 1: Đang làm */}
                          <div className="card" style={{ padding: '1.25rem', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', borderLeft: '4px solid var(--primary)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>Đang thực hiện</span>
                              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary)', backgroundColor: 'rgba(52, 144, 139, 0.1)', padding: '0.2rem 0.75rem', borderRadius: '999px' }}>{inProgressList.length}</span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Các công việc đã giao đang triển khai hoặc chờ kiểm duyệt</div>
                            <div style={{ maxHeight: '130px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.6rem' }}>
                              {inProgressList.length === 0 ? (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Không có công việc nào đang làm</div>
                              ) : (
                                inProgressList.map((t, idx) => (
                                  <div key={idx} style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>- {t.title}</span>
                                    <span className="badge" style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', backgroundColor: 'rgba(52, 144, 139, 0.1)', color: 'var(--primary)', borderRadius: '4px', fontWeight: 600 }}>{t.status === 'REVIEW' ? 'Chờ duyệt' : 'Đang làm'}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Card 2: Sắp tới hạn */}
                          <div className="card" style={{ padding: '1.25rem', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', borderLeft: '4px solid #D97706', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#D97706', textTransform: 'uppercase' }}>Sắp tới hạn (≤ 7 ngày)</span>
                              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#D97706', backgroundColor: 'rgba(217, 119, 6, 0.1)', padding: '0.2rem 0.75rem', borderRadius: '999px' }}>{dueSoonList.length}</span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Công việc cần ưu tiên hoàn thành đúng hạn chót</div>
                            <div style={{ maxHeight: '130px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.6rem' }}>
                              {dueSoonList.length === 0 ? (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Không có công việc nào sắp tới hạn</div>
                              ) : (
                                dueSoonList.map((t, idx) => (
                                  <div key={idx} style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>- {t.title}</span>
                                    <span style={{ color: '#D97706', fontSize: '0.75rem', fontWeight: 700 }}>Hạn: {t.deadline.split('-').reverse().join('/')}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Card 3: Trễ hạn */}
                          <div className="card" style={{ padding: '1.25rem', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', borderLeft: '4px solid #DC2626', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>Trễ hạn (Overdue)</span>
                              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#DC2626', backgroundColor: 'rgba(220, 38, 38, 0.1)', padding: '0.2rem 0.75rem', borderRadius: '999px' }}>{overdueList.length}</span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Công việc đã qua ngày hạn chót nhưng chưa xong</div>
                            <div style={{ maxHeight: '130px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.6rem' }}>
                              {overdueList.length === 0 ? (
                                <div style={{ fontSize: '0.8rem', color: '#059669', fontStyle: 'italic', fontWeight: 600 }}>Tất cả công việc đều đúng tiến độ</div>
                              ) : (
                                overdueList.map((t, idx) => (
                                  <div key={idx} style={{ fontSize: '0.82rem', color: '#DC2626', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>- {t.title}</span>
                                    <span style={{ color: '#DC2626', fontSize: '0.75rem', fontWeight: 700 }}>Hạn: {t.deadline.split('-').reverse().join('/')}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 2. DANH SÁCH CÁC THẺ NỘI DUNG (% HOÀN THIỆN - SỐ CÔNG VIỆC ĐÃ XONG / TỔNG HOẠT ĐỘNG) */}
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Danh sách Thẻ Nội dung & Tiến độ hoàn thiện (% hoàn thiện - số công việc đã hoàn thiện / tổng số công việc hoạt động)</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {(!researchContents || researchContents.length === 0) ? (
                        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          Chưa có Nội dung nghiên cứu nào được khởi tạo trong Kế hoạch hoạt động.
                        </div>
                      ) : (
                        researchContents.map((rc: any) => {
                          let actList: any[] = [];
                          try {
                            actList = typeof rc.activities === 'string' ? JSON.parse(rc.activities) : (rc.activities || []);
                          } catch (e) { }

                          const totalActivities = actList.length || 1;

                          // Tìm các task trong DB thuộc nội dung nghiên cứu này
                          const rcTasks = tasks.filter((t: any) => {
                            let actCode = '';
                            try {
                              const d = typeof t.description === 'string' ? JSON.parse(t.description) : t.description;
                              actCode = d?.activityCode || '';
                            } catch (e) { }
                            return actCode.startsWith(rc.code) || t.title?.startsWith(rc.code) || (actCode && rc.code && actCode.split('.')[0] === rc.code);
                          });

                          // Tính số hoạt động đã hoàn thiện
                          let completedCount = 0;
                          actList.forEach((act: any, idx: number) => {
                            const actId = act.id || `${rc.code}.${idx + 1}`;
                            const matchingTasks = rcTasks.filter((t: any) => {
                              let actCode = '';
                              try {
                                const d = typeof t.description === 'string' ? JSON.parse(t.description) : t.description;
                                actCode = d?.activityCode || '';
                              } catch (e) { }
                              return actCode === actId || actCode === `${rc.code}.${idx + 1}` || t.title === actId || t.title?.includes(act.activity?.slice(0, 20));
                            });

                            if (matchingTasks.some((t: any) => t.status === 'DONE') || act.status === 'DONE' || act.status === 'Hoàn thành') {
                              completedCount++;
                            }
                          });

                          const percentComplete = Math.min(100, Math.round((completedCount / totalActivities) * 100));

                          return (
                            <div key={rc.id} className="card" style={{ padding: '1.5rem', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                              {/* Header & Trạng thái */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
                                <div>
                                  <span className="badge" style={{ backgroundColor: 'rgba(52, 144, 139, 0.1)', color: 'var(--primary)', fontWeight: 700, fontSize: '0.8rem', padding: '0.25rem 0.65rem', borderRadius: '4px', marginRight: '0.75rem' }}>
                                    Mã nội dung: {rc.code}
                                  </span>
                                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                    {rc.title}
                                  </span>
                                </div>
                                <span className="badge" style={{ backgroundColor: percentComplete === 100 ? '#E8F5E9' : 'rgba(52, 144, 139, 0.1)', color: percentComplete === 100 ? '#2E7D32' : 'var(--primary)', border: percentComplete === 100 ? '1px solid #C8E6C9' : '1px solid rgba(52, 144, 139, 0.3)', fontWeight: 700, fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}>
                                  {percentComplete === 100 ? 'Hoàn thành (100%)' : 'Đang triển khai'}
                                </span>
                              </div>

                              {/* Progress (% hoàn thiện - số công việc đã hoàn thiện / tổng số công việc hoạt động) */}
                              <div style={{ backgroundColor: '#F8FAFC', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>Tiến độ hoàn thiện Nội dung nghiên cứu:</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                      ({completedCount}/{totalActivities} công việc hoạt động đã hoàn thiện)
                                    </span>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
                                      {percentComplete}%
                                    </span>
                                  </div>
                                </div>
                                <div className="progress-container" style={{ height: '10px', backgroundColor: '#E2E8F0', borderRadius: '5px', overflow: 'hidden' }}>
                                  <div className="progress-bar" style={{ width: `${percentComplete}%`, backgroundColor: percentComplete === 100 ? '#10B981' : 'var(--primary)', height: '100%', transition: 'width 0.5s ease' }}></div>
                                </div>
                              </div>

                              {/* Danh sách các công việc / hoạt động bên trong */}
                              <div>
                                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  Danh sách công việc hoạt động thuộc Nội dung ({actList.length}):
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                  {actList.length === 0 ? (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa có hoạt động chi tiết nào</div>
                                  ) : (
                                    actList.map((act: any, idx: number) => {
                                      const actId = act.id || `${rc.code}.${idx + 1}`;
                                      const matchingTasks = rcTasks.filter((t: any) => {
                                        let actCode = '';
                                        try {
                                          const d = typeof t.description === 'string' ? JSON.parse(t.description) : t.description;
                                          actCode = d?.activityCode || '';
                                        } catch (e) { }
                                        return actCode === actId || actCode === `${rc.code}.${idx + 1}` || t.title === actId || t.title?.includes(act.activity?.slice(0, 20));
                                      });

                                      const isDone = matchingTasks.some((t: any) => t.status === 'DONE') || act.status === 'DONE' || act.status === 'Hoàn thành';
                                      const isInProgress = matchingTasks.some((t: any) => t.status === 'IN_PROGRESS' || t.status === 'REVIEW' || t.status === 'TODO');

                                      return (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', backgroundColor: isDone ? '#F0FDF4' : '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1 }}>
                                            <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.88rem', minWidth: '48px' }}>{actId}:</span>
                                            <div style={{ flex: 1 }}>
                                              <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: act.result ? '0.2rem' : 0 }}>
                                                {act.activity || 'Chưa đặt tên hoạt động'}
                                              </div>
                                              {act.result && (
                                                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                                  Kết quả dự kiến: {act.result}
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          {/* Trạng thái đồng bộ DB / Nút giao việc */}
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: '1rem' }}>
                                            {matchingTasks.length > 0 ? (
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {isDone ? (
                                                  <span style={{ backgroundColor: '#E8F5E9', color: '#2E7D32', border: '1px solid #C8E6C9', padding: '0.25rem 0.65rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700 }}>
                                                    Đã hoàn thành (100%)
                                                  </span>
                                                ) : isInProgress ? (
                                                  <span style={{ backgroundColor: 'rgba(52, 144, 139, 0.1)', color: 'var(--primary)', border: '1px solid rgba(52, 144, 139, 0.3)', padding: '0.25rem 0.65rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700 }}>
                                                    Đang thực hiện
                                                  </span>
                                                ) : (
                                                  <span style={{ backgroundColor: '#F5F5F5', color: '#424242', border: '1px solid #E0E0E0', padding: '0.25rem 0.65rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700 }}>
                                                    Đã giao việc
                                                  </span>
                                                )}
                                              </div>
                                            ) : (
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ backgroundColor: '#F5F5F5', color: '#757575', border: '1px solid #E0E0E0', padding: '0.25rem 0.65rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600 }}>
                                                  Chưa giao việc
                                                </span>
                                                {canAssignTasks && (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setSelectedActivityCode(actId);
                                                      setNewTaskTitle(`${actId}: ${act.activity || ''}`);
                                                      setNewTaskExpectedResult(act.result || '');
                                                      setSubTab('tasks');
                                                    }}
                                                    style={{ backgroundColor: 'var(--primary)', color: '#FFF', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                                                  >
                                                    Giao việc ngay
                                                  </button>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              ) : subTab === 'tasks' ? (
                /* SUB-TAB: GIAO VIỆC */
                <div>
                  <div style={{ backgroundColor: 'rgba(240, 248, 255, 0.8)', border: '1px solid rgba(180, 210, 240, 0.8)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', color: 'var(--text-main)', fontSize: '0.93rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                    <strong>Giao việc</strong> — tạo và giao phiếu công việc cho thành viên (chọn từ Nội dung nghiên cứu hoặc nhập tự do). Phần <strong>theo dõi tiến độ · duyệt kết quả · giám sát tuần</strong> nằm ở tab <strong>Tiến độ cá nhân</strong>.
                  </div>

                  {canAssignTasks && (
                    <div className="card" style={{ marginBottom: '1.5rem', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1.25rem' }}>
                        Tạo phiếu giao việc mới <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.9rem' }}>(chọn từ Nội dung nghiên cứu hoặc nhập tự do)</span>
                      </div>
                      {(() => {
                        const allActs: any[] = [];
                        researchContents?.forEach((rc: any) => {
                          let parsed: any[] = [];
                          try {
                            parsed = typeof rc.activities === 'string' ? JSON.parse(rc.activities) : rc.activities;
                          } catch (e) { }
                          if (Array.isArray(parsed)) {
                            parsed.forEach((act: any, idx: number) => {
                              const actId = act.id || `${rc.code}.${idx + 1}`;
                              allActs.push({
                                id: actId,
                                code: actId,
                                activity: act.activity || '',
                                result: act.result || '',
                                rcTitle: rc.title || ''
                              });
                            });
                          }
                        });

                        return (
                          <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            {/* Field 1: Công việc cần giao */}
                            <div>
                              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '0.4rem' }}>
                                Công việc cần giao (*)
                              </label>
                              <select
                                className="select-field"
                                style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.95rem', fontWeight: 500 }}
                                value={selectedActivityCode}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSelectedActivityCode(val);
                                  if (val) {
                                    const found = allActs.find(a => a.code === val);
                                    if (found) {
                                      setNewTaskTitle(`[${found.code}] ${found.activity}`);
                                      setNewTaskExpectedResult(found.result || '');
                                    }
                                  } else {
                                    setNewTaskTitle('');
                                    setNewTaskExpectedResult('');
                                  }
                                }}
                              >
                                <option value="">-- Chọn từ danh sách Hoạt động Nghiên cứu --</option>
                                {allActs.map((act, idx) => (
                                  <option key={idx} value={act.code}>
                                    [{act.code}] {act.activity}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                className="input-field"
                                style={{ width: '100%', marginTop: '0.5rem', padding: '0.65rem 0.85rem', fontSize: '0.95rem' }}
                                placeholder="Hoặc tự nhập tên công việc bên dưới..."
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                required
                              />
                            </div>

                            {/* Row 2: Người giao & Người nhận */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                              <div>
                                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '0.4rem' }}>
                                  Người giao
                                </label>
                                <input
                                  type="text"
                                  className="input-field"
                                  style={{ width: '100%', backgroundColor: '#F8FAFC', color: 'var(--text-main)', fontWeight: 600, padding: '0.65rem 0.85rem' }}
                                  value={user?.name || 'TS. Phạm Hà Thanh Tùng'}
                                  readOnly
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '0.4rem' }}>
                                  Người nhận (*)
                                </label>
                                {(() => {
                                  const assignableUsers: any[] = [];
                                  const addedIds = new Set<number>();

                                  if (project?.manager && !addedIds.has(project.manager.id)) {
                                    assignableUsers.push({ ...project.manager, labelRole: 'Chủ nhiệm đề tài' });
                                    addedIds.add(project.manager.id);
                                  }
                                  if (project?.members && Array.isArray(project.members)) {
                                    project.members.forEach((m: any) => {
                                      if (!addedIds.has(m.id)) {
                                        assignableUsers.push({ ...m, labelRole: 'Thành viên đề tài' });
                                        addedIds.add(m.id);
                                      }
                                    });
                                  }
                                  if (usersList && Array.isArray(usersList)) {
                                    usersList.forEach((u: any) => {
                                      if (!addedIds.has(u.id)) {
                                        assignableUsers.push({ ...u, labelRole: u.role || 'Thành viên Viện' });
                                        addedIds.add(u.id);
                                      }
                                    });
                                  }

                                  return (
                                    <select
                                      className="select-field"
                                      style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.95rem' }}
                                      value={newTaskAssignee}
                                      onChange={(e) => setNewTaskAssignee(e.target.value ? Number(e.target.value) : '')}
                                      required
                                    >
                                      <option value="">-- Chọn người nhận --</option>
                                      {assignableUsers.map(u => (
                                        <option key={u.id} value={u.id}>
                                          {u.name} — ({u.labelRole || u.role})
                                        </option>
                                      ))}
                                    </select>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* Row 3: Kết quả cần đạt */}
                            <div>
                              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '0.4rem' }}>
                                Kết quả cần đạt
                              </label>
                              <textarea
                                className="input-field"
                                style={{ width: '100%', minHeight: '80px', padding: '0.65rem 0.85rem', fontSize: '0.95rem', resize: 'vertical' }}
                                placeholder="Mô tả kết quả cần đạt của công việc..."
                                value={newTaskExpectedResult}
                                onChange={(e) => setNewTaskExpectedResult(e.target.value)}
                              />
                            </div>

                            {/* Row 4: Ngày giao việc & Deadline */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                              <div>
                                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                                  Ngày giao việc
                                </label>
                                <input
                                  type="date"
                                  className="input-field"
                                  style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.95rem' }}
                                  value={newTaskAssignDate}
                                  onChange={(e) => setNewTaskAssignDate(e.target.value)}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                                  Deadline
                                </label>
                                <input
                                  type="date"
                                  className="input-field"
                                  style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.95rem' }}
                                  value={newTaskDeadline}
                                  onChange={(e) => setNewTaskDeadline(e.target.value)}
                                />
                              </div>
                            </div>

                            {/* Button Giao việc */}
                            <div style={{ marginTop: '0.5rem' }}>
                              <button
                                type="submit"
                                style={{
                                  width: '100%',
                                  backgroundColor: '#1E293B',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  borderRadius: 'var(--radius-md)',
                                  padding: '0.85rem 1.5rem',
                                  fontSize: '1rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  boxShadow: 'var(--shadow-sm)'
                                }}
                              >
                                Giao việc
                              </button>
                            </div>
                          </form>
                        );
                      })()}
                    </div>
                  )}

                  {/* Kanban Board */}
                  <div className="kanban-board">
                    {/* Column 1: TODO */}
                    <div className="kanban-col">
                      <div className="kanban-header">
                        <span>CẦN LÀM (TODO)</span>
                        <span className="badge badge-secondary">{todoTasks.length}</span>
                      </div>
                      {todoTasks.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Trống</div>
                      ) : (
                        todoTasks.map(t => (
                          <div key={t.id} className="task-card">
                            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>{t.title}</div>
                            {renderTaskDetails(t.description)}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.875rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700 }}>
                                  {getInitials(t.assignee?.name)}
                                </div>
                                <span>{t.assignee?.name || 'Chưa phân công'}</span>
                              </div>
                              <span>Mới tạo</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => updateTaskStatus(t, 'IN_PROGRESS')}>
                                Bắt đầu
                              </button>
                              {canAssignTasks && (
                                <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteTask(t.id)} style={{ padding: '0.3rem 0.6rem' }}>Xóa</button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Column 2: IN PROGRESS */}
                    <div className="kanban-col">
                      <div className="kanban-header">
                        <span>ĐANG THỰC HIỆN</span>
                        <span className="badge badge-primary">{inProgressTasks.length}</span>
                      </div>
                      {inProgressTasks.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Trống</div>
                      ) : (
                        inProgressTasks.map(t => (
                          <div key={t.id} className="task-card" style={{ borderLeft: '4px solid var(--accent-yellow)' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>{t.title}</div>
                            {renderTaskDetails(t.description)}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.875rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--accent-yellow)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700 }}>
                                  {getInitials(t.assignee?.name)}
                                </div>
                                <span>{t.assignee?.name || 'Chưa phân công'}</span>
                              </div>
                              <span className="badge badge-primary" style={{ backgroundColor: 'var(--accent-yellow)', color: '#000' }}>Đang làm</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => updateTaskStatus(t, 'TODO')} style={{ padding: '0.3rem 0.6rem' }}>
                                Chuyển về Cần làm
                              </button>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {canApproveInProject && (
                                  <button type="button" className="btn btn-primary btn-sm" onClick={() => updateTaskStatus(t, 'DONE')} style={{ backgroundColor: 'var(--primary-light)' }}>
                                    Nghiệm thu hoàn thành
                                  </button>
                                )}
                                {canAssignTasks && (
                                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteTask(t.id)} style={{ padding: '0.3rem 0.6rem' }}>Xóa</button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Column 3: DONE */}
                    <div className="kanban-col">
                      <div className="kanban-header">
                        <span>ĐÃ HOÀN THÀNH</span>
                        <span className="badge badge-success">{doneTasks.length}</span>
                      </div>
                      {doneTasks.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Trống</div>
                      ) : (
                        doneTasks.map(t => (
                          <div key={t.id} className="task-card" style={{ opacity: 0.85, borderLeft: '4px solid var(--primary-light)' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)', textDecoration: 'line-through', marginBottom: '0.5rem' }}>{t.title}</div>
                            {renderTaskDetails(t.description)}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.875rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700 }}>
                                  {getInitials(t.assignee?.name)}
                                </div>
                                <span>{t.assignee?.name || 'Chưa phân công'}</span>
                              </div>
                              <span className="badge badge-success">Đã xong</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => updateTaskStatus(t, 'IN_PROGRESS')}>
                                Làm lại
                              </button>
                              {canAssignTasks && (
                                <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteTask(t.id)} style={{ padding: '0.3rem 0.6rem' }}>Xóa</button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : subTab === 'personal' ? (
                /* SUB-TAB: TIẾN ĐỘ CÁ NHÂN */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="card" style={{ padding: '1.5rem', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary)' }}>
                          {canManageReports ? 'Theo dõi & Kiểm duyệt Tiến độ Báo cáo (Lãnh đạo / Chủ nhiệm)' : 'Tiến độ Công việc Cá nhân (Chuyên viên / Thành viên)'}
                        </h3>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                          {canManageReports
                            ? 'Danh sách toàn bộ công việc và tệp báo cáo do thành viên tải lên để nghiệm thu'
                            : 'Danh sách công việc được phân công cho cá nhân bạn trong đề tài này'}
                        </p>
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, padding: '0.35rem 0.85rem', borderRadius: '20px', backgroundColor: '#F1F5F9', color: 'var(--text-main)' }}>
                        Tổng công việc: {canManageReports ? tasks.length : tasks.filter(t => t.assigneeId === user?.id).length}
                      </span>
                    </div>

                    {(() => {
                      const displayTasks = canManageReports ? tasks : tasks.filter(t => t.assigneeId === user?.id);
                      if (displayTasks.length === 0) {
                        return (
                          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            {canManageReports ? 'Chưa có công việc nào được phân công trong đề tài này.' : 'Bạn chưa được phân công công việc nào trong đề tài này.'}
                          </div>
                        );
                      }

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {displayTasks.map((t: any) => {
                            let descObj: any = {};
                            try {
                              descObj = typeof t.description === 'string' ? JSON.parse(t.description) : (t.description || {});
                            } catch (e) { }

                            const isDone = t.status === 'DONE';
                            const isReview = t.status === 'REVIEW';
                            const statusColor = isDone ? '#10B981' : isReview ? '#D97706' : 'var(--primary)';
                            const statusBg = isDone ? 'rgba(16, 185, 129, 0.1)' : isReview ? 'rgba(217, 119, 6, 0.1)' : 'rgba(52, 144, 139, 0.1)';
                            const statusText = isDone ? 'Đã hoàn thành' : isReview ? 'Chờ kiểm duyệt (Đã nộp báo cáo)' : 'Đang thực hiện';

                            return (
                              <div key={t.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem', backgroundColor: '#F8FAFC' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                                      {t.title}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                      {canManageReports && (
                                        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                          Người thực hiện: {t.assignee?.name || 'Chưa phân công'} ({t.assignee?.role || 'N/A'})
                                        </span>
                                      )}
                                      {descObj.activityCode && (
                                        <span>Mã nội dung: <strong>{descObj.activityCode}</strong></span>
                                      )}
                                      {descObj.deadline && (
                                        <span>Hạn hoàn thành: <strong>{descObj.deadline}</strong></span>
                                      )}
                                      {descObj.assignDate && (
                                        <span>Ngày giao: {descObj.assignDate}</span>
                                      )}
                                    </div>
                                  </div>

                                  <span style={{ padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700, color: statusColor, backgroundColor: statusBg, border: `1px solid ${statusColor}` }}>
                                    {statusText}
                                  </span>
                                </div>

                                {descObj.expectedResult && (
                                  <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', backgroundColor: '#FFFFFF', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                                    <strong style={{ color: 'var(--primary)' }}>Kết quả cần đạt: </strong> {descObj.expectedResult}
                                  </div>
                                )}

                                {descObj.rejectReason && !isDone && (
                                  <div style={{ fontSize: '0.88rem', color: '#DC2626', backgroundColor: '#FEF2F2', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid #FECACA', marginBottom: '1rem' }}>
                                    <strong>Ý kiến chỉnh sửa từ Lãnh đạo / Chủ nhiệm: </strong> {descObj.rejectReason}
                                  </div>
                                )}

                                {/* Report File Section */}
                                <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                                  {descObj.reportFile ? (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', backgroundColor: '#FFFFFF', padding: '0.85rem 1.15rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                      <div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                          Tệp báo cáo đã nộp: {descObj.reportFile.name}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                          Dung lượng: {descObj.reportFile.size} - Nộp lúc: {descObj.reportFile.submittedAt || 'N/A'}
                                        </div>
                                      </div>

                                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <a
                                          href={descObj.reportFile.dataUrl || `data:text/plain;charset=utf-8,Noi%20dung%20bao%20cao:%20${encodeURIComponent(descObj.reportFile.name)}`}
                                          download={descObj.reportFile.name}
                                          className="btn btn-secondary btn-sm"
                                          style={{ padding: '0.45rem 0.95rem', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}
                                        >
                                          Tải về báo cáo
                                        </a>

                                        {canManageReports && !isDone && (
                                          <>
                                            <button
                                              type="button"
                                              className="btn btn-primary btn-sm"
                                              style={{ padding: '0.45rem 0.95rem', fontSize: '0.85rem', fontWeight: 700 }}
                                              onClick={() => handleApproveReport(t.id)}
                                            >
                                              Nghiệm thu hoàn thành
                                            </button>
                                            <button
                                              type="button"
                                              className="btn btn-secondary btn-sm"
                                              style={{ padding: '0.45rem 0.95rem', fontSize: '0.85rem', fontWeight: 600, color: '#DC2626', borderColor: '#FECACA' }}
                                              onClick={() => handleRequestRevision(t)}
                                            >
                                              Yêu cầu chỉnh sửa
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  ) : !canManageReports && !isDone ? (
                                    /* Upload input for specialist / member */
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: '#FFFFFF', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                                      <label style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                        Nộp file báo cáo công việc (PDF, Word, Excel, ZIP...):
                                      </label>
                                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <input
                                          type="file"
                                          onChange={(e) => handleFileChange(t.id, e)}
                                          style={{ fontSize: '0.88rem', flex: 1 }}
                                        />
                                        <button
                                          type="button"
                                          className="btn btn-primary btn-sm"
                                          disabled={!uploadFiles[t.id] || submittingReportTaskId === t.id}
                                          onClick={() => handleSubmitReport(t)}
                                          style={{ padding: '0.55rem 1.25rem', fontSize: '0.88rem', fontWeight: 700 }}
                                        >
                                          {submittingReportTaskId === t.id ? 'Đang nộp...' : 'Nộp báo cáo'}
                                        </button>
                                      </div>
                                      {uploadFiles[t.id] && (
                                        <div style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>
                                          Đã chọn tệp: {uploadFiles[t.id].name} ({uploadFiles[t.id].size})
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                      Chưa có báo cáo nào được nộp cho công việc này.
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                /* SUB-TAB: TÍNH CÔNG & THÙ LAO */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {(() => {
                    const memberStats = (project.members || []).map((m: any) => {
                      const mTasks = tasks.filter(t => t.assigneeId === m.id);
                      let totalWorkDays = 0;
                      let totalPaymentPercent = 0;
                      mTasks.forEach(t => {
                        let descObj: any = {};
                        try {
                          descObj = typeof t.description === 'string' ? JSON.parse(t.description) : (t.description || {});
                        } catch (e) { }
                        totalWorkDays += (descObj.workDays || 0);
                        totalPaymentPercent += (descObj.paymentPercentage || 0);
                      });
                      const estimatedCost = ((project.laborBudget || 0) * totalPaymentPercent) / 100;
                      return { member: m, totalWorkDays, totalPaymentPercent, estimatedCost, mTasks };
                    });

                    // Tính tổng tất cả phần trăm để cảnh báo nếu vượt quá 100%
                    const globalTotalPercent = memberStats.reduce((sum, ms) => sum + ms.totalPaymentPercent, 0);

                    return (
                      <>
                        {/* Summary Card */}
                        <div className="card" style={{ padding: '1.5rem', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
                            <div>
                              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary)' }}>
                                Bảng Tổng Hợp Tính Công & Thù Lao
                              </h3>
                              <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                                Tổng kinh phí nhân công của đề tài: <strong style={{ color: 'var(--text-main)' }}>{(project.laborBudget || 0).toLocaleString('vi-VN')} VNĐ</strong>
                              </p>
                            </div>
                            {globalTotalPercent > 100 && (
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, padding: '0.35rem 0.85rem', borderRadius: '20px', backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                                Cảnh báo: Tổng % thanh toán vượt 100% ({globalTotalPercent}%)
                              </span>
                            )}
                          </div>

                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid var(--border-color)' }}>
                                  <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Thành viên</th>
                                  <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>Số công</th>
                                  <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>% Thanh toán</th>
                                  <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>Ước tính chi phí (VNĐ)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {memberStats.map((stat, idx) => (
                                  <tr key={stat.member.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                                    <td style={{ padding: '0.75rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {stat.member.avatar ? (
                                          <img src={stat.member.avatar} alt={stat.member.name} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                          <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700 }}>
                                            {getInitials(stat.member.name)}
                                          </div>
                                        )}
                                        <div>
                                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{stat.member.name}</div>
                                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{stat.member.role}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--primary)' }}>
                                      {stat.totalWorkDays}
                                    </td>
                                    <td style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, color: 'var(--accent-green)' }}>
                                      {stat.totalPaymentPercent}%
                                    </td>
                                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--text-main)' }}>
                                      {stat.estimatedCost.toLocaleString('vi-VN')}
                                    </td>
                                  </tr>
                                ))}
                                {memberStats.length === 0 && (
                                  <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                      Chưa có thành viên nào trong đề tài.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Detailed Member Accounting List */}
                        {memberStats.map(stat => (
                          <div key={stat.member.id} className="card" style={{ padding: '1.25rem', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                              {stat.member.avatar ? (
                                <img src={stat.member.avatar} alt={stat.member.name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 700 }}>
                                  {getInitials(stat.member.name)}
                                </div>
                              )}
                              <div>
                                <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-main)' }}>{stat.member.name}</h4>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tổng giao việc: {stat.mTasks.length} nhiệm vụ</div>
                              </div>
                            </div>

                            {stat.mTasks.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                Chưa được giao công việc nào.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {stat.mTasks.map(t => {
                                  let descObj: any = {};
                                  try {
                                    descObj = typeof t.description === 'string' ? JSON.parse(t.description) : (t.description || {});
                                  } catch (e) { }

                                  return (
                                    <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '1.5rem', alignItems: 'center', backgroundColor: '#F8FAFC', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                      <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '0.2rem' }}>{t.title}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                          {descObj.activityCode ? `Mã ND: ${descObj.activityCode}` : 'Không có mã nội dung'}
                                          {' • '}
                                          <span style={{ color: t.status === 'DONE' ? 'var(--accent-green)' : 'var(--primary)' }}>
                                            {t.status === 'DONE' ? 'Đã hoàn thành' : 'Đang xử lý'}
                                          </span>
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Số công</label>
                                        <input
                                          type="number"
                                          step="0.1"
                                          min="0"
                                          className="input-field"
                                          style={{ width: '80px', padding: '0.35rem 0.5rem', fontSize: '0.9rem', textAlign: 'center' }}
                                          defaultValue={descObj.workDays || 0}
                                          onBlur={(e) => handleUpdateTaskAccounting(t.id, 'workDays', Number(e.target.value))}
                                          disabled={!canAssignTasks}
                                        />
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>% Thanh toán</label>
                                        <input
                                          type="number"
                                          step="0.1"
                                          min="0"
                                          max="100"
                                          className="input-field"
                                          style={{ width: '80px', padding: '0.35rem 0.5rem', fontSize: '0.9rem', textAlign: 'center' }}
                                          defaultValue={descObj.paymentPercentage || 0}
                                          onBlur={(e) => handleUpdateTaskAccounting(t.id, 'paymentPercentage', Number(e.target.value))}
                                          disabled={!canAssignTasks}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* MODAL EDIT GENERAL INFO */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" style={{ maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Cập nhật thông tin chung đề tài</div>
              <button type="button" className="modal-close-btn" onClick={() => setShowEditModal(false)}>Đóng</button>
            </div>

            <form onSubmit={handleUpdateGeneralInfo}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="input-group">
                  <label className="input-label">Tên đề tài (Tiếng Việt) (*)</label>
                  <input
                    type="text"
                    className="input-field"
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Tên đề tài tiếng Anh / Phụ đề</label>
                  <textarea
                    className="textarea-field"
                    rows={2}
                    placeholder="VD: Ethno-herbal medicine screening for dementia treatment..."
                    value={editForm.nameEn || ''}
                    onChange={(e) => setEditForm({ ...editForm, nameEn: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  <div className="input-group">
                    <label className="input-label">Mã số đề tài</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="VD: 108.05-2023.20"
                      value={editForm.code || ''}
                      onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Loại đề tài</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="VD: Nghiên cứu cơ bản trong KHTN & KT"
                      value={editForm.projectType || ''}
                      onChange={(e) => setEditForm({ ...editForm, projectType: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  <div className="input-group">
                    <label className="input-label">Đơn vị quản lý</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="VD: Quỹ Phát triển KH&CN Quốc gia (NAFOSTED)"
                      value={editForm.managementUnit || ''}
                      onChange={(e) => setEditForm({ ...editForm, managementUnit: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Tổ chức chủ trì</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="VD: Trường Đại học Phenikaa"
                      value={editForm.hostOrganization || ''}
                      onChange={(e) => setEditForm({ ...editForm, hostOrganization: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  <div className="input-group">
                    <label className="input-label">Cố vấn chuyên môn</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="VD: PGS.TS. Trần Văn Ơn"
                      value={editForm.advisor || ''}
                      onChange={(e) => setEditForm({ ...editForm, advisor: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Thời gian thực hiện</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="VD: 36 tháng · 08/2024 – 08/2027"
                      value={editForm.executionTime || ''}
                      onChange={(e) => setEditForm({ ...editForm, executionTime: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  <div className="input-group">
                    <label className="input-label">Kinh phí đề tài</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="VD: 1.037.000.000 đồng (737.000.000 đ khoán...)"
                      value={editForm.budget || ''}
                      onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })}
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Kinh phí nhân công (VNĐ)</label>
                    <input
                      type="number"
                      className="input-field"
                      placeholder="VD: 100000000"
                      value={editForm.laborBudget || ''}
                      onChange={(e) => setEditForm({ ...editForm, laborBudget: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Mục tiêu tổng quát</label>
                  <textarea
                    className="textarea-field"
                    rows={3}
                    placeholder="Mục tiêu nghiên cứu, phạm vi ứng dụng của đề tài..."
                    value={editForm.generalObjective || ''}
                    onChange={(e) => setEditForm({ ...editForm, generalObjective: e.target.value })}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Thành viên tham gia đề tài (Đồng bộ tài khoản DB)</label>
                  <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0.6rem', backgroundColor: 'rgba(255, 255, 255, 0.5)' }}>
                    {usersList.map((u: any) => {
                      const isChecked = (editForm.memberIds || []).includes(u.id);
                      return (
                        <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.35rem 0', borderBottom: '1px solid rgba(0,0,0,0.05)', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const currentIds = editForm.memberIds || [];
                              if (e.target.checked) {
                                setEditForm({ ...editForm, memberIds: [...currentIds, u.id] });
                              } else {
                                setEditForm({ ...editForm, memberIds: currentIds.filter((id: number) => id !== u.id) });
                              }
                            }}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                          />
                          <span style={{ fontWeight: 600 }}>{u.name}</span>
                          <span className="badge badge-secondary" style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem' }}>{u.role}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({u.email})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Lưu Thay Đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREATE/EDIT RESEARCH CONTENT (SUB-CARDS) */}
      {showResearchModal && (
        <div className="modal-overlay" onClick={() => setShowResearchModal(false)}>
          <div className="modal-content" style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {editingResearchId ? 'Cập nhật nội dung nghiên cứu' : 'Thêm nội dung nghiên cứu mới'}
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setShowResearchModal(false)}>Đóng</button>
            </div>

            <form onSubmit={handleSaveResearchContent}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 180px', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="input-label">Mã nội dung (*)</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="VD: ND1, ND2..."
                      value={researchForm.code || ''}
                      onChange={(e) => setResearchForm({ ...researchForm, code: e.target.value })}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Tiêu đề nội dung (*)</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="VD: Điều tra dân tộc học cây thuốc SSTT..."
                      value={researchForm.title || ''}
                      onChange={(e) => setResearchForm({ ...researchForm, title: e.target.value })}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label">Trạng thái</label>
                    <select
                      className="select-field"
                      value={researchForm.status || 'Xong 100%'}
                      onChange={(e) => setResearchForm({ ...researchForm, status: e.target.value })}
                    >
                      <option value="Xong 100%">Xong 100%</option>
                      <option value="Đang thực hiện">Đang thực hiện</option>
                      <option value="Chưa bắt đầu">Chưa bắt đầu</option>
                    </select>
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Mô tả tổng quan nội dung</label>
                  <textarea
                    className="textarea-field"
                    rows={2}
                    placeholder="VD: Thu thập tri thức bản địa người Dao về cây thuốc trị SSTT..."
                    value={researchForm.description || ''}
                    onChange={(e) => setResearchForm({ ...researchForm, description: e.target.value })}
                  />
                </div>

                {/* Activities Table Input */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <label className="input-label" style={{ margin: 0, fontSize: '0.95rem' }}>
                      Danh sách Hoạt động & Kết quả tương ứng
                    </label>
                    <button
                      type="button"
                      onClick={handleAddActivityRow}
                      style={{
                        background: 'transparent',
                        border: '1px dashed var(--primary)',
                        color: 'var(--primary)',
                        padding: '0.35rem 0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        cursor: 'pointer'
                      }}
                    >
                      Thêm dòng hoạt động
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {researchForm.activitiesList.map((item: any, idx: number) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'center', backgroundColor: 'var(--bg-main)', padding: '0.75rem', borderRadius: '8px' }}>
                        <div>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Tên hoạt động thực hiện..."
                            value={item.activity}
                            onChange={(e) => handleActivityChange(idx, 'activity', e.target.value)}
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Kết quả / Sản phẩm tương ứng..."
                            value={item.result}
                            onChange={(e) => handleActivityChange(idx, 'result', e.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveActivityRow(idx)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--accent-red)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            padding: '0.4rem 0.6rem',
                            fontSize: '0.85rem'
                          }}
                          title="Xóa dòng"
                        >
                          Xóa
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowResearchModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">Lưu nội dung</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
