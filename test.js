const act1 = "Thu thập bộ dữ liệu thử nghiệm PDB Refined";
const act2 = "Thu thập bộ dữ liệu huấn luyện và đánh giá PDBBind v2016";
const t_title = "ND1.1: Thu thập bộ dữ liệu thử nghiệm PDB Refined";
console.log("Old logic matches ND1.2: ", t_title.includes(act2.slice(0, 20)));
console.log("New logic matches ND1.2: ", t_title.includes(act2));
