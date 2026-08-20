/**
 * 開會通知單的固定欄位重排 —— 網頁與 Word 共用的單一真實來源。
 *
 * 政府文書格式參考規範第八點的開會通知單是固定欄位表單：開會事由、開會時間、開會地點、
 * 主持人、聯絡人及電話、出席者、列席者、副本、備註，**沒有主旨、沒有說明、沒有辦法**。
 * 欄位與順序見 src/data/gov-format.json 的 `blocks.meeting`（從官方 ODT 量出來的）。
 *
 * 應用端（ods.yao.care）自 2026-08-20 起就直接產這些固定欄位（`draft.fields`），
 * 這裡優先讀它。`cases.js` 的 `meeting` 只作為舊資料的後備——重烘前的 scenarios
 * 產的是「函」的形狀（主旨帶期望語、時間地點寫在說明分項裡），那時要靠它拆。
 *
 * 為什麼要抽出來（2026-08-20）：原本只有 scripts/lib/gov-format.mjs 做這件事，於是
 * 下載的 Word 是對的、網頁卻還顯示函的形狀，兩邊不一致。共用同一支就不會再漂移。
 */

/** 開會事由不帶期望語（那是函的東西），主旨末尾的「請查照。」等要去掉。 */
export function stripExpectation(subject = '') {
  return subject.replace(/[，,]?\s*(請|敬請|並請)[^，。,]*[。.]?\s*$/, '').replace(/[。.]\s*$/, '');
}

/** 備註＝草稿的說明／辦法分項，扣掉已升格成固定欄位的那些（否則時間地點會出現兩次）。 */
export function meetingRemarks(draft, meeting = {}) {
  const fromApp = String(draft.fields?.remarks ?? '').trim();
  if (fromApp) return [fromApp];
  const absorbed = meeting.absorbedPrefixes ?? [];
  return (draft.sections ?? [])
    .flatMap((s) => s.items)
    .filter((item) => !absorbed.some((prefix) => item.startsWith(prefix)));
}

/**
 * 把「函形狀的草稿 + cases.js 的 meeting」組成規範第八點的欄位。
 * 值為空字串代表該欄位在規範裡存在但這則範例沒有內容，頁面與 Word 都留空待填。
 */
export function meetingFields(draft, meeting = {}) {
  const remarks = meetingRemarks(draft, meeting);

  const f = draft.fields ?? {};
  const pick = (appKey, legacy) => f[appKey] || legacy || '';

  return [
    { label: '開會事由', value: pick('meeting_topic', meeting.topic ?? stripExpectation(draft.subject)) },
    { label: '開會時間', value: pick('meeting_time', meeting.time) },
    { label: '開會地點', value: pick('meeting_place', meeting.place) },
    { label: '主持人', value: pick('meeting_chair', meeting.chair) },
    { label: '聯絡人及電話', value: pick('meeting_contact', meeting.contact) },
    { label: '出席者', value: pick('attendees', meeting.attendees ?? f.receiver) },
    { label: '列席者', value: f.observers ?? '' },
    { label: '副本', value: '' },
    { label: '備註', items: remarks },
  ];
}
