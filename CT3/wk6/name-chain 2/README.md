# The Person in the Name

输入一个名字 → 向 Wikidata 查询所有同名的人，得出年龄、国籍、性别（查不到时用 agify / nationalize / genderize 备用） → 猜测变成博物馆搜索条件 → 画作通过六种方式（标题里的一个词、同一艺术家、同一地点、同一年代、同一技法、同一地点早一百年）引出更多画作 → 生成 mood board。

## 文件

| 文件 | 作用 |
|---|---|
| `index.html` | 主体验页（输入 → 链条 → mood board） |
| `style.css` | 所有样式 |
| `script.js` | 链条逻辑，所有 API 请求都在这里 |
| `about.html` | About 页：项目描述、机制图、回答 brief 的问题、视频位置 |

## 在 VS Code 里运行

1. 用 VS Code 打开这个文件夹。
2. 安装扩展 **Live Server**。
3. 右键 `index.html` → **Open with Live Server**。

小技巧：在网址后面加 `?name=Jia` 会自动开始运行，录视频时很方便。

## 发布到 GitHub Pages

1. 在 GitHub 新建一个仓库（例如 `person-in-the-name`）。
2. 在 VS Code 左侧 Source Control 里提交并推送这个文件夹。
3. 仓库 Settings → Pages → Branch 选 `main`、文件夹选 `/ (root)` → Save。
4. 几分钟后网址会出现在同一页面：`https://你的用户名.github.io/person-in-the-name/`

## 可以调整的地方（都在 `script.js` 顶部的 `CFG`）

- `genTargets`：每一代的画作数量，默认 2 → 4 → 6（共 12 幅）
- `delay`：每一步之间的停顿（毫秒），调大会更有戏剧感
- `genX` / `rowHeight`：画板上的排布

## 注意

- agify / nationalize / genderize 免费版每天每个网络约 100 次。用完后小票会写明「today’s free limit is used up」，数值后面带问号，表示是用字母编的；链条仍能继续。
- 查过的名字会记在浏览器里，再查同一个名字不消耗额度。展示前先把要演示的名字在同一个浏览器里跑一遍，现场就不怕额度不够。
- 画作来自克利夫兰艺术博物馆（Cleveland Museum of Art）的开放 API；它连不上时自动改用大都会博物馆（The Met）。只使用公有领域作品。
- `about.html` 里的 Video 部分是占位符，录好视频后把注释里的 `<video>` 标签换上去即可。
