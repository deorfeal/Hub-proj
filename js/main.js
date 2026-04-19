// Функция активации
function activateBody() {
  document.body.classList.add("body--actived");
  // Убираем обработчик, чтобы сработало только один раз
  document.removeEventListener("click", activateBody);
}

// Ставим обработчик на весь документ
document.addEventListener("click", activateBody);

//

if (document.querySelector(".bundle:not(.bundle--sphere) .bundle__inner")) {
  const BUNDLE_CONFIG = {
    itemSize: 520,       // rem
    itemSizeMobile: 360, // rem
    gap: 100,            // rem
    padding: 80,         // rem
    breakpoint: 1440,    // px — только для window.innerWidth
  };

  (function () {
    "use strict";

    const { gap, padding, breakpoint } = BUNDLE_CONFIG;

    // ─── НАЙТИ ЭЛЕМЕНТЫ ──────────────────────────────────────────────────────
    const bundleEl = document.querySelector(".bundle:not(.bundle--sphere)");
    const bundleInner = bundleEl
      ? bundleEl.querySelector(".bundle__inner")
      : null;
    if (!bundleInner)
      return console.warn("[BundleGrid] .bundle__inner не найден");

    const allItems = Array.from(
      bundleInner.querySelectorAll(":scope > .bundle__item"),
    );
    const bottomEl = bundleEl
      ? bundleEl.querySelector(":scope > .bundle__bottom")
      : null;

    if (!allItems.length)
      return console.warn("[BundleGrid] .bundle__item не найдены");

    // ─── RESPONSIVE ──────────────────────────────────────────────────────────
    const isMobile = () => window.innerWidth < breakpoint;

    function getItemSize() {
      return isMobile() ? BUNDLE_CONFIG.itemSizeMobile : BUNDLE_CONFIG.itemSize;
    }

    // ─── rem → px (для расчётов позиций и clamp) ─────────────────────────────
    function remToPx(rem) {
      return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
    }

    // ─── ВЫЧИСЛИТЬ СЕТКУ (в rem) ─────────────────────────────────────────────
    const count = allItems.length;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);

    function getTotalSizeRem() {
      const size = getItemSize();
      return {
        totalW: cols * size + (cols - 1) * gap,
        totalH: rows * size + (rows - 1) * gap,
      };
    }

    // Размеры в px нужны только для расчётов смещений (offsetX/Y, clamp, center)
    function getTotalSizePx() {
      const { totalW, totalH } = getTotalSizeRem();
      return {
        totalW: remToPx(totalW),
        totalH: remToPx(totalH),
      };
    }

    // ─── ПОДГОТОВИТЬ КОНТЕЙНЕР ───────────────────────────────────────────────
    Object.assign(bundleInner.style, {
      position: "absolute",
      top: "0",
      left: "0",
      willChange: "transform",
    });

    Object.assign(bundleEl.style, {
      position: "relative",
      overflow: "hidden",
      cursor: "grab",
    });

    function updateBundleSize() {
      if (isMobile()) {
        Object.assign(bundleEl.style, {
          width: "100vw",
          height: "100vh",
        });
      } else {
        bundleEl.style.width = "";
        bundleEl.style.height = "";
      }
    }

    // ─── РАЗЛОЖИТЬ ITEMS ─────────────────────────────────────────────────────
    function layoutItems() {
      const size = getItemSize();
      const { totalW, totalH } = getTotalSizeRem();

      bundleInner.style.width  = totalW + "rem";
      bundleInner.style.height = totalH + "rem";

      allItems.forEach((item, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        Object.assign(item.style, {
          position:   "absolute",
          left:       col * (size + gap) + "rem",
          top:        row * (size + gap) + "rem",
          width:      size + "rem",
          height:     size + "rem",
          flexShrink: "0",
        });
      });
    }

    // ─── BOTTOM БЛОК ─────────────────────────────────────────────────────────
    if (bottomEl) {
      bundleEl.appendChild(bottomEl);
      Object.assign(bottomEl.style, {
        position: "fixed",
        bottom: "0",
        left: "0",
        right: "0",
        zIndex: "100",
      });
    }

    // ─── DRAG STATE ──────────────────────────────────────────────────────────
    // offsetX/Y хранятся в px — это реальные экранные координаты мыши/тача
    let offsetX = 0;
    let offsetY = 0;

    function getViewport() {
      return { vw: bundleEl.offsetWidth, vh: bundleEl.offsetHeight };
    }

    function applyTransform(snap) {
      if (snap) {
        bundleInner.style.transition =
          "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)";
        setTimeout(() => (bundleInner.style.transition = "none"), 450);
      } else {
        bundleInner.style.transition = "none";
      }
      // transform: translate всегда в px — это пиксели экрана
      bundleInner.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    }

    function clampOffset(x, y) {
      const { vw, vh }         = getViewport();
      const { totalW, totalH } = getTotalSizePx();
      const paddingPx          = remToPx(padding);

      const cx =
        totalW <= vw
          ? (vw - totalW) / 2
          : Math.max(vw - totalW - paddingPx, Math.min(paddingPx, x));
      const cy =
        totalH <= vh
          ? (vh - totalH) / 2
          : Math.max(vh - totalH - paddingPx, Math.min(paddingPx, y));

      return { x: cx, y: cy };
    }

    function centerGrid() {
      const { vw, vh }         = getViewport();
      const { totalW, totalH } = getTotalSizePx();
      offsetX = (vw - totalW) / 2;
      offsetY = (vh - totalH) / 2;
      applyTransform(false);
    }

    // ─── DRAG ─────────────────────────────────────────────────────────────────
    let isDragging = false;
    let startX = 0, startY = 0;
    let startOffX = 0, startOffY = 0;
    let velX = 0, velY = 0;
    let lastX = 0, lastY = 0;
    let lastTime = 0;
    let rafId = null;

    function getXY(e) {
      const src = e.touches ? e.touches[0] : e;
      return { x: src.clientX, y: src.clientY };
    }

    function onStart(e) {
      if (e.target.closest("a, button, .actions__button")) return;
      const { x, y } = getXY(e);
      isDragging = true;
      startX = x; startY = y;
      startOffX = offsetX; startOffY = offsetY;
      lastX = x; lastY = y;
      lastTime = Date.now();
      velX = 0; velY = 0;
      bundleEl.style.cursor = "grabbing";
      cancelAnimationFrame(rafId);
    }

    function onMove(e) {
      if (!isDragging) return;
      const { x, y } = getXY(e);
      const now = Date.now();
      const dt  = Math.max(1, now - lastTime);

      velX = ((x - lastX) / dt) * 16;
      velY = ((y - lastY) / dt) * 16;
      lastX = x; lastY = y;
      lastTime = now;

      const rawX = startOffX + (x - startX);
      const rawY = startOffY + (y - startY);
      const { x: cx, y: cy } = clampOffset(rawX, rawY);

      offsetX = cx + (rawX - cx) * 0.18;
      offsetY = cy + (rawY - cy) * 0.18;
      applyTransform(false);
    }

    function onEnd() {
      if (!isDragging) return;
      isDragging = false;
      bundleEl.style.cursor = "grab";
      runInertia();
    }

    function runInertia() {
      const friction = 0.92;
      function step() {
        velX *= friction;
        velY *= friction;
        offsetX += velX;
        offsetY += velY;

        const { x: cx, y: cy } = clampOffset(offsetX, offsetY);
        if (offsetX !== cx) { offsetX = cx + (offsetX - cx) * 0.85; velX *= 0.6; }
        if (offsetY !== cy) { offsetY = cy + (offsetY - cy) * 0.85; velY *= 0.6; }

        applyTransform(false);

        if (Math.abs(velX) > 0.2 || Math.abs(velY) > 0.2) {
          rafId = requestAnimationFrame(step);
        } else {
          const { x: fx, y: fy } = clampOffset(offsetX, offsetY);
          if (fx !== offsetX || fy !== offsetY) {
            offsetX = fx; offsetY = fy;
            applyTransform(true);
          }
        }
      }
      rafId = requestAnimationFrame(step);
    }

    // ─── RESIZE ───────────────────────────────────────────────────────────────
    let lastBreakpoint = isMobile();

    window.addEventListener("resize", () => {
      const nowMobile = isMobile();
      if (nowMobile !== lastBreakpoint) {
        lastBreakpoint = nowMobile;
        updateBundleSize();
        layoutItems();
      }
      centerGrid();
    });

    // ─── СОБЫТИЯ ─────────────────────────────────────────────────────────────
    bundleEl.addEventListener("mousedown", onStart);
    bundleEl.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchend", onEnd);

    // ─── СТАРТ ───────────────────────────────────────────────────────────────
    updateBundleSize();
    layoutItems();
    centerGrid();
  })();
}

//

const cursor = document.querySelector(".main__cursor");

if (cursor) {
  let mouseX = 0;
  let mouseY = 0;

  let posX = 0;
  let posY = 0;

  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function animateCursor() {
    posX += (mouseX - posX) * 0.15;
    posY += (mouseY - posY) * 0.15;

    cursor.style.left = posX + "px";
    cursor.style.top = posY + "px";

    requestAnimationFrame(animateCursor);
  }

  animateCursor();
}

