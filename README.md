# 杭州 WTC · WFDF 规则考试

面向手机的中文规则情境考试与完整规则书，统一采用 **WFDF Rules of Ultimate 2025–2028** 主规则。

## 使用

- 每次 25 道不重复单选题，每题 4 分，满分 100 分，不限时。
- 每卷覆盖 20 章，至少含 2 道飞盘精神题；题目和选项分别随机排序。
- 点击选项立即判题，显示正确答案、解析、原始规则编号、对应中文条文及可展开的英文原文。
- 解析为题目涉及的英文喊话和专业术语补充中文释义，术语校核依据见 [docs/TERMINOLOGY.md](docs/TERMINOLOGY.md)。
- 首次提交的答案锁定不可修改，作答后才解锁下一题；完成 25 题后显示总分与完整复盘。
- 自动保存本次进度，支持回看已答题目和标记；完成后直接显示成绩与错题回顾。
- 规则库收录介绍、368 个编号条目、40 个定义和法律许可，支持编号、中英文关键词搜索。
- 首页提供无水印中文 PDF 下载。
- 浏览器仅保留当前试卷，开始新考试后替换；不提供历史记录。无账号、无答题数据上传。

本项目是独立学习工具，不是 WFDF 官方认证考试；不设官方合格线。静态站点中的答案可通过源码查看，因此不用于防作弊或身份认证考试。

## 本地启动

需要 Node.js 22 或更高版本，无第三方运行依赖。

```sh
npm run dev
```

打开终端显示的 `http://127.0.0.1:4173`。不能直接双击 HTML，因为题库通过 fetch 加载。

```sh
npm test
npm run build
```

构建产物为 `dist/`，可以放到任意静态服务器。所有资源使用相对路径，兼容 GitHub 项目页面子目录。

## GitHub Pages 部署

仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
推送 `main` 后，`.github/workflows/pages.yml` 自动执行测试、构建和发布。也可以在 Actions 中手动运行。

预期地址：`https://wch1007.github.io/WFDF-examination/`。

## 规则依据与范围

- [官方英文主规则 PDF](https://rules.wfdf.sport/wp-content/uploads/2024/12/WFDF-Rules-of-Ultimate-2025-2028.pdf)，2025-01-01 生效。
- [WFDF 官网中文译本](https://rules.wfdf.sport/wp-content/uploads/2025/10/01-WFDF世界飞盘联合会飞盘规则（2025-2028）中文版.pdf)，全国飞盘运动推广委员会组织翻译。
- 中文重新对照英文编校并排版，保留全部条款及编号，修复中文底本缺失的 19.2.1.1。不是官方认证译本。
- 只使用此版主规则；未合入 Appendix、Annotations、旧版或其他规则体系。
- 规则库和 PDF 共用经过校订的中文内容。英文原文从官方 PDF 提取；可能保留原文的列表连接词和排版空格。

`site/data/questions.json` 是完整题库；每题的 `refs` 直接对应 `site/data/rules.json`。`site/data/coverage.json` 提供逐条映射：`direct` 表示题目实际引用，`viaChildren` 表示该编号的子条款受到覆盖，两者不混计。覆盖率是内容覆盖检查，不代替对题干和解释的语义审核。

## 维护题库

每题格式：

```json
{
  "id": "q-17-001",
  "chapter": 17,
  "stem": "完整比赛情境与问题",
  "options": ["正确选项", "干扰项一", "干扰项二", "干扰项三"],
  "answer": 0,
  "explanation": "解释相关条件与处理结果。",
  "termNotes": [{ "term": "Dangerous Play", "text": "危险动作" }],
  "refs": ["17.1.1"],
  "tags": ["危险动作"]
}
```

`termNotes` 为可选字段：在判断依据下方列出本题涉及的英文或专业术语，避免将长释义插入句中。全题库语句校订记录见 [docs/EDITORIAL_REVIEW.md](docs/EDITORIAL_REVIEW.md)。

新增内容须核对同版官方英文原文，写明必要的条件，确保单一正确答案。不要为凑覆盖率添加无关引用。调整题干、选项、答案或题目集合后，更新题库 `revision` 并运行 `npm run coverage` 重新生成覆盖清单。旧版存档将不再加载，防止用新答案误判旧试卷。

验证包含：题库结构与引用、最末级条款覆盖、500 份随机试卷的章节与重复检查、答案洗牌后的计分、未答题处理、存档往返和损坏存档拒绝。发布前还应人工审阅题目和手机交互。

## 许可与署名

规则原作者与许可人：**World Flying Disc Federation**。规则及衍生中文文本按 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) 许可。

中文底本翻译人员：王哲、戴华、尧牧野、路佳、孟明、郭铮铮、李岩、张新光、薛志行。本站进行了校订与重排；版式参考用户提供的 2021–2024 中文规则书，未使用旧版规则内容或水印图形。

原创情境题与解析：本项目维护者，CC BY 4.0。网站代码：MIT，见 LICENSE。编校日期：2026-11-02。

杭州 WTC 队徽由用户提供。网站维护：[大帅](https://github.com/wch1007)。
