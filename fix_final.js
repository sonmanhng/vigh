const fs = require('fs');
const path = 'frontend/src/pages/StationeryManagement.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix emptyImport
content = content.replace(
  /const emptyImport = \(\) => \(\{\n\s*code: '', name: '', unit: 'Lít', quantity: '' as number \| '',\n\}\);/g,
  `const emptyImport = () => ({\n  code: '', name: '', unit: 'Lít', quantity: '' as number | '', alertThreshold: 5, note: ''\n});`
);

// Add modal for projection
const projectionModalJSX = `
      {modal === 'projection' && (
        <div className="modal-overlay" onClick={() => setModal('none')}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Thêm Dự Trù Văn Phòng Phẩm</div>
              <button className="modal-close-btn" onClick={() => setModal('none')}>Đóng</button>
            </div>
            <form onSubmit={handleAddProjection}>
              <div className="modal-body" style={{ display: 'grid', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Chọn VPP có sẵn (Không bắt buộc)</label>
                  <select className="input-field" value={projectionForm.stationeryId} onChange={e => {
                    const id = e.target.value;
                    if (id) {
                      const c = stationerys.find(x => x.id === Number(id));
                      if (c) setProjectionForm(p => ({ ...p, stationeryId: id, name: c.name, unit: c.unit }));
                    } else {
                      setProjectionForm(p => ({ ...p, stationeryId: '' }));
                    }
                  }}>
                    <option value="">-- Nhập mới bên dưới hoặc chọn có sẵn --</option>
                    {stationerys.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Tên VPP (Nếu nhập mới) (*)</label>
                  <input type="text" required className="input-field" value={projectionForm.name} onChange={e => setProjectionForm(p => ({ ...p, name: e.target.value }))} disabled={!!projectionForm.stationeryId} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="input-group">
                    <label className="input-label">Đơn vị (*)</label>
                    <input type="text" required className="input-field" value={projectionForm.unit} onChange={e => setProjectionForm(p => ({ ...p, unit: e.target.value }))} disabled={!!projectionForm.stationeryId} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Số lượng dự trù (*)</label>
                    <input type="number" required min="1" className="input-field" value={projectionForm.quantity} onChange={e => setProjectionForm(p => ({ ...p, quantity: e.target.value }))} />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Ghi chú</label>
                  <input type="text" className="input-field" value={projectionForm.note} onChange={e => setProjectionForm(p => ({ ...p, note: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal('none')}>Huỷ</button>
                <button type="submit" className="btn btn-primary">Thêm Vào Dự Trù</button>
              </div>
            </form>
          </div>
        </div>
      )}
`;

content = content.replace('    </div>\n  );\n};\n\nexport default StationeryManagement;', projectionModalJSX + '    </div>\n  );\n};\n\nexport default StationeryManagement;');

fs.writeFileSync(path, content);
console.log('Fixed StationeryManagement.tsx');