if (document.querySelector(".keyboard")) {
  (function () {
    const layouts = {
      ru: {
        normal: [
          ["й", "ц", "у", "к", "е", "н", "г", "ш", "щ", "з", "х", "ъ"],
          ["ф", "ы", "в", "а", "п", "р", "о", "л", "д", "ж", "э"],
          ["SHIFT", "я", "ч", "с", "м", "и", "т", "ь", "б", "ю", ".", "BACK"],
          ["123", "LANG", " ", "ENTER"],
        ],
        shift: [
          ["Й", "Ц", "У", "К", "Е", "Н", "Г", "Ш", "Щ", "З", "Х", "Ъ"],
          ["Ф", "Ы", "В", "А", "П", "Р", "О", "Л", "Д", "Ж", "Э"],
          ["SHIFT", "Я", "Ч", "С", "М", "И", "Т", "Ь", "Б", "Ю", ".", "BACK"],
          ["123", "LANG", " ", "ENTER"],
        ],
        nums: [
          ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
          ["-", "/", ":", ";", "(", ")", ",", "!", "?", "@"],
          ["ABC", ".", ",", '"', "'", "_", "&", "%", "=", "BACK"],
          ["ABC", "LANG", " ", "ENTER"],
        ],
      },
      en: {
        normal: [
          ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
          ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
          ["SHIFT", "z", "x", "c", "v", "b", "n", "m", ",", ".", "BACK"],
          ["123", "LANG", " ", "ENTER"],
        ],
        shift: [
          ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
          ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
          ["SHIFT", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "BACK"],
          ["123", "LANG", " ", "ENTER"],
        ],
        nums: [
          ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
          ["-", "/", ":", ";", "(", ")", ",", "!", "?", "@"],
          ["ABC", ".", ",", '"', "'", "_", "&", "%", "=", "BACK"],
          ["ABC", "LANG", " ", "ENTER"],
        ],
      },
      kk: {
        normal: [
          ["й", "ц", "у", "к", "е", "н", "г", "ш", "щ", "з", "х", "ъ"],
          ["ф", "ы", "в", "а", "п", "р", "о", "л", "д", "ж", "э"],
          ["SHIFT", "я", "ч", "с", "м", "и", "т", "ь", "б", "ю", "ң", "BACK"],
          ["ә", "ғ", "қ", "ү", "ұ", "і", "ө", "һ"],
          ["123", "LANG", " ", "ENTER"],
        ],
        shift: [
          ["Й", "Ц", "У", "К", "Е", "Н", "Г", "Ш", "Щ", "З", "Х", "Ъ"],
          ["Ф", "Ы", "В", "А", "П", "Р", "О", "Л", "Д", "Ж", "Э"],
          ["SHIFT", "Я", "Ч", "С", "М", "И", "Т", "Ь", "Б", "Ю", "Ң", "BACK"],
          ["Ә", "Ғ", "Қ", "Ү", "Ұ", "І", "Ө", "Һ"],
          ["123", "LANG", " ", "ENTER"],
        ],
        nums: [
          ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
          ["-", "/", ":", ";", "(", ")", ",", "!", "?", "@"],
          ["ABC", ".", ",", '"', "'", "_", "&", "%", "=", "BACK"],
          ["ABC", "LANG", " ", "ENTER"],
        ],
      },
    };

    const langOrder = ["ru", "en", "kk"];
    const langNames = { ru: "RU", en: "EN", kk: "ҚАЗ" };

    let currentLang = "ru";
    let isShift = false;
    let isNums = false;

    const popup = document.getElementById("kb-popup");
    const rowsEl = document.getElementById("kb-rows");
    const input = document.getElementById("search-input");

    function getLayout() {
      if (isNums) return layouts[currentLang].nums;
      return isShift ? layouts[currentLang].shift : layouts[currentLang].normal;
    }

    function buildKeyboard() {
      rowsEl.innerHTML = "";
      getLayout().forEach((rowKeys) => {
        const row = document.createElement("div");
        row.className = "kb-row";
        rowKeys.forEach((k) => {
          const btn = document.createElement("button");
          btn.className = "kb-key";
          btn.type = "button";
          btn.dataset.key = k;
          btn.textContent = k;

          if (k === "SHIFT") {
            btn.innerHTML = `<svg width="55" height="50" viewBox="0 0 55 50" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_5364_162005)"><path d="M13.6579 27.8621C11.2932 27.8621 9.03227 27.8621 6.77137 27.8621C4.51046 27.8621 2.26109 27.8738 0.0117188 27.8505C9.18223 18.5709 18.3412 9.31458 27.5463 0C36.6707 9.20966 45.8297 18.4776 55.0002 27.7339C54.9886 27.7689 54.9656 27.8038 54.954 27.8505C50.4322 27.8505 45.9104 27.8505 41.3309 27.8505C41.2617 28.6432 41.2963 29.3777 41.2963 30.1004C41.2848 30.8232 41.2963 31.5343 41.2963 32.2571C41.2963 32.9916 41.2963 33.7377 41.2963 34.4721C41.2963 35.1949 41.2963 35.906 41.2963 36.6288C41.2963 37.3632 41.2963 38.1093 41.2963 38.8438C41.2963 39.5782 41.2963 40.3243 41.2963 41.0588C41.2963 41.7816 41.2963 42.4927 41.2963 43.2155C41.2963 43.9499 41.2963 44.696 41.2963 45.4304C41.2963 46.1532 41.2963 46.8644 41.2963 47.5871C41.2963 48.3216 41.2963 49.056 41.2963 49.7671C40.8234 49.8837 14.5692 49.9304 13.681 49.8138C13.6694 49.5806 13.6464 49.3358 13.6464 49.091C13.6464 42.2712 13.6464 35.4514 13.6464 28.6316C13.6579 28.4101 13.6579 28.1769 13.6579 27.8621Z" fill="white"/></g><defs><clipPath id="clip0_5364_162005"><rect width="55" height="49.8837" fill="white"/></clipPath></defs></svg>`;
            btn.classList.add("special", "shift-key");
            if (isShift) btn.classList.add("active-shift");
          } else if (k === "BACK") {
            btn.innerHTML = `<svg width="55" height="38" viewBox="0 0 55 38" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_5364_161891)"><path d="M54.9824 0.000727591C42.9042 0.000727591 30.8702 0.000727591 18.8274 0.000727591C12.5457 6.16262 6.26404 12.3245 0.0176452 18.4516C0.00882259 18.5299 0 18.5385 0 18.5559C0 18.5733 0.00882259 18.582 0.00882259 18.5994C0.0264678 18.6255 0.0352903 18.6515 0.0529355 18.6689C0.0882259 18.7124 0.132339 18.7558 0.176452 18.7993C1.39397 19.9986 2.61149 21.1893 3.829 22.3886C3.86429 22.4234 3.89076 22.4495 3.92605 22.4756C3.99663 22.5277 4.06721 22.5712 4.12897 22.632C9.04315 27.4642 13.9397 32.2876 18.8186 37.0938C30.8967 37.0938 42.9131 37.0938 54.9118 37.0938C54.9471 37.0677 54.9559 37.059 54.9647 37.0416C54.9735 37.0329 54.9824 37.0155 54.9824 37.0068C54.9912 24.7613 54.9912 12.507 55 0.261456C55 0.183238 54.9912 0.11371 54.9824 0.000727591ZM33.2347 16.8525C33.3317 16.7743 33.42 16.7134 33.4905 16.6439C34.2493 15.8965 35.008 15.1491 35.7668 14.4103C36.6402 13.5499 37.5048 12.6895 38.3871 11.8378C38.837 11.4033 39.3046 10.9861 39.7369 10.5342C40.081 10.1778 40.9456 10.1778 41.3073 10.5429C41.8102 11.0469 41.8367 11.7596 41.3162 12.2724C39.3752 14.1844 37.4342 16.0964 35.4844 18.0171C35.308 18.1909 35.1404 18.3647 34.9639 18.5385C35.0521 18.6341 35.1051 18.7037 35.1668 18.7645C36.8431 20.4158 38.5106 22.0584 40.1869 23.701C40.5927 24.1008 41.0074 24.4919 41.4044 24.9003C41.8279 25.3349 41.7661 25.9954 41.4397 26.4126C41.0868 26.8645 40.4339 26.9775 39.931 26.682C39.781 26.5951 39.6487 26.4734 39.5252 26.3517C37.5489 24.4049 35.5815 22.4582 33.6052 20.5201C33.5082 20.4245 33.3935 20.3289 33.27 20.2246C33.1553 20.3289 33.0494 20.4071 32.9612 20.494C31.5319 21.9106 30.0938 23.3186 28.6646 24.7352C28.0646 25.3262 27.4647 25.9259 26.856 26.5169C26.3972 26.9514 25.7178 26.9601 25.2591 26.5516C24.8444 26.1779 24.6768 25.613 25.0561 25.022C25.1355 24.9003 25.2326 24.7873 25.3385 24.6917C26.2295 23.814 27.1295 22.9449 28.0294 22.0671C29.1234 20.9981 30.2085 19.9204 31.2937 18.8427C31.3819 18.7558 31.4613 18.6428 31.5672 18.5212C31.4349 18.3908 31.3202 18.2604 31.1967 18.1388C29.6262 16.5918 28.0558 15.0448 26.4942 13.5065C26.0707 13.0893 25.6384 12.6721 25.2149 12.2463C24.8356 11.8639 24.7474 11.3859 24.9679 10.934C25.1973 10.4733 25.559 10.2474 26.0972 10.2561C26.4942 10.2648 26.7589 10.456 27.0059 10.708C28.4264 12.1072 29.8556 13.5152 31.2761 14.9144C31.9201 15.5575 32.5642 16.2007 33.2347 16.8525Z" fill="white"/></g><defs><clipPath id="clip0_5364_161891"><rect width="55" height="37.093" fill="white" transform="matrix(1 0 0 -1 0 37.0938)"/></clipPath></defs></svg>`;
            btn.classList.add("special", "backspace-key");
          } else if (k === "ENTER") {
            // ENTER пропускаем — не рендерим кнопку
            return;
          } else if (k === "123") {
            btn.textContent = "123";
            btn.classList.add("special");
            if (isNums) btn.classList.add("active-shift");
          } else if (k === "ABC") {
            btn.textContent = "ABC";
            btn.classList.add("special");
          } else if (k === "LANG") {
            btn.innerHTML = `<svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_5364_161902)"><path d="M18.1132 33.1647C23.1092 33.1647 28.0574 33.1647 33.0294 33.1647C33.0533 33.0213 33.0772 32.8939 33.0932 32.7664C33.133 32.3282 33.1569 31.898 33.1888 31.4598C33.2366 30.8384 33.3003 30.225 33.3322 29.6036C33.4677 27.349 33.4438 25.0944 33.3959 22.8398C33.372 21.8121 33.2605 20.7764 33.1888 19.7487C33.1569 19.3264 33.125 18.9042 33.0932 18.4819C33.0772 18.3306 33.0454 18.1712 33.0215 18.0119C28.0414 18.0119 23.0933 18.0119 18.1212 18.0119C18.0893 18.3067 18.0495 18.5775 18.0336 18.8484C17.9937 19.3344 17.9619 19.8283 17.93 20.3143C17.8822 21.0791 17.8105 21.8439 17.7866 22.6087C17.7467 23.987 17.7148 25.3652 17.7148 26.7435C17.7148 27.6677 17.7945 28.5918 17.8423 29.5159C17.8662 30.0577 17.8981 30.5994 17.9379 31.1412C17.9858 31.7945 18.0495 32.4557 18.1132 33.1647Z" fill="white"/><path d="M50.0235 33.1882C51.5374 28.0894 51.5454 23.0544 50.0235 18.0114C46.151 18.0114 42.3104 18.0114 38.4141 18.0114C38.438 18.2186 38.4698 18.3938 38.4778 18.5691C38.5416 19.549 38.6133 20.521 38.6531 21.5009C38.7009 22.4808 38.7168 23.4607 38.7487 24.4406C38.7647 24.9425 38.7965 25.4445 38.7965 25.9464C38.7886 27.0219 38.7647 28.0974 38.7248 29.1649C38.6929 30.0015 38.6292 30.83 38.5655 31.6586C38.5336 32.0569 38.4778 32.4473 38.438 32.8376C38.43 32.9253 38.438 33.0209 38.438 33.1563C39.7447 33.1882 41.0196 33.1643 42.3025 33.1722C43.5853 33.1802 44.8682 33.1802 46.151 33.1882C47.4259 33.1882 48.7088 33.1882 50.0235 33.1882Z" fill="white"/><path d="M1.14882 33.1647C5.00536 33.1647 8.83798 33.1647 12.6865 33.1647C12.6865 32.8859 12.7025 32.6389 12.6865 32.392C12.6467 31.8423 12.583 31.2846 12.5511 30.7349C12.4873 29.7709 12.4236 28.8069 12.3997 27.8429C12.3758 26.8072 12.3758 25.7716 12.3917 24.7359C12.4077 23.6365 12.4236 22.537 12.4794 21.4376C12.5192 20.5692 12.6228 19.7009 12.6865 18.8325C12.7025 18.5696 12.6865 18.3067 12.6865 18.0199C8.86986 18.0199 5.02926 18.0199 1.14086 18.0199C0.487477 20.0912 0.120947 22.2184 0.0253302 24.3853C-0.102158 27.3649 0.248435 30.2887 1.14882 33.1647Z" fill="white"/><path d="M32.2234 12.586C32.056 11.8531 31.8887 11.1281 31.7214 10.4111C31.4106 9.12045 31.0122 7.8617 30.558 6.61887C30.0003 5.11315 29.3389 3.65522 28.4385 2.3168C27.9684 1.62369 27.4505 0.97041 26.7573 0.476469C26.5103 0.301199 26.2314 0.181699 25.9525 0.070164C25.5939 -0.0812052 25.2434 0.0223622 24.9167 0.173731C24.5342 0.341034 24.2234 0.603939 23.9207 0.890743C23.1159 1.66352 22.5183 2.57971 21.9924 3.55166C20.9725 5.43182 20.2554 7.43149 19.6976 9.49489C19.4426 10.427 19.2354 11.3671 19.0123 12.2992C18.9884 12.3948 18.9884 12.4984 18.9805 12.6019C19.2514 12.6657 31.4505 12.7135 32.0162 12.6577C32.072 12.6497 32.1277 12.6179 32.2234 12.586Z" fill="white"/><path d="M18.957 38.5502C18.9969 38.7494 19.0208 38.9008 19.0526 39.0521C19.5706 41.49 20.2558 43.872 21.2678 46.1585C21.7777 47.3137 22.3753 48.4211 23.1403 49.4249C23.5307 49.9348 23.961 50.3968 24.4948 50.7554C25.3315 51.313 25.8972 51.2891 26.694 50.7394C27.1004 50.4606 27.451 50.118 27.7617 49.7356C28.3593 49.0027 28.8613 48.2139 29.2996 47.3774C30.2238 45.6008 30.8932 43.7207 31.435 41.7927C31.7298 40.7411 31.9927 39.6815 32.1999 38.598C32.1521 38.5741 32.1202 38.5422 32.0804 38.5422C27.7298 38.5502 23.3793 38.5502 18.957 38.5502Z" fill="white"/><path d="M16.9966 1.48906C14.3831 2.39727 12.0644 3.6879 9.9449 5.33702C7.37122 7.34466 5.22782 9.7347 3.5625 12.5709C3.72983 12.7063 3.89716 12.6585 4.04855 12.6585C5.22782 12.6585 6.40709 12.6585 7.59433 12.6585C9.39511 12.6585 11.2039 12.6585 13.0046 12.6585C13.1481 12.6585 13.2915 12.6585 13.4747 12.6585C13.5385 12.3876 13.6022 12.1407 13.65 11.8857C14.0006 10.0852 14.4468 8.30864 14.9966 6.55594C15.3791 5.34499 15.8253 4.15794 16.3114 2.99479C16.4867 2.58051 16.6938 2.18217 16.8851 1.77586C16.9169 1.70416 16.9408 1.63246 16.9966 1.48906Z" fill="white"/><path d="M34.1758 1.56098C35.9288 5.06637 36.9327 8.7789 37.6658 12.6269C37.7773 12.6428 37.9048 12.6667 38.0323 12.6667C40.5263 12.6667 43.0203 12.6667 45.5143 12.6667C46.096 12.6667 46.6856 12.6667 47.2673 12.6667C47.3709 12.6667 47.4665 12.6508 47.6338 12.6348C46.0482 9.95002 44.0721 7.68745 41.7135 5.74355C39.0124 3.51285 35.5543 1.84779 34.1758 1.56098Z" fill="white"/><path d="M47.6336 38.5583C44.2632 38.5583 40.9803 38.5583 37.6656 38.5583C36.9485 42.3824 35.9366 46.1029 34.1836 49.6003C35.1079 49.5206 38.5262 47.7759 40.2951 46.5092C43.2672 44.3741 45.7293 41.7689 47.6336 38.5583Z" fill="white"/><path d="M3.52344 38.5657C6.73456 43.8317 11.1728 47.5283 16.9416 49.6315C16.4157 48.4445 15.8978 47.2654 15.4675 46.0465C15.0452 44.8355 14.6468 43.6166 14.344 42.3658C14.0413 41.1071 13.7544 39.8483 13.4516 38.5577C10.1768 38.5657 6.87798 38.5657 3.52344 38.5657Z" fill="white"/></g><defs><clipPath id="clip0_5364_161902"><rect width="51.1628" height="51.1628" fill="white" transform="matrix(1 0 0 -1 0 51.1628)"/></clipPath></defs></svg>`;
            btn.classList.add("special", "lang-key");
          } else if (k === " ") {
            btn.classList.add("space");
          }

          btn.addEventListener("mousedown", (e) => {
            e.preventDefault();
            handleKey(k, btn);
          });

          row.appendChild(btn);
        });
        rowsEl.appendChild(row);
      });
    }

    function handleKey(k, btn) {
      btn.classList.add("pressed");
      setTimeout(() => btn.classList.remove("pressed"), 150);

      if (k === "SHIFT") {
        isShift = !isShift;
        buildKeyboard();
        return;
      }
      if (k === "123") {
        isNums = true;
        buildKeyboard();
        return;
      }
      if (k === "ABC") {
        isNums = false;
        isShift = false;
        buildKeyboard();
        return;
      }
      if (k === "LANG") {
        currentLang =
          langOrder[(langOrder.indexOf(currentLang) + 1) % langOrder.length];
        isShift = false;
        isNums = false;
        document
          .querySelectorAll(".kb-lang-btn")
          .forEach((b) =>
            b.classList.toggle("active", b.dataset.lang === currentLang),
          );
        buildKeyboard();
        return;
      }
      if (k === "BACK") {
        const s = input.selectionStart,
          e = input.selectionEnd;
        if (s !== e) {
          input.value = input.value.slice(0, s) + input.value.slice(e);
          input.setSelectionRange(s, s);
        } else if (s > 0) {
          input.value = input.value.slice(0, s - 1) + input.value.slice(s);
          input.setSelectionRange(s - 1, s - 1);
        }
        input.dispatchEvent(new Event("input"));
        return;
      }
      if (k === "ENTER") {
        popup.classList.remove("active");
        return;
      }

      const s = input.selectionStart,
        e = input.selectionEnd;
      input.value = input.value.slice(0, s) + k + input.value.slice(e);
      input.setSelectionRange(s + k.length, s + k.length);
      input.dispatchEvent(new Event("input"));

      if (isShift && !isNums) {
        isShift = false;
        buildKeyboard();
      }
    }

    // Открыть по клику на инпут
    input.addEventListener("click", () => {
      input.removeAttribute("readonly");
      popup.classList.add("active");
    });

    // Закрыть при клике вне
    document.addEventListener("mousedown", (e) => {
      if (!popup.contains(e.target) && e.target !== input) {
        popup.classList.remove("active");
      }
    });

    // Кнопки языка
    document.querySelectorAll(".kb-lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentLang = btn.dataset.lang;
        isShift = false;
        isNums = false;
        document
          .querySelectorAll(".kb-lang-btn")
          .forEach((b) =>
            b.classList.toggle("active", b.dataset.lang === currentLang),
          );
        buildKeyboard();
      });
    });

    buildKeyboard();
  })();
}

