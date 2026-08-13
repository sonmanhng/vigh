import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

async function generate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('VPP');

  sheet.columns = [
    { header: 'Mã VPP (*)', key: 'code', width: 15 },
    { header: 'Tên Văn Phòng Phẩm (*)', key: 'name', width: 30 },
    { header: 'Đơn vị tính', key: 'unit', width: 15 },
    { header: 'Số lượng', key: 'quantity', width: 15 },
    { header: 'Ngưỡng cảnh báo', key: 'alert', width: 20 },
    { header: 'Ghi chú', key: 'note', width: 30 },
  ];

  sheet.addRow({
    code: 'VPP001',
    name: 'Bút bi Thiên Long',
    unit: 'Hộp',
    quantity: 50,
    alert: 10,
    note: 'Bút bi xanh',
  });
  
  sheet.addRow({
    code: 'VPP002',
    name: 'Giấy A4 Double A',
    unit: 'Ram',
    quantity: 100,
    alert: 20,
    note: 'Dùng cho máy in',
  });

  // Make header bold
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { horizontal: 'center' };

  const outPath = path.join(__dirname, 'frontend', 'public', 'van_phong_pham_mau.xlsx');
  await workbook.xlsx.writeFile(outPath);
  console.log('Created van_phong_pham_mau.xlsx');
}

generate();
