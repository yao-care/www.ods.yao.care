// 民眾文件示範資料：維持與應用端 citizen／notice 文件族群相同的段落契約。
// 內容都是虛構案例，供訪客先試做流程，不代表法律意見或真實個案。

const CITIZEN_CHECKS = [
  ['subject_present', '主旨必填', 'critical'],
  ['subject_single_paragraph', '主旨不分項', 'critical'],
  ['subject_length', '主旨長度', 'warn'],
  ['subject_period', '主旨句末標點', 'warn'],
  ['doc_type_valid', '文別合法', 'critical'],
  ['section_titles_valid', '段名合法', 'critical'],
  ['section_not_empty', '段落不得為空', 'critical'],
  ['required_request_section', '請求事項必填', 'critical'],
  ['section_item_period', '分項句末標點', 'warn'],
  ['section_item_count', '分項數量', 'warn'],
  ['section_item_length', '分項長度', 'warn'],
  ['no_mask_token', '無殘留代稱', 'critical'],
  ['no_placeholder', '無未填佔位符', 'critical'],
  ['no_raw_id_number', '無身分證字號', 'critical'],
  ['no_raw_mobile', '無行動電話號碼', 'warn'],
  ['no_simplified', '無簡體字', 'critical'],
  ['fullwidth_punctuation', '全形標點', 'warn'],
  ['no_colloquial', '無明顯口語詞', 'warn'],
  ['no_extra_blank', '無多餘空白', 'warn'],
  ['sender_required', '發文人必填', 'critical'],
  ['receiver_required', '收文者必填', 'critical'],
].map(([id, title, severity]) => ({ id, title, severity, ok: true, detail: null }));

const NOTICE_CHECKS = [
  ...CITIZEN_CHECKS,
  { id: 'sender_address_required', title: '寄件人地址必填', severity: 'critical', ok: true, detail: null },
  { id: 'receiver_address_required', title: '收件人地址必填', severity: 'critical', ok: true, detail: null },
  { id: 'notice_deadline_required', title: '履行期限必填', severity: 'critical', ok: true, detail: null },
];

const scenario = (key, title, source) => ({ key, title, source });

