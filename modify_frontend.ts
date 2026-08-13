import * as fs from 'fs';

let content = fs.readFileSync('frontend/src/pages/StationeryManagement.tsx', 'utf-8');

// 1. Tab definitions
content = content.replace(
  "type Tab = 'warehouse' | 'projections' | 'statistics' | 'history';",
  "type Tab = 'warehouse' | 'projections' | 'statistics' | 'history';"
);

// 2. State replacements
content = content.replace(
  /const \[proposalTab, setProposalTab\] = [^\n]+;\n/g,
  ''
);

content = content.replace(
  /const \[modal, setModal\] = useState\<'none' \| 'import' \| 'export' \| 'edit' \| 'alert' \| 'proposal'\>\('none'\);/,
  "const [modal, setModal] = useState<'none' | 'import' | 'export' | 'edit' | 'alert' | 'projection'>('none');"
);

content = content.replace(
  /  \/\/ Proposal form\n  const \[proposals, setProposals\][\s\S]*?const \[proposalNote, setProposalNote\] = useState\(''\);/,
  `  // Projection state
  const [projectionMonth, setProjectionMonth] = useState(new Date().getMonth() + 1);
  const [projectionYear, setProjectionYear] = useState(new Date().getFullYear());
  const [projection, setProjection] = useState<Projection | null>(null);
  const [projectionForm, setProjectionForm] = useState({ stationeryId: '', name: '', unit: '', quantity: '', note: '' });`
);

// 3. Fetchers
content = content.replace(
  /  const fetchProposals = useCallback[\s\S]*?\}, \[\]\);/g,
  `  const fetchProjection = useCallback(async () => {
    try {
      const res = await apiClient.get<Projection>(\`/stationeries/projections?month=\${projectionMonth}&year=\${projectionYear}\`);
      setProjection(res.data);
    } catch (e) {
      console.error(e);
    }
  }, [projectionMonth, projectionYear]);`
);

content = content.replace(
  /useEffect\(\(\) => \{ if \(activeTab === 'proposals'\) fetchProposals\(\); \}, \[activeTab, fetchProposals\]\);/,
  `useEffect(() => { if (activeTab === 'projections') fetchProjection(); }, [activeTab, fetchProjection]);`
);

// 4. Actions
// Remove fetchApprovers, handleOpenProposal, handleProposalSubmit, handleProposalAction, handleExportProposal
content = content.replace(
  /  const fetchApprovers = async[\s\S]*?  const handleExportProposal = async[\s\S]*?    \} catch \(e\) \{\n      console\.error\(e\);\n    \}\n  \};/g,
  `  const handleAddProjection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projection) return;
    try {
      await apiClient.post(\`/stationeries/projections/\${projection.id}/items\`, {
        stationeryId: projectionForm.stationeryId,
        name: projectionForm.name,
        unit: projectionForm.unit,
        quantity: Number(projectionForm.quantity),
        note: projectionForm.note
      });
      setModal('none');
      fetchProjection();
      setAlertBanner('Thêm vào dự trù thành công!');
      setTimeout(() => setAlertBanner(null), 3000);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Lỗi thêm dự trù');
    }
  };

  const handleExportProjectionExcel = async () => {
    if (!projection) return;
    try {
      const res = await apiClient.get(\`/stationeries/projections/\${projection.id}/export\`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', \`Du_Tru_VPP_Thang_\${projectionMonth}_\${projectionYear}.xlsx\`);
      document.body.appendChild(link);
      link.click();
    } catch (e) {
      console.error(e);
      alert('Lỗi khi tải file Excel');
    }
  };

  const handleDeleteProjectionItem = async (itemId: number) => {
    if (!confirm('Bạn có chắc xoá mục này khỏi dự trù?')) return;
    try {
      await apiClient.delete(\`/stationeries/projections/items/\${itemId}\`);
      fetchProjection();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Lỗi xoá');
    }
  };`
);

// 5. Tab UI Button
content = content.replace(
  /\{ key: 'proposals', label: 'Tiến Trình Đề Xuất' \},/,
  `{ key: 'projections', label: 'Dự Trù Văn Phòng Phẩm' },`
);

// Remove "Đề Xuất Văn Phòng Phẩm" button
content = content.replace(
  /            <button className="btn" onClick=\{handleOpenProposal\}[^\n]*?>\n              Đề Xuất Văn Phòng Phẩm\n            <\/button>/,
  ""
);

