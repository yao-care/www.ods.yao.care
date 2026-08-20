// 案例資料守門 —— 掛進 pnpm build，與 check-design / check-content / check-zh-hant 同框架。
//
// 案例資料是 ods 應用用 `export-demo.js --llm` 烘出來的產物（見 CLAUDE.md「案例資料從哪來」）。
// 這支只驗這邊看得到的東西——本站沒有應用的 validator，驗不了檢核規則本身；
// 規則漂移由應用端的測試守（ods.yao.care 的 test/document.test.js
// 「烘好的展示成品與現行檢核規則一致」）。
//
// 這裡守的是三件在本站就會出事、而且過去真的出過事的：
//   ① 忘了加 --llm。不加拿到的是規則引擎（降級路徑）產物，等於用產品最差的路徑做廣告。
//   ② 混到未通過的檢核。展示櫃上不該掛著沒過的案例。
//   ③ 開會通知單被當成三段式。規範第八點是固定欄位表單，沒有主旨、沒有段落。
import { readFileSync, readdirSync } from "node:fs";

const DIR = "src/data/scenarios";
const problems = [];

for (const name of readdirSync(DIR).filter((f) => f.endsWith(".json"))) {
  const payload = JSON.parse(readFileSync(`${DIR}/${name}`, "utf8"));
  const draft = payload.draft ?? {};
  const checks = payload.checks ?? [];
  const at = (msg) => problems.push(`${name}：${msg}`);

  if (draft.engine !== "llm") {
    at(`engine 是「${draft.engine}」而不是 llm —— 重烘時漏了 --llm，這是規則引擎的降級產物`);
  }
  if (!checks.length) at("沒有檢核結果");
  const failed = checks.filter((c) => !c.ok);
  if (failed.length) at(`有 ${failed.length} 條檢核未通過：${failed.map((c) => c.title).join("、")}`);

  if (draft.doc_type === "開會通知單") {
    // 規範第八點：固定欄位表單，沒有主旨、沒有說明／辦法
    if (draft.subject) at("開會通知單不該有主旨（規範第八點是固定欄位表單）");
    if ((draft.sections ?? []).length) at("開會通知單不該有段落");
    for (const key of ["meeting_topic", "meeting_time", "meeting_place", "meeting_chair", "meeting_contact", "attendees"]) {
      if (!String(draft.fields?.[key] ?? "").trim()) at(`開會通知單缺固定欄位 ${key}`);
    }
  } else {
    if (!draft.subject) at("缺主旨");
  }
}

if (problems.length) {
  console.error("案例資料守門未通過：");
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error("\n重烘：cd /root/ods.yao.care && ODS_DATA_DIR=<暫存> node --env-file-if-exists=.env scripts/export-demo.js --llm <輸出>");
  console.error("再把 <輸出>/scenarios、scenarios.json、knowledge.json 複製到本站 src/data/。");
  process.exit(1);
}
console.log(`案例資料守門通過：${readdirSync(DIR).filter((f) => f.endsWith(".json")).length} 則，皆為 llm 產出且檢核全過。`);
