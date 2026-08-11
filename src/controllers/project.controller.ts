import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, BorderStyle } from 'docx';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { z } from 'zod';
import { isTopAdmin, isManagerOrAbove } from '../middlewares/auth.middleware';

const projectSchema = z.object({
  name: z.string().min(1),
  nameEn: z.string().optional().nullable(),
  code: z.string().optional().nullable(),
  topicCode: z.string().optional().nullable(),
  projectType: z.string().optional().nullable(),
  managementUnit: z.string().optional().nullable(),
  hostOrganization: z.string().optional().nullable(),
  advisor: z.string().optional().nullable(),
  executionTime: z.string().optional().nullable(),
  budget: z.string().optional().nullable(),
  laborBudget: z.number().optional().nullable(),
  generalObjective: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(['PLANNING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD']).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  managerId: z.number().optional().nullable(),
  memberIds: z.array(z.number()).optional(),
  approverId: z.number().optional().nullable(),
});

export const createProject = async (req: Request, res: Response) => {
  try {
    const data = projectSchema.parse(req.body);
    const { managerId, memberIds, approverId, ...rest } = data;

    // Default managerId to current user if not specified
    const finalManagerId = managerId || req.user!.id;

    const project = await prisma.project.create({
      data: {
        ...rest,
        startDate: rest.startDate ? new Date(rest.startDate) : null,
        endDate: rest.endDate ? new Date(rest.endDate) : null,
        managerId: finalManagerId,
        creatorId: req.user!.id,
        approverId: approverId || null,
        approvalStatus: 'PENDING',
        members: memberIds && memberIds.length > 0 ? {
          connect: memberIds.map(id => ({ id }))
        } : undefined,
      },
      include: {
        manager: { select: { id: true, name: true, email: true, role: true, avatar: true } },
        members: { select: { id: true, name: true, email: true, role: true, avatar: true } },
        creator: { select: { id: true, name: true, email: true, role: true } },
        approver: { select: { id: true, name: true, email: true, role: true } },
      }
    });
    res.status(201).json(project);
  } catch (error: any) {
    res.status(400).json({ message: 'Error creating project', error: error.message });
  }
};

export const getProjects = async (req: Request, res: Response) => {
  try {
    const { role, id } = req.user!;
    let projects;

    if (isTopAdmin(role)) {
      projects = await prisma.project.findMany({ 
        include: { 
          manager: { select: { id: true, name: true, email: true, role: true, avatar: true, department: true } },
          members: { select: { id: true, name: true, email: true, role: true, avatar: true } },
          creator: { select: { id: true, name: true } },
          approver: { select: { id: true, name: true } },
          tasks: { select: { status: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      projects = await prisma.project.findMany({
        where: {
          OR: [
            { approvalStatus: 'APPROVED' },
            { creatorId: id },
            { approverId: id },
            { managerId: id },
            { members: { some: { id } } },
            { tasks: { some: { assigneeId: id } } }
          ]
        },
        include: { 
          manager: { select: { id: true, name: true, email: true, role: true, avatar: true, department: true } },
          members: { select: { id: true, name: true, email: true, role: true, avatar: true } },
          creator: { select: { id: true, name: true } },
          approver: { select: { id: true, name: true } },
          tasks: { select: { status: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    const projectsWithProgress = projects.map(p => {
      const totalTasks = p.tasks.length;
      const completedTasks = p.tasks.filter((t: any) => t.status === 'DONE').length;
      const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
      
      const { tasks, ...projectData } = p;
      return { ...projectData, progress };
    });

    res.json(projectsWithProgress);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching projects', error: error.message });
  }
};

export const updateProject = async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id as string);
    const data = projectSchema.parse(req.body);
    const { managerId, memberIds, ...rest } = data;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (!isTopAdmin(req.user!.role) && project.managerId !== req.user!.id) {
      return res.status(403).json({ message: 'Not authorized to edit this project' });
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...rest,
        managerId: managerId !== undefined ? managerId : undefined,
        members: memberIds !== undefined ? {
          set: memberIds.map(id => ({ id }))
        } : undefined,
        startDate: rest.startDate ? new Date(rest.startDate) : undefined,
        endDate: rest.endDate ? new Date(rest.endDate) : undefined,
      },
      include: {
        manager: { select: { id: true, name: true, email: true, role: true, avatar: true } },
        members: { select: { id: true, name: true, email: true, role: true, avatar: true } },
        researchContents: { 
          orderBy: { id: 'asc' },
          include: {
            comments: {
              include: { user: { select: { id: true, name: true, avatar: true } } },
              orderBy: { createdAt: 'asc' }
            }
          }
        },
      }
    });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ message: 'Error updating project', error: error.message });
  }
};

export const approveProject = async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id as string);
    const { action } = req.body; // 'APPROVE' or 'REJECT'
    const { id, role } = req.user!;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (!['SuperAdmin'].includes(role) && project.approverId !== id) {
      return res.status(403).json({ message: 'Not authorized to approve this project' });
    }

    if (action !== 'APPROVE' && action !== 'REJECT') {
      return res.status(400).json({ message: 'Invalid action' });
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        approvalStatus: action === 'APPROVE' ? 'APPROVED' : 'REJECTED'
      }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: 'Error approving project', error: error.message });
  }
};

