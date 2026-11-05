# Rain from Elsewhere

远方城市此刻的雨落在屏幕上的水面。实时降水 → 雨滴（agent）→ 水面波动场（field）→ 折射你的照片（texture）、池底光网、水面闪光。

## 文件

| 文件 | 作用 |
|---|---|
| `index.html` | 作品本身：水面模拟和界面，所有 shader 都在里面 |
| `about.html` | 交作业用的文档页：Observe / Sketch / System / Input & Output / Time as height / Video |
| `media/` | 文档页的图片和视频 |

## 在 VS Code 里运行

1. 用 VS Code 打开这个文件夹。
2. 右键 `index.html` → **Open with Live Server**。
3. 点右上角 "About the project →" 进入文档页。

一定要用 Live Server（或者 GitHub Pages）打开。直接双击打开文件的话，`media/floor.jpg` 不会自动读进去。

## 还需要你放进 `media/` 的东西

文件名照下面写，放进去刷新页面就会自动显示，不用改代码：

| 文件名 | 内容 |
|---|---|
| `photo-1.jpg`、`photo-2.jpg` | 你自己拍的水的照片（Observe） |
| `sketch.jpg` | 课上 5 分钟的手绘草图 |
| `sketch-2.jpg` | 第二张草图，可选 |
| `demo.mp4` | 录屏视频：在作品里按 `R` 开始，再按 `R` 停止，会下载一个 mp4，改名放进来 |
| `layers.jpg` | 导出的 3D 模型的渲染图（按 `L` 开始记录、`E` 导出 .obj，在 Blender 里打开截图） |
| `print.jpg` | 3D 打印照片，可选 |
| `floor.jpg` | 想放在水底的照片。放了以后作品打开就自动用它当底图 |

`state-*.jpg` 四张是我用临时底图渲染的状态截图，换成你自己的照片以后可以重新截。`ref-1.jpg`、`ref-2.jpg` 是你发的两张视觉参考图。

## 操作

- 点击 / 拖动：碰水面
- `H` 隐藏界面　`F` 换底图　`O` 载入照片　`空格` 暂停
- `R` 录视频（左下角会自动带上城市和天气数据）
- `L` 开始/停止记录层，`E` 导出 3D（时间变成高度）
- 右上角 Surface：Refraction 折射强度、Sparkle 闪光数量、Grain 颗粒

## 注意

- 天气数据来自 Open-Meteo，不需要 API key，每 10 分钟更新一次。左下角显示 "Live · Open-Meteo" 就是真实数据；显示 "Offline" 就是没连上，正在用随机的演示数据。
- 太阳位置是根据城市经纬度和真实时间算的，所以每个城市的光都不一样，晚上会变暗变蓝。
- 需要支持 WebGL2 的浏览器（Chrome、Safari、Firefox 新版都可以）。
