/**
 * JSON-LD 的共用節點。
 *
 * 案例頁、民眾書件頁與幾個 hub 在 2026-08-19 那批各自內嵌了自己的 @graph；
 * 這裡放的是後來補結構化資料的說明頁共用的部分，避免同樣的麵包屑再抄五遍。
 */
export const SITE_URL = 'https://www.ods.yao.care/';

export const ORGANIZATION = {
  '@type': 'Organization',
  name: '藥提醒科技有限公司',
  url: 'https://www.yao.care/',
};

/** trail：[名稱, 網址] 的陣列，不含首頁；首頁由本函式補在最前面。 */
export const breadcrumb = (trail) => ({
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: '首頁', item: SITE_URL },
    ...trail.map(([name, item], i) => ({
      '@type': 'ListItem',
      position: i + 2,
      name,
      item,
    })),
  ],
});

export const faqPage = (pairs) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: pairs.map(([name, text]) => ({
    '@type': 'Question',
    name,
    acceptedAnswer: { '@type': 'Answer', text },
  })),
});