// 6. Replace Proposals Tab UI with Projection Tab UI
content = content.replace(
  /      \{\/\* ── TAB: ĐỀ XUẤT ── \*\/\}\n      \{activeTab === 'proposals' && \([\s\S]*?      \{\/\* ── TAB: THỐNG KÊ ── \*\/\}/g,
  `      {/* ── TAB: DỰ TRÙ ── */}
      {activeTab === 'projections' && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid var(--border-color)', background: '#F8FAFC' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ fontWeight: 600 }}>Tháng:</div>
              <input type="number" min="1" max="12" value={projectionMonth} onChange={e => setProjectionMonth(Number(e.target.value))} className="input-field" style={{ width: '80px' }} />
              <div style={{ fontWeight: 600 }}>Năm:</div>
              <input type="number" value={projectionYear} onChange={e => setProjectionYear(Number(e.target.value))} className="input-field" style={{ width: '100px' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-primary" onClick={() => { setProjectionForm({ stationeryId: '', name: '', unit: '', quantity: '', note: '' }); setModal('projection'); }}>+ Thêm Vào Dự Trù</button>
              <button className="btn btn-primary" onClick={handleExportProjectionExcel}>⬇ Xuất Excel Dự Trù</button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.82rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.9rem 1rem' }}>STT</th>
                  <th style={{ padding: '0.9rem 1rem' }}>Mã VPP</th>
                  <th style={{ padding: '0.9rem 1rem' }}>Tên Văn Phòng Phẩm</th>
                  <th style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>Đơn Vị</th>
                  <th style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>Số Lượng</th>
                  <th style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>Tồn Kho</th>
                  <th style={{ padding: '0.9rem 1rem' }}>Người Thêm</th>
                  <th style={{ padding: '0.9rem 1rem' }}>Ghi Chú</th>
                  <th style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {!projection?.items?.length ? (
                  <tr><td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có dự trù nào cho tháng này.</td></tr>
                ) : projection.items.map((item, idx) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ padding: '0.85rem 1rem' }}>{item.stationery?.code || '-'}</td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{item.name}</td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>{item.unit}</td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>{item.quantity}</td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                      {item.stationeryId ? stationerys.find(s => s.id === item.stationeryId)?.quantity || '-' : '-'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>{item.addedBy?.name || 'Hệ thống tự động'}</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{item.note || '-'}</td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <button onClick={() => handleDeleteProjectionItem(item.id)} style={{ padding: '0.3rem 0.75rem', borderRadius: '6px', border: '1px solid #FFCCC7', background: '#fff', color: '#FF4D4F', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>Xoá</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: THỐNG KÊ ── */}`
);

// 7. Modal
content = content.replace(
  /      \{\/\* Proposal Modal \*\/\}\n      \{modal === 'proposal' && \([\s\S]*?      \{\/\* Add \/ Edit Modal \*\/\}/g,
  `      {/* Add Projection Item Modal */}
      {modal === 'projection' && (
        <div className="modal-overlay" onClick={() => setModal('none')}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Thêm Văn Phòng Phẩm Vào Dự Trù</div>
              <button className="modal-close-btn" onClick={() => setModal('none')}>Đóng</button>
            </div>
            <form onSubmit={handleAddProjection}>
              <div className="modal-body" style={{ display: 'grid', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Chọn từ danh sách có sẵn (Tùy chọn)</label>
                  <input
                    type="text"
                    list="projection-stationery-list"
                    className="input-field"
                    placeholder="Nhập mã hoặc tên văn phòng phẩm..."
                    value={projectionForm.stationeryId ? \`\${stationerys.find(c => c.id === Number(projectionForm.stationeryId))?.code} - \${stationerys.find(c => c.id === Number(projectionForm.stationeryId))?.name}\` : projectionForm.name}
                    onChange={e => {
                      const val = e.target.value;
                      const match = stationerys.find(c => \`\${c.code} - \${c.name}\` === val);
                      if (match) {
                        setProjectionForm({ ...projectionForm, stationeryId: match.id.toString(), name: match.name, unit: match.unit });
                      } else {
                        setProjectionForm({ ...projectionForm, stationeryId: '', name: val });
                      }
                    }}
                  />
                  <datalist id="projection-stationery-list">
                    {stationerys.map(c => (
                      <option key={c.id} value={\`\${c.code} - \${c.name}\`} />
                    ))}
                  </datalist>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="input-label">Tên Văn Phòng Phẩm (*)</label>
                    <input type="text" className="input-field" required value={projectionForm.name} onChange={e => setProjectionForm({ ...projectionForm, name: e.target.value })} disabled={!!projectionForm.stationeryId} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Đơn Vị Tính (*)</label>
                    <input type="text" className="input-field" required value={projectionForm.unit} onChange={e => setProjectionForm({ ...projectionForm, unit: e.target.value })} disabled={!!projectionForm.stationeryId} />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Số Lượng Cần Dự Trù (*)</label>
                  <input type="number" min="0.001" step="any" className="input-field" required value={projectionForm.quantity} onChange={e => setProjectionForm({ ...projectionForm, quantity: e.target.value })} />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Ghi Chú</label>
                  <input type="text" className="input-field" placeholder="Ghi chú thêm..." value={projectionForm.note} onChange={e => setProjectionForm({ ...projectionForm, note: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal('none')}>Huỷ</button>
                <button type="submit" className="btn btn-primary">Xác Nhận Thêm</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}`
);

fs.writeFileSync('frontend/src/pages/StationeryManagement.tsx', content);
