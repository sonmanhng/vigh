import { z } from "zod";
const exportSchema = z.object({
  projectCode: z.string().min(1),
  quantity: z.number().min(0.001),
  note: z.string().optional(),
  exportDate: z.string().optional(),
});
try {
  exportSchema.parse({
    projectCode: "PRJ",
    quantity: 1,
    note: "",
    exportDate: ""
  });
  console.log("Success");
} catch(e: any) {
  console.log(e.errors);
}
