import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, BorderStyle, AlignmentType } from 'docx';

const prisma = new PrismaClient();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../uploads/weekly_reports');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export const createReport = async (req: Request, res: Response): Promise<any> => {
  try {
    const reporterId = (req as any).user?.id;
    if (!reporterId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { recipientId, results: resultsRaw, plans: plansRaw } = req.body;
    const files = (req as any).files as Express.Multer.File[] || [];

    if (!recipientId) {
      return res.status(400).json({ message: 'Vui lòng chọn người nhận báo cáo' });
    }

    let results: any[] = [];
    let plans: any[] = [];

    try {
      results = typeof resultsRaw === 'string' ? JSON.parse(resultsRaw) : (resultsRaw || []);
      plans = typeof plansRaw === 'string' ? JSON.parse(plansRaw) : (plansRaw || []);
    } catch (e) {
      return res.status(400).json({ message: 'Dữ liệu kết quả hoặc kế hoạch không hợp lệ' });
    }

    // Process results and associate uploaded files
    const resultCreates = results.map((r: any) => {
      let fileUrl = null;
      let fileName = null;
      let fileData = null;

      if (r.fileIndex !== undefined && r.fileIndex !== null && files[r.fileIndex]) {
        const f = files[r.fileIndex];
        const uniqueName = `${Date.now()}_${r.fileIndex}_${f.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
        const filePath = path.join(uploadDir, uniqueName);
        
        fs.writeFileSync(filePath, f.buffer);
        fileUrl = `/uploads/weekly_reports/${uniqueName}`;
        fileName = f.originalname;
        
        // Backup base64 in DB if <= 10MB
        if (f.size <= 10 * 1024 * 1024) {
          fileData = f.buffer.toString('base64');
        }
      }

      return {
        projectId: r.projectId ? Number(r.projectId) : null,
        description: r.description || '',
        fileUrl,
        fileName,
        fileData
      };
    });

    const planCreates = plans.map((p: any) => ({
      projectId: p.projectId ? Number(p.projectId) : null,
      customTitle: p.customTitle || (p.projectId ? null : 'Khác'),
      description: p.description || ''
    }));

    const report = await prisma.weeklyReport.create({
      data: {
        reporterId: Number(reporterId),
        recipientId: Number(recipientId),
        results: {
          create: resultCreates
        },
        plans: {
          create: planCreates
        }
      },
      include: {
        reporter: true,
        recipient: true,
        results: { include: { project: true } },
        plans: { include: { project: true } }
      }
    });

    // Create notification for recipient
    try {
      await prisma.notification.create({
        data: {
          userId: Number(recipientId),
          title: 'Báo cáo tuần mới',
          message: `${report.reporter.name || 'Một cán bộ'} vừa gửi báo cáo tuần cho bạn.`,
          type: 'WEEKLY_REPORT',
          link: '/weekly-reports?tab=manage'
        }
      });
    } catch (notifErr) {
      console.error('Failed to send weekly report notification:', notifErr);
    }

    return res.status(201).json(report);
  } catch (error: any) {
    console.error('Error creating weekly report:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi tạo báo cáo tuần', error: error.message });
  }
};

export const getReports = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    const role = (req as any).user?.role;
    const { tab } = req.query; // 'sent' | 'received' | 'all'

    let where: any = {};
    if (tab === 'sent') {
      where = { reporterId: Number(userId) };
    } else if (tab === 'received') {
      where = { recipientId: Number(userId) };
    } else if (role !== 'SuperAdmin' && role !== 'ADMIN') {
      where = {
        OR: [
          { reporterId: Number(userId) },
          { recipientId: Number(userId) }
        ]
      };
    }

    const reports = await prisma.weeklyReport.findMany({
      where,
      include: {
        reporter: {
          select: { id: true, name: true, email: true, department: true, avatar: true }
        },
        recipient: {
          select: { id: true, name: true, email: true, department: true, avatar: true }
        },
        results: {
          include: {
            project: { select: { id: true, name: true, code: true, topicCode: true } }
          }
        },
        plans: {
          include: {
            project: { select: { id: true, name: true, code: true, topicCode: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(reports);
  } catch (error: any) {
    console.error('Error fetching weekly reports:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách báo cáo tuần', error: error.message });
  }
};

export const deleteReport = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.id;
    const role = (req as any).user?.role;
    const { id } = req.params;

    const report = await prisma.weeklyReport.findUnique({
      where: { id: Number(id) }
    });

    if (!report) {
      return res.status(404).json({ message: 'Không tìm thấy báo cáo' });
    }

    if (report.reporterId !== Number(userId) && report.recipientId !== Number(userId) && role !== 'SuperAdmin' && role !== 'ADMIN') {
      return res.status(403).json({ message: 'Bạn không có quyền xóa báo cáo này' });
    }

    await prisma.weeklyReport.delete({
      where: { id: Number(id) }
    });

    return res.json({ message: 'Xóa báo cáo thành công' });
  } catch (error: any) {
    console.error('Error deleting weekly report:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi xóa báo cáo', error: error.message });
  }
};

export const downloadResultFile = async (req: Request, res: Response): Promise<any> => {
  try {
    const { resultId } = req.params;
    const result = await prisma.weeklyReportResult.findUnique({
      where: { id: Number(resultId) }
    });

    if (!result || (!result.fileUrl && !result.fileData)) {
      return res.status(404).json({ message: 'Không tìm thấy file kết quả' });
    }

    if (result.fileUrl) {
      const diskPath = path.join(__dirname, '../../', result.fileUrl);
      if (fs.existsSync(diskPath)) {
        const asciiName = (result.fileName || 'result_file').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9._-]/g, '_');
        return res.download(diskPath, asciiName);
      }
    }

    if (result.fileData) {
      const buffer = Buffer.from(result.fileData, 'base64');
      const asciiName = (result.fileName || 'result_file').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9._-]/g, '_');
      const encodedName = encodeURIComponent(result.fileName || 'result_file');
      res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
      res.setHeader('Content-Type', 'application/octet-stream');
      return res.send(buffer);
    }

    return res.status(404).json({ message: 'File không tồn tại trên máy chủ' });
  } catch (error: any) {
    console.error('Error downloading result file:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi tải file', error: error.message });
  }
};

export const downloadReportDocx = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const report = await prisma.weeklyReport.findUnique({
      where: { id: Number(id) },
      include: {
        reporter: true,
        recipient: true,
        results: { include: { project: true } },
        plans: { include: { project: true } }
      }
    });

    if (!report) {
      return res.status(404).json({ message: 'Không tìm thấy báo cáo' });
    }

    const reportDate = new Date(report.createdAt).toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const borders = {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 }
    };

    // Table 1: Results
    const resultHeaderRow = new TableRow({
      children: [
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'STT', bold: true })], alignment: AlignmentType.CENTER })],
          borders
        }),
        new TableCell({
          width: { size: 35, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'Đề tài / Công việc', bold: true })] })],
          borders
        }),
        new TableCell({
          width: { size: 35, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'Mô tả kết quả thực hiện', bold: true })] })],
          borders
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'File đính kèm', bold: true })], alignment: AlignmentType.CENTER })],
          borders
        })
      ]
    });

    const resultDataRows = report.results.length === 0 ? [
      new TableRow({
        children: [
          new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: '-', alignment: AlignmentType.CENTER })], borders }),
          new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: 'Chưa có kết quả' })], borders }),
          new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: '-' })], borders }),
          new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: '-', alignment: AlignmentType.CENTER })], borders })
        ]
      })
    ] : report.results.map((r, idx) => {
      const projName = r.project ? `${r.project.topicCode ? '[' + r.project.topicCode + '] ' : ''}${r.project.name}` : 'Công việc chung / Khác';
      return new TableRow({
        children: [
          new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: `${idx + 1}`, alignment: AlignmentType.CENTER })], borders }),
          new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: projName })], borders }),
          new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: r.description || '' })], borders }),
          new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: r.fileName || 'Không có file', italics: !r.fileName })], alignment: AlignmentType.CENTER })], borders })
        ]
      });
    });

    // Table 2: Plans
    const planHeaderRow = new TableRow({
      children: [
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'STT', bold: true })], alignment: AlignmentType.CENTER })],
          borders
        }),
        new TableCell({
          width: { size: 45, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'Đề tài / Công việc', bold: true })] })],
          borders
        }),
        new TableCell({
          width: { size: 45, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'Kế hoạch thực hiện', bold: true })] })],
          borders
        })
      ]
    });

    const planDataRows = report.plans.length === 0 ? [
      new TableRow({
        children: [
          new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: '-', alignment: AlignmentType.CENTER })], borders }),
          new TableCell({ width: { size: 45, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: 'Chưa có kế hoạch' })], borders }),
          new TableCell({ width: { size: 45, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: '-' })], borders })
        ]
      })
    ] : report.plans.map((p, idx) => {
      const projName = p.project ? `${p.project.topicCode ? '[' + p.project.topicCode + '] ' : ''}${p.project.name}` : (p.customTitle || 'Khác');
      return new TableRow({
        children: [
          new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: `${idx + 1}`, alignment: AlignmentType.CENTER })], borders }),
          new TableCell({ width: { size: 45, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: projName })], borders }),
          new TableCell({ width: { size: 45, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: p.description || '' })], borders })
        ]
      });
    });

    const docChildren = [
      new Paragraph({
        children: [
          new TextRun({ text: 'BÁO CÁO CÔNG VIỆC TUẦN', bold: true, size: 32, color: '2B579A' })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `Người báo cáo: `, bold: true }),
          new TextRun({ text: `${report.reporter.name || ''} (${report.reporter.department || 'Cán bộ'})` })
        ],
        spacing: { after: 100 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `Người nhận báo cáo: `, bold: true }),
          new TextRun({ text: `${report.recipient.name || ''} (${report.recipient.department || 'Lãnh đạo'})` })
        ],
        spacing: { after: 100 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `Thời gian nộp: `, bold: true }),
          new TextRun({ text: reportDate })
        ],
        spacing: { after: 300 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'I. KẾT QUẢ THỰC HIỆN TRONG TUẦN', bold: true, size: 26, color: '1E3A8A' })
        ],
        spacing: { before: 200, after: 150 }
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [resultHeaderRow, ...resultDataRows]
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'II. KẾ HOẠCH CÔNG VIỆC TUẦN TIẾP THEO', bold: true, size: 26, color: '1E3A8A' })
        ],
        spacing: { before: 400, after: 150 }
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [planHeaderRow, ...planDataRows]
      }),
      new Paragraph({
        children: [
          new TextRun({ text: '' })
        ],
        spacing: { before: 600 }
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE, size: 0 },
          bottom: { style: BorderStyle.NONE, size: 0 },
          left: { style: BorderStyle.NONE, size: 0 },
          right: { style: BorderStyle.NONE, size: 0 },
          insideHorizontal: { style: BorderStyle.NONE, size: 0 },
          insideVertical: { style: BorderStyle.NONE, size: 0 }
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({ children: [new TextRun({ text: 'NGƯỜI NHẬN BÁO CÁO', bold: true })], alignment: AlignmentType.CENTER }),
                  new Paragraph({ children: [new TextRun({ text: '(Ký, ghi rõ họ tên)', italics: true, size: 20 })], alignment: AlignmentType.CENTER })
                ]
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({ children: [new TextRun({ text: 'NGƯỜI BÁO CÁO', bold: true })], alignment: AlignmentType.CENTER }),
                  new Paragraph({ children: [new TextRun({ text: '(Ký, ghi rõ họ tên)', italics: true, size: 20 })], alignment: AlignmentType.CENTER })
                ]
              })
            ]
          })
        ]
      })
    ];

    const doc = new Document({
      sections: [{
        properties: {},
        children: docChildren
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Disposition', `attachment; filename="Bao_cao_tuan_${report.id}_${Date.now()}.docx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    return res.send(buffer);
  } catch (error: any) {
    console.error('Error exporting weekly report docx:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi xuất báo cáo DOCX', error: error.message });
  }
};
export const downloadSynthesisDocx = async (req: Request, res: Response): Promise<any> => {
  try {
    const { startDate, endDate, projectId, userId } = req.query;

    const whereClause: any = {};
    if (userId && userId !== 'all') {
      whereClause.reporterId = Number(userId);
    }
    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(new Date(endDate as string).setHours(23, 59, 59, 999))
      };
    }

    const reports = await prisma.weeklyReport.findMany({
      where: whereClause,
      include: {
        reporter: true,
        recipient: true,
        results: { include: { project: true } },
        plans: { include: { project: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    let allResults: any[] = [];
    let allPlans: any[] = [];

    reports.forEach(report => {
      const filteredResults = (projectId && projectId !== 'all') 
        ? report.results.filter((r: any) => r.projectId === Number(projectId))
        : report.results;
      
      const filteredPlans = (projectId && projectId !== 'all')
        ? report.plans.filter((p: any) => p.projectId === Number(projectId))
        : report.plans;
      
      allResults.push(...filteredResults.map((r: any) => ({ ...r, reporter: report.reporter })));
      allPlans.push(...filteredPlans.map((p: any) => ({ ...p, reporter: report.reporter })));
    });

    const borders = {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 }
    };

    // Table 1: Results
    const resultHeaderRow = new TableRow({
      children: [
        new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'STT', bold: true })], alignment: AlignmentType.CENTER })], borders }),
        new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Người báo cáo', bold: true })], alignment: AlignmentType.CENTER })], borders }),
        new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Đề tài / Công việc', bold: true })], alignment: AlignmentType.CENTER })], borders }),
        new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Kết quả thực hiện', bold: true })], alignment: AlignmentType.CENTER })], borders }),
      ]
    });

    const resultDataRows = allResults.length === 0 ? [
      new TableRow({
        children: [
          new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: '-', alignment: AlignmentType.CENTER })], borders }),
          new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: '-' })], borders }),
          new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: 'Chưa có kết quả' })], borders }),
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: '-' })], borders }),
        ]
      })
    ] : allResults.map((r, idx) => {
      const projName = r.project ? `${r.project.topicCode ? '[' + r.project.topicCode + '] ' : ''}${r.project.name}` : 'Công việc chung / Khác';
      return new TableRow({
        children: [
          new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: `${idx + 1}`, alignment: AlignmentType.CENTER })], borders }),
          new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: r.reporter?.name || '' })], borders }),
          new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: projName })], borders }),
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: r.description || '' })], borders }),
        ]
      });
    });

    // Table 2: Plans
    const planHeaderRow = new TableRow({
      children: [
        new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'STT', bold: true })], alignment: AlignmentType.CENTER })], borders }),
        new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Người báo cáo', bold: true })], alignment: AlignmentType.CENTER })], borders }),
        new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Đề tài / Công việc', bold: true })], alignment: AlignmentType.CENTER })], borders }),
        new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Kế hoạch', bold: true })], alignment: AlignmentType.CENTER })], borders }),
      ]
    });

    const planDataRows = allPlans.length === 0 ? [
      new TableRow({
        children: [
          new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: '-', alignment: AlignmentType.CENTER })], borders }),
          new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: '-' })], borders }),
          new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: 'Chưa có kế hoạch' })], borders }),
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: '-' })], borders }),
        ]
      })
    ] : allPlans.map((p, idx) => {
      const projName = p.project ? `${p.project.topicCode ? '[' + p.project.topicCode + '] ' : ''}${p.project.name}` : (p.customTitle || 'Khác');
      return new TableRow({
        children: [
          new TableCell({ width: { size: 5, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: `${idx + 1}`, alignment: AlignmentType.CENTER })], borders }),
          new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: p.reporter?.name || '' })], borders }),
          new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: projName })], borders }),
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: p.description || '' })], borders }),
        ]
      });
    });

    const docChildren = [
      new Paragraph({
        children: [new TextRun({ text: 'TỔNG HỢP BÁO CÁO CÔNG VIỆC', bold: true, size: 32, color: '2B579A' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `Từ ngày: `, bold: true }),
          new TextRun({ text: startDate ? new Date(startDate as string).toLocaleDateString('vi-VN') : 'Tất cả' }),
          new TextRun({ text: `  -  Đến ngày: `, bold: true }),
          new TextRun({ text: endDate ? new Date(endDate as string).toLocaleDateString('vi-VN') : 'Tất cả' })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 }
      }),
      new Paragraph({
        children: [new TextRun({ text: 'I. TỔNG HỢP KẾT QUẢ THỰC HIỆN', bold: true, size: 26, color: '1E3A8A' })],
        spacing: { before: 200, after: 150 }
      }),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [resultHeaderRow, ...resultDataRows] }),
      new Paragraph({
        children: [new TextRun({ text: 'II. TỔNG HỢP KẾ HOẠCH CÔNG VIỆC', bold: true, size: 26, color: '1E3A8A' })],
        spacing: { before: 400, after: 150 }
      }),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [planHeaderRow, ...planDataRows] })
    ];

    const doc = new Document({ sections: [{ properties: {}, children: docChildren }] });
    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Disposition', `attachment; filename="Tong_hop_bao_cao_${Date.now()}.docx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    return res.send(buffer);
  } catch (error: any) {
    console.error('Error exporting synthesis docx:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi xuất báo cáo DOCX', error: error.message });
  }
};
