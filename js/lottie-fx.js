/**
 * Lottie 动效封装 · CDN lottie-web
 * 资源：内置轻量 JSON + 可选远程 LottieFiles（失败则 CSS 回退）
 */
(function (global) {
  "use strict";

  // 极简成功对勾 Lottie（自包含，离线可用）
  const SUCCESS_JSON = {
    v: "5.7.4",
    fr: 60,
    ip: 0,
    op: 60,
    w: 200,
    h: 200,
    nm: "success",
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: "circle",
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 0, k: 0 },
          p: { a: 0, k: [100, 100, 0] },
          a: { a: 0, k: [0, 0, 0] },
          s: {
            a: 1,
            k: [
              { t: 0, s: [0, 0, 100], e: [110, 110, 100] },
              { t: 20, s: [110, 110, 100], e: [100, 100, 100] },
              { t: 30, s: [100, 100, 100] },
            ],
          },
        },
        ao: 0,
        shapes: [
          {
            ty: "el",
            p: { a: 0, k: [0, 0] },
            s: { a: 0, k: [120, 120] },
          },
          {
            ty: "fl",
            c: { a: 0, k: [0, 0.91, 0.94, 1] },
            o: { a: 0, k: 100 },
          },
        ],
        ip: 0,
        op: 60,
        st: 0,
      },
    ],
  };

  // 扭蛋光点脉冲（极简）
  const SPIN_JSON = {
    v: "5.7.4",
    fr: 30,
    ip: 0,
    op: 45,
    w: 200,
    h: 200,
    nm: "spin",
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: "ring",
        sr: 1,
        ks: {
          o: {
            a: 1,
            k: [
              { t: 0, s: [40], e: [100] },
              { t: 22, s: [100], e: [40] },
              { t: 45, s: [40] },
            ],
          },
          r: {
            a: 1,
            k: [
              { t: 0, s: [0], e: [180] },
              { t: 45, s: [180] },
            ],
          },
          p: { a: 0, k: [100, 100, 0] },
          a: { a: 0, k: [0, 0, 0] },
          s: {
            a: 1,
            k: [
              { t: 0, s: [70, 70, 100], e: [120, 120, 100] },
              { t: 45, s: [70, 70, 100] },
            ],
          },
        },
        shapes: [
          {
            ty: "el",
            p: { a: 0, k: [0, 0] },
            s: { a: 0, k: [90, 90] },
          },
          {
            ty: "st",
            c: { a: 0, k: [1, 0.18, 0.58, 1] },
            o: { a: 0, k: 100 },
            w: { a: 0, k: 8 },
          },
        ],
        ip: 0,
        op: 45,
        st: 0,
      },
    ],
  };

  const anims = {};

  function ready() {
    return typeof lottie !== "undefined";
  }

  function playIn(el, data, opts) {
    if (!el) return null;
    opts = opts || {};
    if (!ready()) {
      el.classList.add("lottie-fallback");
      return null;
    }
    el.innerHTML = "";
    el.classList.remove("lottie-fallback");
    try {
      const inst = lottie.loadAnimation({
        container: el,
        renderer: "svg",
        loop: !!opts.loop,
        autoplay: opts.autoplay !== false,
        animationData: typeof data === "string" ? undefined : data,
        path: typeof data === "string" ? data : undefined,
      });
      if (opts.hideAfter) {
        inst.addEventListener("complete", () => {
          el.innerHTML = "";
        });
      }
      return inst;
    } catch (e) {
      el.classList.add("lottie-fallback");
      return null;
    }
  }

  function playSuccessOverlay() {
    let host = document.getElementById("lottie-overlay");
    if (!host) {
      host = document.createElement("div");
      host.id = "lottie-overlay";
      host.className = "lottie-overlay";
      document.body.appendChild(host);
    }
    host.classList.remove("hidden");
    host.innerHTML = '<div class="lottie-box" id="lottie-success-box"></div>';
    playIn(document.getElementById("lottie-success-box"), SUCCESS_JSON, {
      loop: false,
      hideAfter: true,
    });
    setTimeout(() => {
      host.classList.add("hidden");
      host.innerHTML = "";
    }, 1200);
  }

  function playSpinIn(el) {
    return playIn(el, SPIN_JSON, { loop: true, autoplay: true });
  }

  function stop(el) {
    if (el) el.innerHTML = "";
  }

  global.TravelLottie = {
    ready,
    playIn,
    playSuccessOverlay,
    playSpinIn,
    stop,
    SUCCESS_JSON,
    SPIN_JSON,
  };
})(typeof window !== "undefined" ? window : globalThis);
