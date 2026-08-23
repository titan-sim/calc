// 실행: node dev/generate-pages.js (저장소 루트 어디서 실행해도 됨)
// dev/pages.config.js에 정의된 각 페이지를 dev/site-template.js의 공용 뼈대에 끼워서 실제
// 배포되는 정적 HTML 파일로 찍어냄 - 런타임 빌드가 아니라 이 스크립트를 손으로(보통 커밋 전에)
// 한 번 돌려서 결과물을 커밋하는 방식임(사이트 자체는 여전히 빌드 스텝 없는 순수 정적 파일).
const fs = require("fs");
const path = require("path");
const { renderPage } = require("./site-template.js");
const pages = require("./pages.config.js");

const rootDir = path.join(__dirname, "..");

pages.forEach((cfg) => {
  const html = renderPage(cfg);
  const outPath = path.join(rootDir, cfg.outputFile);
  fs.writeFileSync(outPath, html);
  console.log(`generated ${cfg.outputFile}`);
});
