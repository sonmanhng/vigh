import { apiClient } from '../api/client';

export interface Notification {
  id: number;
  userId: number;
  title: string;
  message: string;
  isRead: boolean;
  type: string;
  link?: string;
  createdAt: string;
}

export const notificationService = {
  getNotifications: async () => {
    const res = await apiClient.get('/notifications');
    return res.data;
  },

  markAsRead: async (id: number) => {
    const res = await apiClient.put(`/notifications/${id}/read`);
    return res.data;
  },

  markAllAsRead: async () => {
    const res = await apiClient.put('/notifications/read-all');
    return res.data;
  }
};