if (document.querySelector(".filters-types")) {
  const filters = document.querySelector(".filters");
  const items = document.querySelectorAll(".filters-types__item");

  items.forEach((item) => {
    item.addEventListener("click", () => {
      items.forEach((el) => el.classList.remove("filters-types__item--active"));
      item.classList.add("filters-types__item--active");

      if (item.classList.contains("filters-types__item--list")) {
        filters.classList.remove("filters--tiles");
        filters.classList.add("filters--list");
      } else {
        filters.classList.remove("filters--list");
        filters.classList.add("filters--tiles");
      }
    });
  });
}

if (document.querySelector(".filters-form")) {
  document.querySelectorAll(".tags-list__checkbox").forEach((checkbox) => {
    // Синхронизируем начальное состояние
    if (checkbox.checked) {
      checkbox.closest(".tags-list__label").classList.add("tag--active");
    }

    checkbox.addEventListener("change", () => {
      const label = checkbox.closest(".tags-list__label");
      if (checkbox.checked) {
        label.classList.add("tag--active");
      } else {
        label.classList.remove("tag--active");
      }
    });
  });
}

if (document.querySelector(".spheres-item__show")) {
  document.querySelectorAll(".spheres-item__show").forEach((button) => {
    button.addEventListener("click", () => {
      const parent = button.closest(".spheres-item");
      parent.classList.toggle("spheres-item--shown");
    });
  });
}

let presentationSwiper = null;
let videosSwiper = null;

if (typeof Swiper !== "undefined" && document.querySelector(".companies-swiper")) {
  new Swiper(".companies-swiper", {
    slidesPerView: 1.88,
    loop: true,
    initialSlide: 1,
    centeredSlides: true,
    spaceBetween: 30,
    speed: 750,
    navigation: {
      prevEl: ".companies-swiper__arrow--left",
      nextEl: ".companies-swiper__arrow--right",
    },
    breakpoints: {
      301: {
        slidesPerView: 1.37,
        loop: true,
        initialSlide: 1,
        centeredSlides: true,
        spaceBetween: 30,
        speed: 750,
      },
      1401: {
        slidesPerView: 1.88,
        loop: true,
        initialSlide: 1,
        centeredSlides: true,
        spaceBetween: 30,
        speed: 750,
      },
    },
  });
}

