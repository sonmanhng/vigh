const fs = require('fs');
const path = 'frontend/src/pages/StationeryManagement.tsx';
let content = fs.readFileSync(path, 'utf8');

const handlersToAdd = `
  const handleDelete = async (id: number, name: string) => {
    if (!confirm(\`Xoá văn phòng phẩm "\${name}"? Hành động này không thể hoàn tác.\`)) return;
    try {
      await apiClient.delete(\`/stationeries/\${id}\`);
      fetchStationerys();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi xoá văn phòng phẩm');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedStationerys.length === 0) return;
    if (!confirm(\`Xoá \${selectedStationerys.length} văn phòng phẩm đã chọn? Hành động này không thể hoàn tác.\`)) return;
    try {
      await apiClient.post('/stationeries/bulk-delete', { ids: selectedStationerys });
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
      quantity: 0
    });
    setModal('edit');
  };

  const handleAddProjection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/stationeries/projections', {
        month: projectionMonth,
        year: projectionYear,
        stationeryId: projectionForm.stationeryId ? Number(projectionForm.stationeryId) : null,
        name: projectionForm.name,
        unit: projectionForm.unit,
        quantity: Number(projectionForm.quantity),
        note: projectionForm.note
      });
      setModal('none');
      setProjectionForm({ stationeryId: '', name: '', unit: '', quantity: '', note: '' });
      fetchProjection();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi thêm dự trù');
    }
  };

  const handleExportProjectionExcel = async () => {
    if (!projection) return;
    try {
      const res = await apiClient.get(\`/stationeries/projections/\${projection.id}/export\`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', \`DuTruVPP_Thang\${projection.month}_\${projection.year}.xlsx\`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (e: any) {
      setError('Lỗi xuất Excel dự trù');
    }
  };

  const handleDeleteProjectionItem = async (itemId: number) => {
    if (!confirm('Bạn có chắc chắn muốn xoá mục này khỏi dự trù?')) return;
    try {
      await apiClient.delete(\`/stationeries/projections/items/\${itemId}\`);
      fetchProjection();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Lỗi xoá mục dự trù');
    }
  };

`;

const targetString = '  // ── Derived ───────────────────────────────────────────────────────────────';
const targetIndex = content.lastIndexOf(targetString);

if (targetIndex !== -1) {
  content = content.slice(0, targetIndex) + handlersToAdd + content.slice(targetIndex);
  fs.writeFileSync(path, content);
  console.log('Successfully injected handlers!');
} else {
  console.error('Target string not found!');
}
