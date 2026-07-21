const ExcelJS = require('exceljs');
const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('MayMoc');

worksheet.columns = [
  { header: 'Mã tài sản', key: 'code', width: 15 },
  { header: 'Tên tài sản', key: 'name', width: 30 },
  { header: 'Phân loại', key: 'category', width: 25 },
  { header: 'Đơn vị sử dụng', key: 'department', width: 25 },
  { header: 'Đặc điểm', key: 'characteristics', width: 40 },
  { header: 'Trạng thái', key: 'status', width: 15 }
];

worksheet.addRows([
  { code: 'MM-001', name: 'Tủ sấy chân không', category: 'Thiết bị dùng chung', department: 'Phòng Sinh học', characteristics: 'Thể tích 50L, gia nhiệt đến 250 độ C', status: 'IN_USE' },
  { code: 'MM-002', name: 'Máy ly tâm lạnh', category: 'Thiết bị dùng chung', department: 'Phòng Công nghệ Dược', characteristics: 'Tốc độ 15000 vòng/phút', status: 'IN_USE' },
  { code: 'MM-003', name: 'Cân phân tích', category: 'Thiết bị chuyên dụng', department: 'Phòng Khoa học Công nghệ', characteristics: 'Độ chính xác 4 số lẻ', status: 'NOT_IN_USE' }
]);

workbook.xlsx.writeFile('frontend/public/may_moc_mau.xlsx')
  .then(() => console.log('XLSX created'))
  .catch(err => console.error(err));