if (
  typeof Swiper !== "undefined" &&
  document.querySelector(".presentation-swiper")
) {
  presentationSwiper = new Swiper(".presentation-swiper", {
    slidesPerView: 1,
    loop: true,
    initialSlide: 1,
    centeredSlides: true,
    spaceBetween: 30,
    speed: 750,
    navigation: {
      prevEl: ".presentation-swiper__arrow--left",
      nextEl: ".presentation-swiper__arrow--right",
    },
    pagination: {
      el: ".presentation-swiper__pagination",
      type: "bullets",
      clickable: true,
    },
  });
}

if (typeof Swiper !== "undefined" && document.querySelector(".videos-swiper")) {
  videosSwiper = new Swiper(".videos-swiper", {
    slidesPerView: 1,
    loop: true,
    initialSlide: 0,
    centeredSlides: true,
    spaceBetween: 30,
    speed: 750,
    effect: "fade",
    fadeEffect: {
      crossFade: true,
    },
    navigation: {
      prevEl: ".videos-controls__arrow--left",
      nextEl: ".videos-controls__arrow--right",
    },
    pagination: {
      el: ".videos-controls__pagination",
      type: "fraction",
      formatFractionCurrent: (number) => number.toString().padStart(2, "0"),
      formatFractionTotal: (number) => number.toString().padStart(2, "0"),
    },
    on: {
      slideChange: function () {
        if (window.jQuery) {
          $(".videos-item__video").each(function () {
            this.pause();
          });
        }
      },
    },
  });
}

if (window.jQuery) {
  $(function () {
    var $popup = $(".popup");
    var $popups = {
      search: $(".popup--search"),
      filters: $(".popup--filters"),
      videos: $(".popup--videos"),
      details: $(".popup--details"),
      languages: $(".popup--languages"),
      back: $(".popup--back"),
      passage: $(".popup--passage"),
    };

    function showPopup($popupToShow) {
      $popupToShow.addClass("popup--active").fadeIn(250, function () {
        $(this).animate({ opacity: 1 }, 250);
      });
      $("body").addClass("body--popup");
    }

    function hidePopup($popupToHide) {
      // Останавливаем все видео при закрытии попапа
      $(".videos-item__video").each(function () {
        this.pause();
      });

      $popupToHide.removeClass("popup--active").fadeOut(250, function () {
        $(this).animate({ opacity: 1 }, 250);
      });
      $("body").removeClass("body--popup");
    }

    $(".actions__button--search").click(function (event) {
      event.stopPropagation();
      event.preventDefault();
      showPopup($popups.search);
    });

    $(".actions__button--tags").click(function (event) {
      event.stopPropagation();
      event.preventDefault();
      showPopup($popups.filters);
    });

    $(".usernav-list__item--home").click(function (event) {
      event.stopPropagation();
      event.preventDefault();
      showPopup($popups.back);
    });

    $(".usernav-list__item--lang").click(function (event) {
      event.stopPropagation();
      event.preventDefault();
      showPopup($popups.languages);
    });

     $(".qrs-item__img").click(function (event) {
      event.stopPropagation();
      event.preventDefault();
      showPopup($popups.passage);
    });

    $(".bottom__link--details").click(function (event) {
      event.stopPropagation();
      event.preventDefault();
      showPopup($popups.details);
    });

    // Клик на айтем основного слайдера — открываем попап и переходим к нужному слайду
    $(".presentation-item").click(function (event) {
      event.stopPropagation();
      event.preventDefault();

      // Определяем реальный индекс кликнутого слайда
      var $slide = $(this).closest(".swiper-slide");
      var realIndex = $slide.data("swiper-slide-index");

      // Если data-атрибут не установлен — fallback через DOM индекс
      if (realIndex === undefined) {
        realIndex = $slide.index();
      }

      if (videosSwiper) {
        videosSwiper.slideToLoop(realIndex, 0, false);
      }

      showPopup($popups.videos);
    });

    // Клик на видео в попапе — play/pause
    $(document).on("click", ".videos-item__video", function (event) {
      event.stopPropagation();
      var video = this;

      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    });

    $(".cls").click(function (event) {
      event.stopPropagation();
      event.preventDefault();
      hidePopup($popup);
    });

    $(document).click(function (event) {
      $.each($popups, function (key, $popupToCheck) {
        if ($popupToCheck.hasClass("popup--active")) {
          var $popupInner = $popupToCheck.find(".popup__inner");
          if (
            !$popupInner.is(event.target) &&
            $popupInner.has(event.target).length === 0
          ) {
            hidePopup($popupToCheck);
          }
        }
      });
    });
  });
}

// sphere bundle scene: start

