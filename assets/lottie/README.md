# Lottie 资源说明

运行时默认使用 `js/lottie-fx.js` 内嵌的轻量 JSON（成功对勾、扭蛋光环），**不依赖本目录文件**。

引擎：CDN `lottie-web` 5.12.2（见 `index.html`）。

若要换成更炫的 LottieFiles 动画：

1. 将 `.json` 放到本目录，例如 `gacha.json`、`success.json`
2. 在 `js/lottie-fx.js` 中用路径加载：

```js
TravelLottie.playIn(el, "assets/lottie/gacha.json", { loop: true });
```

注意：部分 LottieFiles 资源有版权限制，商用请自行确认许可。