export const deleteProject = async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id as string);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (!isTopAdmin(req.user!.role) && project.managerId !== req.user!.id) {
      return res.status(403).json({ message: 'Not authorized to delete this project' });
    }

    await prisma.project.delete({ where: { id: projectId } });
    res.json({ message: 'Project deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Error deleting project', error: error.message });
  }
};

export const getProjectById = async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id as string);
    const { role, id } = req.user!;

    const p = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        manager: { select: { id: true, name: true, email: true, role: true, avatar: true } },
        members: { select: { id: true, name: true, email: true, role: true, avatar: true } },
        researchContents: { 
          orderBy: { id: 'asc' },
          include: {
            comments: {
              include: { user: { select: { id: true, name: true, avatar: true } } },
              orderBy: { createdAt: 'asc' }
            }
          }
        },
        tasks: { 
          include: {
            assignee: { select: { id: true, name: true, email: true, role: true, avatar: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!p) return res.status(404).json({ message: 'Project not found' });

    // Check authorization
    if (!isTopAdmin(role) && p.managerId !== id && !p.members.some(m => m.id === id) && !p.tasks.some(t => t.assigneeId === id)) {
      return res.status(403).json({ message: 'Not authorized to view this project' });
    }

    const totalTasks = p.tasks.length;
    const completedTasks = p.tasks.filter((t: any) => t.status === 'DONE').length;
    const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    res.json({ ...p, progress });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching project details', error: error.message });
  }
};

const DOCX_FIELDS = [
  { key: 'name', label: 'Tên đề tài' },
  { key: 'nameEn', label: 'Tên tiếng Anh' },
  { key: 'topicCode', label: 'Mã đề tài' },
  { key: 'code', label: 'Mã số dự án' },
  { key: 'projectType', label: 'Loại đề tài' },
  { key: 'managementUnit', label: 'Đơn vị quản lý' },
  { key: 'hostOrganization', label: 'Tổ chức chủ trì' },
  { key: 'advisor', label: 'Cố vấn' },
  { key: 'executionTime', label: 'Thời gian thực hiện' },
  { key: 'budget', label: 'Kinh phí' },
  { key: 'generalObjective', label: 'Mục tiêu chung' },
  { key: 'description', label: 'Mô tả chi tiết / Tổng quan' }
];

export const exportProjectDocx = async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id as string);
    const { role, id } = req.user!;
    
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { 
        manager: true,
        researchContents: {
          orderBy: { id: 'asc' },
          include: {
            comments: {
              include: { user: { select: { id: true, name: true, avatar: true } } },
              orderBy: { createdAt: 'asc' }
            }
          }
        }
      }
    });

    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Authorization check
    if (!isTopAdmin(role) && project.managerId !== id) {
      // Members might be allowed to export, let's allow anyone who can see it
      const isMember = await prisma.project.findFirst({
        where: {
          id: projectId,
          OR: [
            { members: { some: { id } } },
            { tasks: { some: { assigneeId: id } } }
          ]
        }
      });
      if (!isMember) {
        return res.status(403).json({ message: 'Not authorized to export this project' });
      }
    }

    const tableRows = DOCX_FIELDS.map(field => {
      return new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: field.label, bold: true })] })],
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
            }
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: (project as any)[field.key] || '' })],
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
            }
          })
        ]
      });
    });

    const docChildren: any[] = [
      new Paragraph({
        children: [
          new TextRun({ text: `THÔNG TIN ĐỀ TÀI: ${(project.name || '').toUpperCase()}`, bold: true, size: 32 })
        ],
        alignment: 'center',
        spacing: { after: 300 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'I. THÔNG TIN CHUNG', bold: true, size: 26 })
        ],
        spacing: { before: 200, after: 200 }
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Vui lòng chỉnh sửa nội dung ở cột thứ 2 bên dưới. Không thay đổi tên các trường ở cột thứ 1.', italics: true })
        ],
        spacing: { after: 200 }
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'II. MỤC TIÊU & NỘI DUNG NGHIÊN CỨU', bold: true, size: 26 })
        ],
        spacing: { before: 400, after: 200 }
      })
    ];

    const createActivityTable = (actList: { activity?: string; result?: string }[]) => {
      const borders = {
        top: { style: BorderStyle.SINGLE, size: 1 },
        bottom: { style: BorderStyle.SINGLE, size: 1 },
        left: { style: BorderStyle.SINGLE, size: 1 },
        right: { style: BorderStyle.SINGLE, size: 1 }
      };

      const headerRow = new TableRow({
        children: [
          new TableCell({
            width: { size: 10, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: 'STT', bold: true })], alignment: 'center' })],
            borders
          }),
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: 'Hoạt động thực hiện', bold: true })] })],
            borders
          }),
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: 'Kết quả / Đầu ra', bold: true })] })],
            borders
          })
        ]
      });

      const dataRows = actList.length === 0 ? [
        new TableRow({
          children: [
            new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: '-', alignment: 'center' })], borders }),
            new TableCell({ width: { size: 45, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Chưa có hoạt động nào', italics: true })] })], borders }),
            new TableCell({ width: { size: 45, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: '-' })], borders })
          ]
        })
      ] : actList.map((act, idx) => new TableRow({
        children: [
          new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: `${idx + 1}`, alignment: 'center' })], borders }),
          new TableCell({ width: { size: 45, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: act.activity || '' })], borders }),
          new TableCell({ width: { size: 45, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: act.result || '' })], borders })
        ]
      }));

      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [headerRow, ...dataRows]
      });
    };

    const researchList = (project as any).researchContents || [];
    if (researchList.length === 0) {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'HƯỚNG DẪN & MẪU TẠO NỘI DUNG NGHIÊN CỨU:', bold: true, size: 24, color: '2B579A' })
          ],
          spacing: { before: 100, after: 150 }
        }),
        new Paragraph({
          children: [
            new TextRun({ 
              text: 'Đề tài hiện chưa có nội dung nghiên cứu nào. Để nhập liệu nhanh từ file Word lên Website, vui lòng viết đè lên mẫu dưới đây (hoặc copy thêm ND3, ND4...) theo đúng định dạng:', 
              italics: true 
            })
          ],
          spacing: { after: 250 }
        }),
        // Mẫu ND1
        new Paragraph({
          children: [
            new TextRun({ text: 'ND1: Nghiên cứu tổng quan và khảo sát thực tế (Đang thực hiện)', bold: true, size: 22 })
          ],
          spacing: { before: 200, after: 100 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Mô tả: Thu thập, phân tích tài liệu trong và ngoài nước; đánh giá hiện trạng tại cơ sở.', italics: true })
          ],
          spacing: { after: 150 }
        }),
        createActivityTable([
          { activity: 'Thu thập và tổng hợp tài liệu chuyên ngành', result: 'Báo cáo tổng quan tài liệu nghiên cứu' },
          { activity: 'Khảo sát và phỏng vấn chuyên gia tại thực địa', result: 'Số liệu khảo sát và biên bản làm việc' }
        ]),
        // Mẫu ND2
        new Paragraph({
          children: [
            new TextRun({ text: 'ND2: Xây dựng quy trình và thực nghiệm mô hình (Kế hoạch)', bold: true, size: 22 })
          ],
          spacing: { before: 300, after: 100 }
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Mô tả: Thiết kế mô hình, tiến hành thực nghiệm và đánh giá các thông số đầu ra.', italics: true })
          ],
          spacing: { after: 150 }
        }),
        createActivityTable([
          { activity: 'Thiết kế mô hình và xây dựng quy trình thí nghiệm', result: 'Bản vẽ thiết kế và thuyết minh quy trình' },
          { activity: 'Triển khai thực nghiệm và đánh giá kết quả', result: 'Báo cáo tổng kết thực nghiệm và sản phẩm mẫu' }
        ]),
        new Paragraph({
          children: [
            new TextRun({ text: '--- Hết phần hướng dẫn ---', italics: true, color: '888888' })
          ],
          alignment: 'center',
          spacing: { before: 300, after: 200 }
        })
      );
    } else {
      researchList.forEach((rc: any) => {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${rc.code || ''}: ${rc.title || ''} (${rc.status || 'Đang thực hiện'})`, bold: true, size: 22 })
            ],
            spacing: { before: 250, after: 100 }
          })
        );
        if (rc.description) {
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: `Mô tả: ${rc.description}`, italics: true })
              ],
              spacing: { after: 150 }
            })
          );
        }
        let actList: any[] = [];
        try {
          if (rc.activities) {
            actList = typeof rc.activities === 'string' ? JSON.parse(rc.activities) : rc.activities;
          }
        } catch (e) {}
        if (!Array.isArray(actList)) actList = [];

        docChildren.push(createActivityTable(actList));
      });
    }

    const doc = new Document({
      sections: [{
        properties: {},
        children: docChildren
      }]
    });

    const buffer = await Packer.toBuffer(doc);
    
    res.setHeader('Content-Disposition', `attachment; filename=DeTai_${projectId}_${Date.now()}.docx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ message: 'Error exporting docx', error: error.message });
  }
};