export const CITIZEN_EXAMPLES = [
  {
    slug: 'petition-noise',
    family: 'citizen',
    category: '民眾對機關',
    seoTitle: '陳情書範例｜反映夜間噪音',
    lead: '用一份陳情書把噪音發生時段、影響與希望機關查處的事項寫清楚。',
    watchOut: ['先寫可確認的事實與影響，不先替機關認定違法', '請求事項要寫成希望機關採取的具體處理', '附件可放錄音、照片或過往反映紀錄'],
    scenario: scenario(
      'petition-noise',
      '反映和平路附近工廠夜間噪音',
      '本人林美玲居住於安和市和平路一段，附近工廠自民國115年6月起多次於夜間產生機械聲響，已影響休息，請求查明噪音來源及處理方式。',
    ),
    draft: {
      doc_type: '陳情書',
      document_family: 'citizen',
      subject: '陳情和平路附近工廠夜間噪音影響居住安寧，敬請查處。',
      fields: {
        sender: '林美玲',
        receiver: '安和市政府環境保護局',
        attachments: ['夜間錄音紀錄一份。'],
      },
      sections: [
        {
          title: '事實與理由',
          items: [
            '本人居住於安和市和平路一段，附近工廠自民國115年6月起多次於夜間產生機械聲響，影響居住安寧。',
            '噪音主要發生於晚間十時至翌日凌晨，已持續數週，並曾向工廠反映但未獲改善。',
          ],
        },
        {
          title: '請求事項',
          items: ['請派員查明噪音來源及是否符合管制標準，並告知本人辦理情形。'],
        },
        { title: '附件', items: ['夜間錄音紀錄一份。'] },
      ],
    },
    checks: CITIZEN_CHECKS,
  },
  {
    slug: 'subsidy-application',
    family: 'citizen',
    category: '民眾對機關',
    seoTitle: '申請書範例｜申請租金補助',
    lead: '把申請資格、生活狀況與希望機關受理的事項整理成申請書。',
    watchOut: ['申請原因與資格事實分開寫', '請求事項要明確寫出希望受理與審查', '證明文件放在附件，不要只在正文提到'],
    scenario: scenario(
      'subsidy-application',
      '申請租金補助',
      '本人林美玲目前租住安和市和平路一段，符合租金補助申請資格，檢附租賃契約及收入證明，請受理申請。',
    ),
    draft: {
      doc_type: '申請書',
      document_family: 'citizen',
      subject: '申請租金補助，敬請核准。',
      fields: {
        sender: '林美玲',
        receiver: '安和市政府住宅發展處',
        attachments: ['租賃契約影本一份。', '收入證明一份。'],
      },
      sections: [
        { title: '事實與理由', items: ['本人目前租住安和市和平路一段，家庭收入及居住狀況符合租金補助申請條件。'] },
        { title: '請求事項', items: ['請受理本申請，並依相關規定審查後告知處理結果。'] },
        { title: '附件', items: ['租賃契約影本一份。', '收入證明一份。'] },
      ],
    },
    checks: CITIZEN_CHECKS,
  },
  {
    slug: 'appeal-benefit',
    family: 'citizen',
    category: '民眾對機關',
    seoTitle: '申訴書範例｜對補助審查結果提出申訴',
    lead: '對原處理結果有不同意見時，先交代原結果，再說明希望重新查明的理由。',
    watchOut: ['寫清楚不服的原處理結果與日期', '理由要對應事實與可提出的資料', '請求事項不是單純表達不滿，而是請機關重新查明'],
    scenario: scenario(
      'appeal-benefit',
      '對租金補助審查結果提出申訴',
      '本人林美玲於民國115年7月申請租金補助，收到不予核定通知後，發現審查所採計的收入資料與本人實際情形不符，提出申訴請求重新查明。',
    ),
    draft: {
      doc_type: '申訴書',
      document_family: 'citizen',
      subject: '就租金補助申請遭不予核定提出申訴，敬請查明。',
      fields: {
        sender: '林美玲',
        receiver: '安和市政府住宅發展處',
        attachments: ['不予核定通知影本一份。', '收入資料說明一份。'],
      },
      sections: [
        { title: '事實與理由', items: ['本人於民國115年7月申請租金補助，收到不予核定通知；惟通知所採計的收入資料與本人實際情形不符，相關資料如附件。'] },
        { title: '請求事項', items: ['請重新查明本案，並依相關規定作成適當處理。'] },
        { title: '附件', items: ['不予核定通知影本一份。', '收入資料說明一份。'] },
      ],
    },
    checks: CITIZEN_CHECKS,
  },
  {
    slug: 'case-explanation',
    family: 'citizen',
    category: '民眾對機關',
    seoTitle: '說明書範例｜補充案件經過與資料',
    lead: '把機關尚未掌握的案件背景、時間順序與補充資料整理清楚。',
    watchOut: ['依時間順序交代經過', '說明事實與推測，不把推測寫成已確認的結果', '附件名稱要和正文提到的資料對得上'],
    scenario: scenario(
      'case-explanation',
      '補充說明道路施工期間的通行影響',
      '本人陳志宏就安和市和平路一段道路施工期間的通行影響補充說明，施工期間住戶出入口受阻，並附上現場照片。',
    ),
    draft: {
      doc_type: '說明書',
      document_family: 'citizen',
      subject: '就和平路一段道路施工期間通行影響提出說明，敬請查照。',
      fields: {
        sender: '陳志宏',
        receiver: '安和市政府工務處',
        attachments: ['施工期間現場照片三張。'],
      },
      sections: [
        { title: '事實與理由', items: ['和平路一段施工期間，住戶出入口於民國115年8月3日至8月5日多次受施工機具及材料暫置影響，通行不便。'] },
        { title: '請求事項', items: ['請將本說明納入案件審酌，並告知後續處理方式。'] },
        { title: '附件', items: ['施工期間現場照片三張。'] },
      ],
    },
    checks: CITIZEN_CHECKS,
  },
  {
    slug: 'certified-letter',
    family: 'notice',
    category: '個人／企業之間',
    seoTitle: '存證信函範例｜通知返還租賃押金',
    lead: '除了通知內容，存證信函還要填好雙方地址與履行／回覆期限。',
    watchOut: ['清楚區分事實、請求與期限', '寄件人及收件人地址是必要欄位', '草稿不等於已完成郵寄、送達或法律審查'],
    scenario: scenario(
      'certified-letter',
      '通知返還租賃押金',
      '租約期滿後房東尚未返還押金，承租人陳志宏整理租約、點交紀錄與返還期限，準備寄發正式通知。',
    ),
    draft: {
      doc_type: '存證信函',
      document_family: 'notice',
      subject: '就租賃契約押金返還事項，請於民國115年9月15日前履行。',
      fields: {
        sender: '陳志宏',
        sender_address: '安和市和平路一段10號',
        receiver: '林美玲',
        receiver_address: '安和市中山路二段20號',
        deadline: '民國115年9月15日',
        attachments: ['租賃契約影本一份。', '房屋點交紀錄一份。'],
      },
      sections: [
        { title: '事實與理由', items: ['雙方租賃契約已於民國115年8月31日終了，房屋亦已完成點交，惟約定押金迄今尚未返還。'] },
        { title: '請求事項', items: ['請就上述事項完成履行或以書面回覆，並保留相關處理紀錄。'] },
        { title: '履行期限', items: ['請於民國115年9月15日前完成履行或回覆。'] },
        { title: '附件', items: ['租賃契約影本一份。', '房屋點交紀錄一份。'] },
      ],
    },
    checks: NOTICE_CHECKS,
  },
];

// 存證信函是最常用的民眾文件，首頁優先呈現。
export const CITIZEN_CATEGORIES = ['個人／企業之間', '民眾對機關'];