if (document.querySelector("[data-sphere-scene]")) {
  (function () {
    const THREE_LIB = window.THREE;
    const sceneRoot = document.querySelector("[data-sphere-scene]");
    const container = document.getElementById("sphere-app");
    const overlay = sceneRoot
      ? sceneRoot.querySelector(".sphere-scene__overlay")
      : null;
    const callout = document.getElementById("sphere-callout");
    const calloutEyebrow = document.getElementById("sphere-callout-eyebrow");
    const calloutTitle = document.getElementById("sphere-callout-title");
    const calloutLines = document.getElementById("sphere-callout-lines");
    const sourceBundleItems = sceneRoot
      ? Array.from(sceneRoot.querySelectorAll(":scope > .bundle__inner > .bundle__item"))
      : [];

    if (
      !THREE_LIB ||
      !sceneRoot ||
      !container ||
      !overlay ||
      !callout ||
      !calloutLines ||
      !sourceBundleItems.length
    ) {
      console.warn("[SphereBundle] Missing DOM nodes or THREE");
      return;
    }

    const scene = new THREE_LIB.Scene();

    const camera = new THREE_LIB.PerspectiveCamera(34, 1, 0.1, 2000);
    camera.position.set(0, 10, 760);

    const renderer = new THREE_LIB.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE_LIB.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const ambient = new THREE_LIB.AmbientLight(0xffffff, 1.55);
    const keyLight = new THREE_LIB.DirectionalLight(0xffffff, 1.35);
    const fillLight = new THREE_LIB.PointLight(0x6d5cff, 1.45, 1200);
    const rimLight = new THREE_LIB.PointLight(0x57ff68, 1.9, 1200);
    keyLight.position.set(2, 3, 4);
    fillLight.position.set(-260, 160, 360);
    rimLight.position.set(320, -70, 280);
    scene.add(ambient, keyLight, fillLight, rimLight);

    const world = new THREE_LIB.Group();
    const tiltGroup = new THREE_LIB.Group();
    const pitchGroup = new THREE_LIB.Group();
    const cardGroup = new THREE_LIB.Group();
    scene.add(world);
    world.add(tiltGroup);
    tiltGroup.add(pitchGroup);
    pitchGroup.add(cardGroup);

    const sphereCore = new THREE_LIB.Mesh(
      new THREE_LIB.IcosahedronGeometry(148, 4),
      new THREE_LIB.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE_LIB.DoubleSide,
        uniforms: {
          uColorA: { value: new THREE_LIB.Color(0x6d5cff) },
          uColorB: { value: new THREE_LIB.Color(0x57ff68) },
          uOpacity: { value: 0.2 },
        },
        vertexShader: `
          varying vec3 vWorldNormal;
          varying vec3 vViewDir;
          varying vec3 vWorldPosition;

          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            vViewDir = normalize(cameraPosition - worldPosition.xyz);
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          uniform float uOpacity;

          varying vec3 vWorldNormal;
          varying vec3 vViewDir;
          varying vec3 vWorldPosition;

          void main() {
            float fresnel = pow(1.0 - clamp(dot(normalize(vWorldNormal), normalize(vViewDir)), 0.0, 1.0), 2.1);
            float band = 0.5 + 0.5 * sin(vWorldPosition.y * 0.055 + vWorldPosition.x * 0.04);
            vec3 color = mix(uColorA, uColorB, band);
            float alpha = fresnel * uOpacity;

            if (alpha < 0.01) discard;

            gl_FragColor = vec4(color, alpha);
          }
        `,
      })
    );
    sphereCore.renderOrder = -20;
    sphereCore.visible = false;
    cardGroup.add(sphereCore);

    const wireSphere = new THREE_LIB.LineSegments(
      new THREE_LIB.WireframeGeometry(new THREE_LIB.IcosahedronGeometry(162, 2)),
      new THREE_LIB.LineBasicMaterial({
        color: 0x5dff78,
        transparent: true,
        opacity: 0.24,
      })
    );
    wireSphere.renderOrder = -10;
    wireSphere.visible = false;
    cardGroup.add(wireSphere);

    const sphereConfig = {
      sphereRows: 5,
      sphereCols: 8,
      sphereRadius: 188,
      pitchMin: -0.98,
      pitchMax: 0.98,
      flatPadding: 18,
      zoomStep: 0.00115,
      minZoom: 0,
      maxZoom: 1,
      orbitXMin: THREE_LIB.MathUtils.degToRad(-26),
      orbitXMax: THREE_LIB.MathUtils.degToRad(20),
    };

    const pictureCalloutMap = {
      "images/bundle-picture-1.png": {
        title: "data engineering",
        label: "технология",
      },
      "images/bundle-picture-2.png": {
        title: "компьютерное зрение",
        label: "технология",
      },
    };

    function normalizeText(value) {
      return (value || "").replace(/\s+/g, " ").trim();
    }

    function svgToDataUri(node) {
      if (!node) return "";

      const svg = node.cloneNode(true);
      if (!svg.getAttribute("xmlns")) {
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      }

      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        new XMLSerializer().serializeToString(svg)
      )}`;
    }

    function parseSourceCards(items) {
      return items.map((itemNode, index) => {
        const isClear = itemNode.classList.contains("bundle-item--clear");
        const isPicture = itemNode.classList.contains("bundle-item--picture");
        const isActions = itemNode.classList.contains("bundle-item--actions");
        const imageEl = itemNode.querySelector("img");
        const image = imageEl ? imageEl.getAttribute("src") || "" : "";
        const type = isClear
          ? "clear"
          : isPicture
            ? "picture"
            : isActions
              ? "actions"
              : "image";
        const titleNode = itemNode.querySelector(".bundle-item__title span");
        const title = normalizeText(titleNode ? titleNode.textContent : "");
        const pictureMeta = pictureCalloutMap[image] || null;
        const calloutTitle =
          type === "picture"
            ? (pictureMeta && pictureMeta.title) || "визуальный модуль"
            : type === "actions"
              ? "поиск и фильтры"
              : title;
        const calloutLabel =
          type === "picture"
            ? (pictureMeta && pictureMeta.label) || "технология"
            : type === "actions"
              ? "инструменты"
              : "направление";

        return {
          key: `bundle-card-${index}`,
          index,
          type,
          title,
          image,
          calloutTitle,
          calloutLabel,
          interactive: !isClear,
          actionIcons:
            type === "actions"
              ? {
                  filters: svgToDataUri(
                    itemNode.querySelector(".actions__button--tags svg")
                  ),
                  search: svgToDataUri(
                    itemNode.querySelector(".actions__button--search svg")
                  ),
                }
              : null,
        };
      });
    }

    const cardItems = parseSourceCards(sourceBundleItems);
    const actionsCardIndex = cardItems.findIndex((item) => item.type === "actions");

    if (actionsCardIndex !== -1) {
      const [actionsCard] = cardItems.splice(actionsCardIndex, 1);
      cardItems.splice(Math.min(17, cardItems.length), 0, actionsCard);
    }

    const stackSlots = new Set([5, 7, 16, 18, 27, 29, 36, 38]);
    const textureCache = new Map();
    const tileMeshes = [];

    const raycaster = new THREE_LIB.Raycaster();
    const pointer = new THREE_LIB.Vector2(2, 2);

    const tempBasis = new THREE_LIB.Matrix4();
    const tempWorldPosition = new THREE_LIB.Vector3();
    const tempWorldNormal = new THREE_LIB.Vector3();
    const tempToCamera = new THREE_LIB.Vector3();
    const tempProjected = new THREE_LIB.Vector3();
    const tempVectorA = new THREE_LIB.Vector3();
    const tempVectorB = new THREE_LIB.Vector3();
    const tempQuaternion = new THREE_LIB.Quaternion();
    const tempWorldQuaternion = new THREE_LIB.Quaternion();
    const tempAxis = new THREE_LIB.Vector3(0, 0, 1);

    const layoutState = {
      baseCardSize: 94,
      flatColumns: 5,
      flatCardSize: 90,
      flatGap: 12,
      flatRows: 8,
      flatWidth: 0,
      flatHeight: 0,
    };

    const viewState = {
      zoom: 0.12,
      zoomTarget: 0.12,
      flatten: 0,
    };

    const interaction = {
      hovered: null,
      selected: null,
      dragging: false,
      dragMode: "sphere",
      downX: 0,
      downY: 0,
      lastX: 0,
      lastY: 0,
      lastMoveTime: 0,
      moved: false,
      startPanX: 0,
      startPanY: 0,
    };

    const flatState = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      velocityX: 0,
      velocityY: 0,
    };

    const orbitState = {
      targetX: THREE_LIB.MathUtils.degToRad(12),
      targetY: THREE_LIB.MathUtils.degToRad(-34),
      baseTilt: THREE_LIB.MathUtils.degToRad(17),
    };

    const calloutState = {
      x: 0,
      y: 0,
      opacity: 0,
    };

    const calloutPath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    calloutPath.setAttribute("fill", "none");
    calloutPath.setAttribute("stroke", "#59ff68");
    calloutPath.setAttribute("stroke-width", "1.5");
    calloutPath.setAttribute("stroke-linecap", "round");
    calloutPath.setAttribute("stroke-linejoin", "round");
    calloutPath.setAttribute("opacity", "0");
    calloutLines.appendChild(calloutPath);

    const calloutDot = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    calloutDot.setAttribute("r", "4.5");
    calloutDot.setAttribute("fill", "#59ff68");
    calloutDot.setAttribute("opacity", "0");
    calloutLines.appendChild(calloutDot);

    function createAmbientCallout(index) {
      const element = document.createElement("div");
      const eyebrow = document.createElement("span");
      const title = document.createElement("span");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const markerFrame = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect"
      );
      const markerCore = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect"
      );

      element.className = "sphere-scene__callout sphere-scene__callout--ambient";
      eyebrow.className = "sphere-scene__callout-eyebrow";
      title.className = "sphere-scene__callout-title";
      element.style.opacity = "0";
      eyebrow.textContent = "";
      title.textContent = "";
      element.append(eyebrow, title);
      overlay.insertBefore(element, callout);

      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "#59ff68");
      path.setAttribute("stroke-width", "1.2");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("opacity", "0");
      calloutLines.appendChild(path);

      markerFrame.setAttribute("width", "14");
      markerFrame.setAttribute("height", "14");
      markerFrame.setAttribute("fill", "none");
      markerFrame.setAttribute("stroke", "#59ff68");
      markerFrame.setAttribute("stroke-width", "1.2");
      markerFrame.setAttribute("opacity", "0");
      calloutLines.appendChild(markerFrame);

      markerCore.setAttribute("width", "8");
      markerCore.setAttribute("height", "8");
      markerCore.setAttribute("fill", "#59ff68");
      markerCore.setAttribute("opacity", "0");
      calloutLines.appendChild(markerCore);

      return {
        element,
        eyebrow,
        title,
        path,
        markerFrame,
        markerCore,
        index,
        x: 0,
        y: 0,
        opacity: 0,
        linesKey: "",
      };
    }

    const ambientCallouts = Array.from({ length: 4 }, (_, index) =>
      createAmbientCallout(index)
    );
    const ambientHotspots = [
      {
        title: "компьютерное зрение",
        label: "технология",
        lines: ["компьютерное", "зрение"],
        pitch: 0.52,
        yaw: -0.78,
        side: 1,
        phase: 0.2,
      },
      {
        title: "data engineering",
        label: "технология",
        lines: ["data", "engineering"],
        pitch: -0.44,
        yaw: 0.84,
        side: -1,
        phase: 1.3,
      },
      {
        title: "разработка ПО",
        label: "направление",
        lines: ["разработка", "ПО"],
        pitch: 0.14,
        yaw: 2.18,
        side: -1,
        phase: 2.4,
      },
      {
        title: "gamedev",
        label: "направление",
        lines: ["gamedev"],
        pitch: -0.12,
        yaw: -2.04,
        side: 1,
        phase: 3.5,
      },
    ];

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function smoothstep(edge0, edge1, value) {
      const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
      return t * t * (3 - 2 * t);
    }

    function getViewportWidth() {
      return window.innerWidth || document.documentElement.clientWidth || container.clientWidth;
    }

    function getSceneScale() {
      return getViewportWidth() <= 1440 ? 0.75 : 1;
    }

    function setAmbientCalloutLines(state, lines) {
      const nextKey = lines.join("|");

      if (state.linesKey === nextKey) return;

      state.title.innerHTML = "";
      lines.forEach((line) => {
        const lineEl = document.createElement("span");
        lineEl.className = "sphere-scene__callout-line";
        lineEl.textContent = line;
        state.title.appendChild(lineEl);
      });
      state.linesKey = nextKey;
    }

    function loadImage(src) {
      return new Promise((resolve) => {
        if (!src) {
          resolve(null);
          return;
        }

        const image = new Image();
        image.decoding = "async";
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = src;
      });
    }

    async function preloadCardImages(items) {
      const uniquePaths = Array.from(
        new Set(
          items
            .flatMap((item) => [
              item.image,
              item.actionIcons ? item.actionIcons.filters : null,
              item.actionIcons ? item.actionIcons.search : null,
            ])
            .filter(Boolean)
        )
      );
      const images = await Promise.all(uniquePaths.map(loadImage));
      const imageMap = new Map();

      uniquePaths.forEach((path, index) => {
        imageMap.set(path, images[index]);
      });

      return imageMap;
    }

    function drawRoundedRect(ctx, x, y, width, height, radius) {
      const safeRadius = Math.min(radius, width * 0.5, height * 0.5);
      ctx.beginPath();
      ctx.moveTo(x + safeRadius, y);
      ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
      ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
      ctx.arcTo(x, y + height, x, y, safeRadius);
      ctx.arcTo(x, y, x + width, y, safeRadius);
      ctx.closePath();
    }

    function drawCoverImage(ctx, image, x, y, width, height) {
      if (!image) return;

      const scale = Math.max(width / image.width, height / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      const drawX = x + (width - drawWidth) * 0.5;
      const drawY = y + (height - drawHeight) * 0.5;

      ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    }

    function drawContainImage(ctx, image, x, y, width, height) {
      if (!image) return;

      const scale = Math.min(width / image.width, height / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      const drawX = x + (width - drawWidth) * 0.5;
      const drawY = y + (height - drawHeight) * 0.5;

      ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    }

    function wrapText(ctx, text, maxWidth) {
      const words = text.split(" ");
      const lines = [];
      let current = "";

      words.forEach((word) => {
        const next = current ? current + " " + word : word;
        if (ctx.measureText(next).width <= maxWidth || !current) {
          current = next;
        } else {
          lines.push(current);
          current = word;
        }
      });

      if (current) {
        lines.push(current);
      }

      return lines.slice(0, 2);
    }

    function drawDecorSquares(ctx, color, x, y, width, height, size) {
      ctx.fillStyle = color;
      ctx.fillRect(x - size * 0.5, y - size * 0.5, size, size);
      ctx.fillRect(x + width - size * 0.5, y - size * 0.5, size, size);
      ctx.fillRect(x - size * 0.5, y + height - size * 0.5, size, size);
      ctx.fillRect(
        x + width - size * 0.5,
        y + height - size * 0.5,
        size,
        size
      );
    }

    function drawFallbackActionIcon(ctx, type, x, y, size) {
      ctx.save();
      ctx.strokeStyle = "#00ff5d";
      ctx.fillStyle = "#00ff5d";
      ctx.lineWidth = 20;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (type === "filters") {
        ctx.beginPath();
        ctx.moveTo(x + size * 0.22, y + size * 0.3);
        ctx.lineTo(x + size * 0.78, y + size * 0.3);
        ctx.moveTo(x + size * 0.22, y + size * 0.5);
        ctx.lineTo(x + size * 0.78, y + size * 0.5);
        ctx.moveTo(x + size * 0.22, y + size * 0.7);
        ctx.lineTo(x + size * 0.78, y + size * 0.7);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x + size * 0.42, y + size * 0.3, size * 0.08, 0, Math.PI * 2);
        ctx.arc(x + size * 0.6, y + size * 0.5, size * 0.08, 0, Math.PI * 2);
        ctx.arc(x + size * 0.34, y + size * 0.7, size * 0.08, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(x + size * 0.46, y + size * 0.46, size * 0.22, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x + size * 0.62, y + size * 0.62);
        ctx.lineTo(x + size * 0.8, y + size * 0.8);
        ctx.stroke();
      }

      ctx.restore();
    }

    function createCardTexture(item, imageMap) {
      if (textureCache.has(item.key)) {
        return textureCache.get(item.key);
      }

      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext("2d");
      const image = imageMap.get(item.image) || null;
      ctx.clearRect(0, 0, 1024, 1024);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      if (item.type === "clear") {
        const clearGradient = ctx.createLinearGradient(0, 0, 1024, 1024);
        clearGradient.addColorStop(0, "rgba(255,255,255,0.12)");
        clearGradient.addColorStop(1, "rgba(255,255,255,0.08)");
        ctx.fillStyle = clearGradient;
        ctx.fillRect(0, 0, 1024, 1024);
      }

      if (item.type === "image") {
        ctx.fillStyle = "rgba(255,255,255,0.20)";
        ctx.fillRect(0, 0, 1024, 1024);
        drawCoverImage(ctx, image, 49, 49, 926, 926);

        const imageShade = ctx.createLinearGradient(0, 64, 0, 980);
        imageShade.addColorStop(0, "rgba(34, 24, 55, 0)");
        imageShade.addColorStop(0.62, "rgba(19, 13, 29, 0.02)");
        imageShade.addColorStop(1, "rgba(8, 8, 16, 0.26)");
        ctx.fillStyle = imageShade;
        ctx.fillRect(49, 49, 926, 926);

        const titleWidth = 760;
        const titleHeight = 112;
        const titleX = (1024 - titleWidth) * 0.5;
        const titleY = 760;
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(titleX, titleY, titleWidth, titleHeight);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        ctx.strokeRect(titleX, titleY, titleWidth, titleHeight);
        drawDecorSquares(ctx, "#ffffff", titleX, titleY, titleWidth, titleHeight, 14);

        ctx.font = '600 64px "Cascadia Code", monospace';
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const lines = wrapText(ctx, item.title, titleWidth - 120);
        const lineHeight = 54;
        const firstLineY =
          titleY + titleHeight * 0.5 - ((lines.length - 1) * lineHeight) * 0.5;

        lines.forEach((line, lineIndex) => {
          ctx.fillText(line, 512, firstLineY + lineIndex * lineHeight);
        });
      }

      if (item.type === "picture") {
        const frameSize = 744;
        const frameX = (1024 - frameSize) * 0.5;
        const frameY = (1024 - frameSize) * 0.5;
        ctx.fillStyle = "#280146";
        ctx.fillRect(frameX, frameY, frameSize, frameSize);
        drawContainImage(ctx, image, frameX + 46, frameY + 46, frameSize - 92, frameSize - 92);
        ctx.strokeStyle = "#00ff5d";
        ctx.lineWidth = 4;
        ctx.strokeRect(frameX, frameY, frameSize, frameSize);
        drawDecorSquares(ctx, "#00ff5d", frameX, frameY, frameSize, frameSize, 14);
      }

      if (item.type === "actions") {
        const filtersIcon = imageMap.get(
          item.actionIcons ? item.actionIcons.filters : null
        ) || null;
        const searchIcon = imageMap.get(
          item.actionIcons ? item.actionIcons.search : null
        ) || null;
        const buttonSize = 315;
        const gap = 70;
        const startX = (1024 - (buttonSize * 2 + gap)) * 0.5;
        const buttonY = 548;

        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(0, 0, 1024, 1024);

        [
          { x: startX, icon: filtersIcon, type: "filters" },
          { x: startX + buttonSize + gap, icon: searchIcon, type: "search" },
        ].forEach((button) => {
          ctx.strokeStyle = "#00ff5d";
          ctx.lineWidth = 4;
          ctx.strokeRect(button.x, buttonY, buttonSize, buttonSize);

          if (button.icon) {
            drawContainImage(
              ctx,
              button.icon,
              button.x + 56,
              buttonY + 56,
              buttonSize - 112,
              buttonSize - 112
            );
          } else {
            drawFallbackActionIcon(
              ctx,
              button.type,
              button.x + 48,
              buttonY + 48,
              buttonSize - 96
            );
          }
        });
      }

      const grainGradient = ctx.createLinearGradient(0, 0, 1024, 1024);
      grainGradient.addColorStop(0, "rgba(255,255,255,0.04)");
      grainGradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grainGradient;
      ctx.fillRect(0, 0, 1024, 1024);

      const texture = new THREE_LIB.CanvasTexture(canvas);
      texture.colorSpace = THREE_LIB.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      textureCache.set(item.key, texture);
      return texture;
    }

    function getSphericalNormal(pitch, yaw) {
      return new THREE_LIB.Vector3(
        Math.cos(pitch) * Math.sin(yaw),
        Math.sin(pitch),
        Math.cos(pitch) * Math.cos(yaw)
      ).normalize();
    }

    function getBasisQuaternion(normal, yaw) {
      const east = new THREE_LIB.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).normalize();
      const north = new THREE_LIB.Vector3().crossVectors(normal, east).normalize();
      tempBasis.makeBasis(east, north, normal);
      return tempQuaternion.setFromRotationMatrix(tempBasis).clone();
    }

    function updateFlatLayout() {
      const viewportWidth = getViewportWidth();

      layoutState.flatColumns = viewportWidth < 900 ? 3 : 5;
      layoutState.flatCardSize =
        viewportWidth < 900 ? 74 : viewportWidth < 1440 ? 82 : 90;
      layoutState.flatGap =
        viewportWidth < 900 ? 8 : viewportWidth < 1440 ? 10 : 12;
      layoutState.flatRows = Math.ceil(cardItems.length / layoutState.flatColumns);
      layoutState.flatWidth =
        layoutState.flatColumns * layoutState.flatCardSize +
        (layoutState.flatColumns - 1) * layoutState.flatGap;
      layoutState.flatHeight =
        layoutState.flatRows * layoutState.flatCardSize +
        (layoutState.flatRows - 1) * layoutState.flatGap;

      tileMeshes.forEach((tile, index) => {
        const col = index % layoutState.flatColumns;
        const row = Math.floor(index / layoutState.flatColumns);
        const x =
          col * (layoutState.flatCardSize + layoutState.flatGap) -
          layoutState.flatWidth * 0.5 +
          layoutState.flatCardSize * 0.5;
        const y =
          layoutState.flatHeight * 0.5 -
          row * (layoutState.flatCardSize + layoutState.flatGap) -
          layoutState.flatCardSize * 0.5;

        tile.userData.flatPosition.set(x, y, 0);
        tile.userData.flatFitScale =
          layoutState.flatCardSize / layoutState.baseCardSize;
      });
    }

    function createTiles(imageMap) {
      const planeGeometry = new THREE_LIB.PlaneGeometry(
        layoutState.baseCardSize,
        layoutState.baseCardSize
      );

      const pitchStep =
        (sphereConfig.pitchMax - sphereConfig.pitchMin) /
        (sphereConfig.sphereRows - 1);
      const yawStep = (Math.PI * 2) / sphereConfig.sphereCols;

      cardItems.forEach((item, index) => {
        const row = Math.floor(index / sphereConfig.sphereCols);
        const col = index % sphereConfig.sphereCols;
        const yawOffset = row % 2 === 0 ? 0 : yawStep * 0.5;
        const pitch = sphereConfig.pitchMin + row * pitchStep;
        const yaw = col * yawStep + yawOffset;
        const normal = getSphericalNormal(pitch, yaw);
        const sphereDistance =
          sphereConfig.sphereRadius +
          (item.type === "picture" ? 10 : 0) +
          (item.type === "clear" ? -10 : 4);
        const spherePosition = normal.clone().multiplyScalar(sphereDistance);
        const sphereQuaternion = getBasisQuaternion(normal, yaw);
        const spin = Math.sin(index * 1.37) * (item.type === "picture" ? 0.2 : 0.11);
        sphereQuaternion.multiply(
          new THREE_LIB.Quaternion().setFromAxisAngle(tempAxis, spin)
        );

        const material = new THREE_LIB.MeshBasicMaterial({
          map: createCardTexture(item, imageMap),
          transparent: true,
          opacity: 1,
          side: THREE_LIB.DoubleSide,
          depthWrite: false,
        });

        const tile = new THREE_LIB.Mesh(planeGeometry, material);
        tile.position.copy(spherePosition);
        tile.quaternion.copy(sphereQuaternion);
        tile.renderOrder = 1;

        tile.userData = {
          ...item,
          spherePosition,
          sphereQuaternion,
          flatPosition: new THREE_LIB.Vector3(),
          flatQuaternion: new THREE_LIB.Quaternion(),
          normal,
          hover: 0,
          hoverTarget: 0,
          selected: 0,
          selectedTarget: 0,
          sphereScale:
            item.type === "picture"
              ? 0.76
              : item.type === "clear"
                ? 0.78
                : 0.82,
          flatScale:
            item.type === "clear"
              ? 0.92
              : 0.97,
          flatFitScale: 1,
          floatSeed: index * 0.37,
          lastFacing: 1,
        };

        const anchor = new THREE_LIB.Object3D();
        anchor.position.set(0, 0, 8);
        tile.add(anchor);
        tile.userData.anchor = anchor;

        if (stackSlots.has(index) && item.type === "image") {
          const stack = new THREE_LIB.Mesh(
            planeGeometry,
            new THREE_LIB.MeshBasicMaterial({
              map: material.map,
              transparent: true,
              opacity: 0.28,
              side: THREE_LIB.DoubleSide,
              depthWrite: false,
            })
          );
          stack.position.set(8, -8, -12);
          stack.scale.setScalar(0.94);
          tile.add(stack);
          tile.userData.stackMesh = stack;
        }

        cardGroup.add(tile);
        tileMeshes.push(tile);
      });

      updateFlatLayout();
    }

    function getViewSizeAtDepth(depth) {
      const distance = Math.abs(camera.position.z - depth);
      const height =
        2 * Math.tan(THREE_LIB.MathUtils.degToRad(camera.fov * 0.5)) * distance;
      return {
        width: height * camera.aspect,
        height,
      };
    }

    function clampPan(rawX, rawY) {
      const viewSize = getViewSizeAtDepth(0);
      const sceneScale = getSceneScale();
      const padding = sphereConfig.flatPadding * sceneScale;
      const effectiveFlatWidth = layoutState.flatWidth * sceneScale;
      const effectiveFlatHeight = layoutState.flatHeight * sceneScale;
      const maxX = Math.max(
        0,
        (effectiveFlatWidth - viewSize.width) * 0.5 + padding
      );
      const maxY = Math.max(
        0,
        (effectiveFlatHeight - viewSize.height) * 0.5 + padding
      );

      return {
        x: clamp(rawX, -maxX, maxX),
        y: clamp(rawY, -maxY, maxY),
      };
    }

    function syncPanBounds() {
      const clamped = clampPan(flatState.targetX, flatState.targetY);
      flatState.targetX = clamped.x;
      flatState.targetY = clamped.y;
      flatState.x = clamp(flatState.x, -Math.abs(clamped.x), Math.abs(clamped.x));
      flatState.y = clamp(flatState.y, -Math.abs(clamped.y), Math.abs(clamped.y));
    }

    function setPointer(event) {
      const rect = container.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function pickTileHit() {
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(tileMeshes, false);

      for (const hit of hits) {
        const target = hit.object;
        if (
          target.userData.interactive !== false &&
          target.userData.lastFacing > (viewState.flatten > 0.55 ? -0.18 : 0.04)
        ) {
          return {
            tile: target,
            hit,
          };
        }
      }

      return null;
    }

    function triggerTileAction(hitData) {
      const tile = hitData ? hitData.tile : null;
      const hit = hitData ? hitData.hit : null;

      if (!tile || tile.userData.type !== "actions" || !hit || !hit.uv) {
        return false;
      }

      const textureX = hit.uv.x * 1024;
      const textureY = (1 - hit.uv.y) * 1024;
      const buttonY = 548;
      const buttonSize = 315;
      const gap = 70;
      const startX = (1024 - (buttonSize * 2 + gap)) * 0.5;
      const searchTrigger = sceneRoot.querySelector(
        ".sphere-scene__actions .actions__button--search"
      );
      const filtersTrigger = sceneRoot.querySelector(
        ".sphere-scene__actions .actions__button--tags"
      );

      if (
        textureY >= buttonY &&
        textureY <= buttonY + buttonSize &&
        textureX >= startX &&
        textureX <= startX + buttonSize
      ) {
        if (filtersTrigger) {
          filtersTrigger.click();
        }
        return true;
      }

      if (
        textureY >= buttonY &&
        textureY <= buttonY + buttonSize &&
        textureX >= startX + buttonSize + gap &&
        textureX <= startX + buttonSize * 2 + gap
      ) {
        if (searchTrigger) {
          searchTrigger.click();
        }
        return true;
      }

      return false;
    }

    function updateHoveredTile(nextHovered) {
      if (interaction.hovered === nextHovered) return;

      if (interaction.hovered) {
        interaction.hovered.userData.hoverTarget = 0;
      }

      interaction.hovered = nextHovered;

      if (interaction.hovered) {
        interaction.hovered.userData.hoverTarget = 1;
      }
    }

    function setSelectedTile(nextSelected) {
      if (interaction.selected === nextSelected) {
        if (interaction.selected) {
          interaction.selected.userData.selectedTarget = 0;
        }
        interaction.selected = null;
        return;
      }

      if (interaction.selected) {
        interaction.selected.userData.selectedTarget = 0;
      }

      interaction.selected = nextSelected;

      if (interaction.selected) {
        interaction.selected.userData.selectedTarget = 1;
      }
    }

    function focusFlatTile(tile) {
      if (!tile) return;
      const clamped = clampPan(
        -tile.userData.flatPosition.x,
        -tile.userData.flatPosition.y
      );
      flatState.targetX = clamped.x;
      flatState.targetY = clamped.y;
    }

    function currentDragMode() {
      return viewState.flatten > 0.58 ? "flat" : "sphere";
    }

    function onPointerDown(event) {
      interaction.dragging = true;
      interaction.dragMode = currentDragMode();
      interaction.moved = false;
      interaction.downX = event.clientX;
      interaction.downY = event.clientY;
      interaction.lastX = event.clientX;
      interaction.lastY = event.clientY;
      interaction.lastMoveTime = performance.now();
      interaction.startPanX = flatState.targetX;
      interaction.startPanY = flatState.targetY;
      flatState.velocityX = 0;
      flatState.velocityY = 0;
      container.classList.add("sphere-scene__viewport--dragging");
      setPointer(event);

      if (container.setPointerCapture) {
        container.setPointerCapture(event.pointerId);
      }
    }

    function onPointerMove(event) {
      setPointer(event);

      if (!interaction.dragging) {
        const hoveredHit = pickTileHit();
        updateHoveredTile(hoveredHit ? hoveredHit.tile : null);
        return;
      }

      const now = performance.now();
      const deltaX = event.clientX - interaction.lastX;
      const deltaY = event.clientY - interaction.lastY;

      if (
        Math.abs(event.clientX - interaction.downX) > 3 ||
        Math.abs(event.clientY - interaction.downY) > 3
      ) {
        interaction.moved = true;
      }

      if (interaction.dragMode === "flat") {
        const viewSize = getViewSizeAtDepth(0);
        const unitsPerPixelX = viewSize.width / Math.max(container.clientWidth, 1);
        const unitsPerPixelY = viewSize.height / Math.max(container.clientHeight, 1);
        const rawX =
          interaction.startPanX + (event.clientX - interaction.downX) * unitsPerPixelX;
        const rawY =
          interaction.startPanY - (event.clientY - interaction.downY) * unitsPerPixelY;
        const clamped = clampPan(rawX, rawY);
        flatState.targetX = clamped.x;
        flatState.targetY = clamped.y;

        const deltaTime = Math.max(16, now - interaction.lastMoveTime);
        flatState.velocityX = ((event.clientX - interaction.lastX) * unitsPerPixelX / deltaTime) * 16;
        flatState.velocityY = (-(event.clientY - interaction.lastY) * unitsPerPixelY / deltaTime) * 16;
      } else {
        orbitState.targetY += deltaX * 0.0049;
        orbitState.targetX = clamp(
          orbitState.targetX - deltaY * 0.0038,
          sphereConfig.orbitXMin,
          sphereConfig.orbitXMax
        );
      }

      interaction.lastX = event.clientX;
      interaction.lastY = event.clientY;
      interaction.lastMoveTime = now;
      updateHoveredTile(null);
    }

    function onPointerUp(event) {
      const clickedHit = !interaction.moved ? pickTileHit() : null;
      const clickedTile = clickedHit ? clickedHit.tile : null;
      interaction.dragging = false;
      container.classList.remove("sphere-scene__viewport--dragging");

      if (container.releasePointerCapture) {
        try {
          container.releasePointerCapture(event.pointerId);
        } catch (error) {
          // stale pointer id
        }
      }

      if (triggerTileAction(clickedHit)) {
        setSelectedTile(null);
        updateHoveredTile(null);
      } else if (clickedTile) {
        setSelectedTile(clickedTile);
        updateHoveredTile(clickedTile);
        viewState.zoomTarget = Math.max(viewState.zoomTarget, 0.82);
        focusFlatTile(clickedTile);
      } else if (!interaction.moved) {
        setSelectedTile(null);
        updateHoveredTile(null);
        viewState.zoomTarget = Math.max(0.08, viewState.zoomTarget - 0.22);
        flatState.targetX *= 0.4;
        flatState.targetY *= 0.4;
      }
    }

    function onPointerLeave() {
      if (!interaction.dragging) {
        updateHoveredTile(null);
      }
    }

    function onWheel(event) {
      event.preventDefault();
      viewState.zoomTarget = clamp(
        viewState.zoomTarget - event.deltaY * sphereConfig.zoomStep,
        sphereConfig.minZoom,
        sphereConfig.maxZoom
      );

      if (viewState.zoomTarget < 0.24) {
        setSelectedTile(null);
      }
    }

    function updateLayout() {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      calloutLines.setAttribute("viewBox", `0 0 ${width} ${height}`);
      updateFlatLayout();
      syncPanBounds();
    }

    function updateTileVisual(tile, time) {
      const data = tile.userData;
      data.hover += (data.hoverTarget - data.hover) * 0.18;
      data.selected += (data.selectedTarget - data.selected) * 0.12;

      const flatten = viewState.flatten;
      const hoverLift = data.hover * 9 + data.selected * 14;
      const floatLift =
        Math.sin(time * 0.001 + data.floatSeed) * (1 - flatten * 0.72) * 4.2;

      tempVectorA.copy(data.spherePosition).addScaledVector(
        data.normal,
        hoverLift + floatLift
      );
      tempVectorB
        .copy(data.flatPosition)
        .set(tempVectorB.x + flatState.x, tempVectorB.y + flatState.y, 0);

      tile.position.copy(tempVectorA.lerp(tempVectorB, flatten));
      tile.quaternion.copy(data.sphereQuaternion).slerp(data.flatQuaternion, flatten);

      const scale =
        THREE_LIB.MathUtils.lerp(
          data.sphereScale,
          data.flatScale * data.flatFitScale,
          flatten
        ) *
        (getViewportWidth() < 900 ? 0.82 : getViewportWidth() < 1440 ? 0.9 : 1) *
        (1 + data.hover * 0.04 + data.selected * 0.08);
      tile.scale.setScalar(scale);

      tile.updateWorldMatrix(true, false);
      tile.getWorldPosition(tempWorldPosition);
      tempWorldNormal
        .set(0, 0, 1)
        .applyQuaternion(tile.getWorldQuaternion(tempWorldQuaternion));
      tempToCamera.copy(camera.position).sub(tempWorldPosition).normalize();
      data.lastFacing = tempWorldNormal.normalize().dot(tempToCamera);

      const facingOpacity = clamp((data.lastFacing + 1) * 0.5, 0.12, 1);
      const baseOpacity =
        data.type === "clear"
          ? THREE_LIB.MathUtils.lerp(0.14, 0.28, flatten)
          : THREE_LIB.MathUtils.lerp(0.76 + facingOpacity * 0.18, 1, flatten);

      tile.material.opacity = clamp(
        baseOpacity + data.hover * 0.08 + data.selected * 0.1,
        0.06,
        1
      );

      const brightness = 1 + data.hover * 0.06 + data.selected * 0.08;
      tile.material.color.setRGB(brightness, brightness, brightness);

      if (data.stackMesh) {
        data.stackMesh.material.opacity =
          tile.material.opacity * THREE_LIB.MathUtils.lerp(0.38, 0.14, flatten);
        data.stackMesh.visible = flatten < 0.92;
      }

      tile.renderOrder = data.selected > 0.06 ? 40 : data.hover > 0.06 ? 20 : 1;
    }

    function updateCallout() {
      const target = interaction.selected;

      if (!target || !target.userData.calloutTitle) {
        calloutState.opacity += (0 - calloutState.opacity) * 0.22;
        callout.style.opacity = calloutState.opacity.toFixed(3);
        calloutPath.setAttribute("opacity", calloutState.opacity.toFixed(3));
        calloutDot.setAttribute("opacity", calloutState.opacity.toFixed(3));
        return;
      }

      target.userData.anchor.getWorldPosition(tempWorldPosition);
      tempProjected.copy(tempWorldPosition).project(camera);

      if (
        tempProjected.z < -1 ||
        tempProjected.z > 1 ||
        Math.abs(tempProjected.x) > 1.2 ||
        Math.abs(tempProjected.y) > 1.15
      ) {
        calloutState.opacity += (0 - calloutState.opacity) * 0.22;
        callout.style.opacity = calloutState.opacity.toFixed(3);
        calloutPath.setAttribute("opacity", calloutState.opacity.toFixed(3));
        calloutDot.setAttribute("opacity", calloutState.opacity.toFixed(3));
        return;
      }

      calloutEyebrow.textContent = target.userData.calloutLabel;
      calloutTitle.textContent = target.userData.calloutTitle;

      const width = container.clientWidth;
      const height = container.clientHeight;
      const anchorX = (tempProjected.x * 0.5 + 0.5) * width;
      const anchorY = (-tempProjected.y * 0.5 + 0.5) * height;
      const side = tempProjected.x >= 0 ? 1 : -1;
      const labelWidth = callout.offsetWidth || 170;
      const labelHeight = callout.offsetHeight || 64;
      const offsetX = side * (width < 900 ? 74 : 112);
      const offsetY = width < 900 ? -12 : -20;
      let targetX = anchorX + offsetX;
      let targetY = anchorY + offsetY - labelHeight * 0.5;

      if (side < 0) {
        targetX -= labelWidth;
      }

      targetX = clamp(targetX, 14, width - labelWidth - 14);
      targetY = clamp(targetY, 14, height - labelHeight - 14);

      calloutState.x += (targetX - calloutState.x) * 0.24;
      calloutState.y += (targetY - calloutState.y) * 0.24;
      const targetOpacity = clamp(
        0.34 + target.userData.selected * 0.44 + target.userData.hover * 0.24,
        0,
        1
      );
      calloutState.opacity += (targetOpacity - calloutState.opacity) * 0.2;

      callout.style.transform =
        `translate3d(${calloutState.x.toFixed(1)}px, ${calloutState.y.toFixed(1)}px, 0)`;
      callout.style.opacity = calloutState.opacity.toFixed(3);

      const lineTargetX = side > 0 ? calloutState.x : calloutState.x + labelWidth;
      const lineTargetY = calloutState.y + labelHeight * 0.5;
      const elbowX = anchorX + side * (width < 900 ? 28 : 42);
      const elbowY = anchorY + offsetY * 0.3;

      calloutPath.setAttribute(
        "d",
        `M ${anchorX.toFixed(1)} ${anchorY.toFixed(1)} ` +
          `L ${elbowX.toFixed(1)} ${elbowY.toFixed(1)} ` +
          `L ${lineTargetX.toFixed(1)} ${lineTargetY.toFixed(1)}`
      );
      calloutPath.setAttribute("opacity", calloutState.opacity.toFixed(3));
      calloutDot.setAttribute("cx", anchorX.toFixed(1));
      calloutDot.setAttribute("cy", anchorY.toFixed(1));
      calloutDot.setAttribute("opacity", calloutState.opacity.toFixed(3));
    }

    function hideAmbientCallout(state) {
      state.opacity += (0 - state.opacity) * 0.2;
      state.element.style.opacity = state.opacity.toFixed(3);
      state.path.setAttribute("opacity", state.opacity.toFixed(3));
      state.markerFrame.setAttribute("opacity", state.opacity.toFixed(3));
      state.markerCore.setAttribute("opacity", state.opacity.toFixed(3));
    }

    function updateAmbientCallouts(time) {
      const ambientStrength = 1 - smoothstep(0.22, 0.62, viewState.zoom);

      ambientCallouts.forEach((state, index) => {
        const hotspot = ambientHotspots[index];

        if (!hotspot || ambientStrength <= 0.02) {
          hideAmbientCallout(state);
          return;
        }

        tempVectorA.copy(getSphericalNormal(hotspot.pitch, hotspot.yaw));
        tempVectorB.copy(tempVectorA).multiplyScalar(sphereConfig.sphereRadius + 34);
        tempVectorB.applyMatrix4(cardGroup.matrixWorld);
        tempProjected.copy(tempVectorB).project(camera);

        tempWorldNormal.copy(tempVectorA).transformDirection(cardGroup.matrixWorld);
        tempToCamera.copy(camera.position).sub(tempVectorB).normalize();

        const facing = tempWorldNormal.dot(tempToCamera);
        const onScreen =
          tempProjected.z >= -1 &&
          tempProjected.z <= 1 &&
          Math.abs(tempProjected.x) <= 1.08 &&
          Math.abs(tempProjected.y) <= 1.04;

        if (!onScreen) {
          hideAmbientCallout(state);
          return;
        }

        state.eyebrow.textContent = hotspot.label;
        setAmbientCalloutLines(state, hotspot.lines || [hotspot.title]);

        const width = container.clientWidth;
        const height = container.clientHeight;
        const anchorX = (tempProjected.x * 0.5 + 0.5) * width;
        const anchorY = (-tempProjected.y * 0.5 + 0.5) * height;
        const side = hotspot.side;
        const labelWidth = state.element.offsetWidth || 180;
        const labelHeight = state.element.offsetHeight || 68;
        const offsetX = side * (width < 900 ? 60 : 92);
        const offsetY = width < 900 ? -18 : -28;
        let targetX = anchorX + offsetX;
        let targetY = anchorY + offsetY - labelHeight * 0.5;

        if (side < 0) {
          targetX -= labelWidth;
        }

        targetX = clamp(targetX, 10, width - labelWidth - 10);
        targetY = clamp(targetY, 10, height - labelHeight - 10);

        if (state.opacity <= 0.04) {
          state.x = targetX;
          state.y = targetY;
        }

        state.x += (targetX - state.x) * 0.16;
        state.y += (targetY - state.y) * 0.16;

        const targetOpacity = clamp((facing - 0.06) / 0.58, 0, 1) * ambientStrength;

        state.opacity += (targetOpacity - state.opacity) * 0.1;
        state.element.style.transform =
          `translate3d(${state.x.toFixed(1)}px, ${state.y.toFixed(1)}px, 0)`;
        state.element.style.opacity = state.opacity.toFixed(3);

        const lineTargetX = side > 0 ? state.x : state.x + labelWidth;
        const lineTargetY = state.y + labelHeight * 0.5;
        const elbowX = anchorX + side * (width < 900 ? 22 : 34);
        const elbowY = anchorY + offsetY * 0.28;

        state.path.setAttribute(
          "d",
          `M ${anchorX.toFixed(1)} ${anchorY.toFixed(1)} ` +
            `L ${elbowX.toFixed(1)} ${elbowY.toFixed(1)} ` +
            `L ${lineTargetX.toFixed(1)} ${lineTargetY.toFixed(1)}`
        );
        state.path.setAttribute("opacity", state.opacity.toFixed(3));
        state.markerFrame.setAttribute("x", (anchorX - 7).toFixed(1));
        state.markerFrame.setAttribute("y", (anchorY - 7).toFixed(1));
        state.markerFrame.setAttribute("opacity", state.opacity.toFixed(3));
        state.markerCore.setAttribute("x", (anchorX - 4).toFixed(1));
        state.markerCore.setAttribute("y", (anchorY - 4).toFixed(1));
        state.markerCore.setAttribute("opacity", state.opacity.toFixed(3));
      });
    }

    function animate(time) {
      viewState.zoom += (viewState.zoomTarget - viewState.zoom) * 0.12;
      viewState.flatten = smoothstep(0.16, 0.58, viewState.zoom);

      if (!interaction.dragging && viewState.zoom < 0.18) {
        orbitState.targetY += 0.00125;
      }

      if (!interaction.dragging && viewState.flatten > 0.55) {
        flatState.targetX += flatState.velocityX;
        flatState.targetY += flatState.velocityY;
        flatState.velocityX *= 0.92;
        flatState.velocityY *= 0.92;

        const clamped = clampPan(flatState.targetX, flatState.targetY);
        flatState.targetX = clamped.x;
        flatState.targetY = clamped.y;
      } else if (viewState.flatten < 0.28) {
        flatState.targetX *= 0.88;
        flatState.targetY *= 0.88;
        flatState.velocityX *= 0.8;
        flatState.velocityY *= 0.8;
      }

      flatState.x += (flatState.targetX - flatState.x) * 0.16;
      flatState.y += (flatState.targetY - flatState.y) * 0.16;

      const flattenRotation = 1 - smoothstep(0.12, 0.46, viewState.zoom);
      const viewportWidth = getViewportWidth();
      const sceneScaleTarget = getSceneScale();
      const cameraZTarget = THREE_LIB.MathUtils.lerp(
        viewportWidth < 900 ? 790 : viewportWidth < 1440 ? 760 : 720,
        viewportWidth < 900 ? 460 : viewportWidth < 1440 ? 540 : 520,
        viewState.zoom
      );
      const cameraYTarget = THREE_LIB.MathUtils.lerp(10, -16, viewState.flatten);

      camera.position.z = THREE_LIB.MathUtils.lerp(camera.position.z, cameraZTarget, 0.08);
      camera.position.y = THREE_LIB.MathUtils.lerp(camera.position.y, cameraYTarget, 0.08);

      tiltGroup.rotation.z = THREE_LIB.MathUtils.lerp(
        tiltGroup.rotation.z,
        orbitState.baseTilt * flattenRotation,
        0.08
      );
      pitchGroup.rotation.x = THREE_LIB.MathUtils.lerp(
        pitchGroup.rotation.x,
        orbitState.targetX * flattenRotation,
        0.08
      );
      cardGroup.rotation.y = THREE_LIB.MathUtils.lerp(
        cardGroup.rotation.y,
        orbitState.targetY * flattenRotation,
        0.08
      );
      const nextScale = THREE_LIB.MathUtils.lerp(
        cardGroup.scale.x,
        sceneScaleTarget,
        0.12
      );
      cardGroup.scale.setScalar(nextScale);

      sphereCore.material.uniforms.uOpacity.value =
        THREE_LIB.MathUtils.lerp(0.22, 0.02, viewState.flatten);
      wireSphere.material.opacity = THREE_LIB.MathUtils.lerp(0.24, 0.02, viewState.flatten);
      wireSphere.rotation.y += 0.0014 * (1 - viewState.flatten * 0.7);
      wireSphere.rotation.x = Math.sin(time * 0.00034) * 0.18;

      tileMeshes.forEach((tile) => updateTileVisual(tile, time));

      camera.lookAt(0, 0, 0);
      updateCallout();
      updateAmbientCallouts(time);
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    async function initScene() {
      const fontReady = document.fonts ? document.fonts.ready.catch(() => null) : Promise.resolve();
      const imageMap = await preloadCardImages(cardItems);
      await fontReady;

      createTiles(imageMap);
      updateLayout();

      container.addEventListener("pointerdown", onPointerDown);
      container.addEventListener("pointermove", onPointerMove);
      container.addEventListener("pointerup", onPointerUp);
      container.addEventListener("pointerleave", onPointerLeave);
      container.addEventListener("pointercancel", onPointerUp);
      container.addEventListener("wheel", onWheel, { passive: false });
      window.addEventListener("resize", updateLayout);

      requestAnimationFrame(animate);
    }

    initScene();
  })();
}

// sphere bundle scene: end