export const importProjectDocx = async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id as string);
    const { role, id } = req.user!;
    const file = (req as any).file;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    // Ensure only TopAdmin or Manager can update
    if (!isTopAdmin(role) && project.managerId !== id) {
      return res.status(403).json({ message: 'Not authorized to update this project' });
    }

    // Đọc docx bằng mammoth -> chuyển thành html
    const result = await mammoth.convertToHtml({ buffer: file.buffer });
    const html = result.value;

    // Phân tích HTML bằng cheerio để lấy data trong bảng
    const $ = cheerio.load(html);
    const updates: any = {};

    $('table tr').each((i: number, el: any) => {
      const tdList = $(el).find('td');
      if (tdList.length >= 2) {
        const fieldName = $(tdList[0]).text().trim();
        const fieldValue = $(tdList[1]).text().trim();
        
        let fieldDef = DOCX_FIELDS.find(f => f.label.toLowerCase() === fieldName.toLowerCase());
        if (!fieldDef && fieldName.toLowerCase() === 'mã số') {
          fieldDef = { key: 'code', label: 'Mã số dự án' };
        }
        if (fieldDef) {
          updates[fieldDef.key] = fieldValue;
        }
      }
    });

    // Phân tích các Mục tiêu & Nội dung nghiên cứu (Phần II)
    const parsedRCs: any[] = [];
    let currentRC: any = null;

    $('p, h1, h2, h3, h4, table').each((_: number, el: any) => {
      const tag = el.tagName.toLowerCase();
      if (tag === 'table') {
        if (currentRC) {
          const trs = $(el).find('tr');
          trs.each((rowIdx: number, trEl: any) => {
            if (rowIdx === 0) return; // Bỏ qua dòng tiêu đề
            const tds = $(trEl).find('td');
            if (tds.length >= 3) {
              const act = $(tds[1]).text().trim();
              const res = $(tds[2]).text().trim();
              if (act && act !== '-' && act.toLowerCase() !== 'chưa có hoạt động nào') {
                currentRC.activities.push({ activity: act, result: res });
              }
            } else if (tds.length === 2) {
              const act = $(tds[0]).text().trim();
              const res = $(tds[1]).text().trim();
              if (act && act !== '-' && act.toLowerCase() !== 'chưa có hoạt động nào') {
                currentRC.activities.push({ activity: act, result: res });
              }
            }
          });
        }
      } else {
        const text = $(el).text().trim();
        const rcHeaderMatch = text.match(/^(ND\s*\d+|\w+[\.-]\d+):\s*(.*?)(?:\s*\((.*?)\))?$/i);
        if (rcHeaderMatch && rcHeaderMatch[1].length <= 10 && rcHeaderMatch[2].length > 0) {
          if (currentRC) parsedRCs.push(currentRC);
          currentRC = {
            code: rcHeaderMatch[1].replace(/\s+/g, '').toUpperCase(),
            title: rcHeaderMatch[2].trim(),
            status: rcHeaderMatch[3] ? rcHeaderMatch[3].trim() : 'Đang thực hiện',
            description: '',
            activities: []
          };
        } else if (currentRC && text.toLowerCase().startsWith('mô tả:')) {
          currentRC.description = text.replace(/^mô tả:\s*/i, '').trim();
        }
      }
    });
    if (currentRC) parsedRCs.push(currentRC);

    if (Object.keys(updates).length === 0 && parsedRCs.length === 0) {
      return res.status(400).json({ message: 'Không tìm thấy dữ liệu hợp lệ trong file DOCX' });
    }

    let updated = project;
    if (Object.keys(updates).length > 0) {
      updated = await prisma.project.update({
        where: { id: projectId },
        data: updates
      });
    }

    for (const rc of parsedRCs) {
      const existing = await prisma.researchContent.findFirst({
        where: {
          projectId: projectId,
          code: rc.code
        }
      });
      const activitiesJson = JSON.stringify(rc.activities);

      if (existing) {
        await prisma.researchContent.update({
          where: { id: existing.id },
          data: {
            title: rc.title,
            status: rc.status,
            description: rc.description || existing.description,
            activities: activitiesJson
          }
        });
      } else {
        await prisma.researchContent.create({
          data: {
            code: rc.code,
            title: rc.title,
            status: rc.status,
            description: rc.description,
            activities: activitiesJson,
            projectId: projectId
          }
        });
      }
    }

    res.json({ 
      message: `Cập nhật thành công thông tin chung và ${parsedRCs.length} nội dung nghiên cứu`, 
      data: updated,
      researchContentsCount: parsedRCs.length
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error importing docx', error: error.message });
  }
};
