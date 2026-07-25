import { apiClient } from '../api/client';

export interface WeeklyReportResultItem {
  id?: number;
  projectId?: number | null;
  description?: string;
  fileUrl?: string | null;
  fileName?: string | null;
  project?: {
    id: number;
    name: string;
    code?: string;
    topicCode?: string;
  } | null;
  fileIndex?: number | null;
  file?: File | null;
}

export interface WeeklyReportPlanItem {
  id?: number;
  projectId?: number | null;
  customTitle?: string | null;
  description?: string;
  project?: {
    id: number;
    name: string;
    code?: string;
    topicCode?: string;
  } | null;
}

export interface WeeklyReport {
  id: number;
  reporterId: number;
  reporter: {
    id: number;
    name: string;
    email: string;
    department?: string;
    avatar?: string;
  };
  recipientId: number;
  recipient: {
    id: number;
    name: string;
    email: string;
    department?: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
  results: WeeklyReportResultItem[];
  plans: WeeklyReportPlanItem[];
}

export const weeklyReportService = {
  createReport: async (recipientId: number, results: WeeklyReportResultItem[], plans: WeeklyReportPlanItem[]) => {
    const formData = new FormData();
    formData.append('recipientId', String(recipientId));

    const resultsPayload = results.map((r, idx) => {
      let fileIdx = null;
      if (r.file) {
        fileIdx = idx; // simple mapping
        formData.append('files', r.file);
      }
      return {
        projectId: r.projectId || null,
        description: r.description || '',
        fileIndex: fileIdx
      };
    });

    const plansPayload = plans.map(p => ({
      projectId: p.projectId || null,
      customTitle: p.customTitle || null,
      description: p.description || ''
    }));

    formData.append('results', JSON.stringify(resultsPayload));
    formData.append('plans', JSON.stringify(plansPayload));

    const res = await apiClient.post('/weekly-reports', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  getReports: async (tab: 'sent' | 'received' | 'all' = 'received'): Promise<WeeklyReport[]> => {
    const res = await apiClient.get('/weekly-reports', { params: { tab } });
    return res.data;
  },

  deleteReport: async (id: number) => {
    const res = await apiClient.delete(`/weekly-reports/${id}`);
    return res.data;
  },

  downloadDocx: async (id: number, reporterName?: string) => {
    const response = await apiClient.get(`/weekly-reports/${id}/docx`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bao_cao_tuan_${reporterName ? reporterName.replace(/\s+/g, '_') : 'CB'}_${Date.now()}.docx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  downloadFile: async (resultId: number, fileName: string) => {
    const response = await apiClient.get(`/weekly-reports/download-file/${resultId}`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName || 'file_ket_qua');
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
};
