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
//   ③ 固定欄位文別被當成三段式。目前有兩種：
//      開會通知單（政府文書格式參考規範第八點）與本票（票據法第 120 條第 1 項八款），
//      兩者都沒有主旨、沒有段落，內容全在 fields。
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

  if (draft.doc_type === "本票") {
    // 票據法第 120 條第 1 項是八款應記載事項，不是三段式。
    // 這裡只驗**絕對必要記載事項**（缺了依第 11 條第 1 項票據無效，且第 120 條沒有補充規定）；
    // 受款人、到期日、發票地、付款地都有補充規定，未載不會無效，不列為必填——
    // 強制必填等於比法律還嚴，會擋掉合法的見票即付本票。
    if (draft.subject) at("本票不該有主旨（票據法第 120 條第 1 項是固定欄位）");
    if ((draft.sections ?? []).length) at("本票不該有段落");
    for (const key of ["note_amount", "note_amount_digits", "note_issue_date"]) {
      if (!String(draft.fields?.[key] ?? "").trim()) at(`本票缺絕對必要記載事項 ${key}`);
    }
    if (!/無條件擔任支付/.test(String(draft.fields?.note_remarks ?? ""))) {
      at("本票缺「無條件擔任支付」（第 120 條第 1 項第 4 款，由應用端固定填入）");
    }
  } else if (draft.doc_type === "開會通知單") {
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
  console.error("\n重烘：cd /mnt/yao-care/ods.yao.care && ODS_DATA_DIR=<暫存> node --env-file-if-exists=.env scripts/export-demo.js --llm <輸出>");
  console.error("再把 <輸出>/scenarios、scenarios.json、knowledge.json 複製到本站 src/data/。");
  process.exit(1);
}
console.log(`案例資料守門通過：${readdirSync(DIR).filter((f) => f.endsWith(".json")).length} 則，皆為 llm 產出且檢核全過。`);
