// 개인정보처리방침 페이지. 법률 자문이 아니라 실무적으로 정리한 안내문이라, 운영자가 실제
// 서비스 상황(연락처, 보관 정책 등)에 맞춰 내용을 검토/수정해서 쓰는 걸 전제로 함.
const PRIVACY_EFFECTIVE_DATE = "2026-07-17";
const PRIVACY_LAST_UPDATED = "2026-07-18";
const PRIVACY_CONTACT_EMAIL = "or13n74l@gmail.com";

function renderPrivacyPage(container) {
  container.innerHTML = `
    <div class="card">
      <h2>${t("privacy.title")}</h2>
      <p class="privacy-updated">${t("privacy.updatedLine", { effectiveDate: PRIVACY_EFFECTIVE_DATE, lastUpdated: PRIVACY_LAST_UPDATED })}</p>
      <p class="privacy-lead">
        ${t("privacy.lead")}
      </p>
    </div>

    <div class="card">
      <h2>${t("privacy.section1.title")}</h2>
      <ul class="privacy-list">
        <li>${t("privacy.section1.item1")}</li>
        <li>${t("privacy.section1.item2")}</li>
      </ul>
    </div>

    <div class="card">
      <h2>${t("privacy.section2.title")}</h2>
      <ul class="privacy-list">
        <li>${t("privacy.section2.item1")}</li>
        <li>${t("privacy.section2.item2")}</li>
        <li>${t("privacy.section2.item3")}</li>
      </ul>
    </div>

    <div class="card">
      <h2>${t("privacy.section3.title")}</h2>
      <p>
        ${t("privacy.section3.body")}
      </p>
      <p class="privacy-note">
        ${t("privacy.section3.note")}
      </p>
    </div>

    <div class="card">
      <h2>${t("privacy.section4.title")}</h2>
      <p>
        ${t("privacy.section4.body")}
      </p>
    </div>

    <div class="card">
      <h2>${t("privacy.section5.title")}</h2>
      <p>
        ${t("privacy.section5.body")}
      </p>
    </div>

    <div class="card">
      <h2>${t("privacy.section6.title")}</h2>
      <p>
        ${t("privacy.section6.body")}
      </p>
    </div>

    <div class="card">
      <h2>${t("privacy.section7.title")}</h2>
      <p>
        ${t("privacy.section7.body")}
      </p>
    </div>

    <div class="card">
      <h2>${t("privacy.section8.title")}</h2>
      <p>
        ${t("privacy.section8.body")}
      </p>
    </div>

    <div class="card">
      <h2>${t("privacy.section9.title")}</h2>
      <p>${t("privacy.section9.body")}</p>
      <p class="privacy-contact">${PRIVACY_CONTACT_EMAIL}</p>
    </div>
  `;
}
