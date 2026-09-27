# 最简 GitHub Desktop 交接方式（推荐）

> 适用于不想在 GitHub 网页中处理 83 MB ZIP、不想使用命令行、也暂时不部署网站的情况。

## 为什么推荐这一方式

GitHub 网页中的 **Upload files** 对单个文件通常有约 **25 MB** 的浏览器上传限制，因此 83 MB 的交接 ZIP 可能无法直接上传。即使通过命令行上传单一 ZIP，也会把重复的压缩包永久写进 Git 历史。

正确做法是：**在本地解压 ZIP，然后只把其中已经整理好的 `source/` 文件夹提交到一个新的私有 GitHub 仓库。**

## 操作步骤

1. 下载 `Modernite_Codex_GitHub_Deployment_Handoff.zip`。
2. 在电脑上双击解压，得到：

   ```text
   modernite-codex-handoff/
   └── source/
   ```

3. 安装并打开 [GitHub Desktop](https://desktop.github.com/)。
4. 选择 **File → Add Local Repository**。
5. 选择刚解压出来的：

   ```text
   modernite-codex-handoff/source/
   ```

6. 如果 GitHub Desktop 提示这个目录尚不是 Git repository，选择 **Create a repository here**。
7. Repository name 建议填写：

   ```text
   modernite-bipv-platform
   ```

8. 点击 **Publish repository**，并务必勾选：

   ```text
   Keep this code private
   ```

9. 发布成功后，在 GitHub 中打开该私有仓库，再打开 Codex。
10. 将 `docs/handoff/CODEX_MASTER_PROMPT.md` 的全部内容复制并粘贴给 Codex。

## 绝对不要做的事

- 不要把 `.env`、Google Maps key、LLM key、数据库密码放入 GitHub。
- 不要修改 `client/public/studio.html`。
- 不要在第一步就部署、购买服务或配置生产域名。
- 不要把整个 ZIP 再放进 Git history；只提交解压后的 `source/` 内容。

## 验收点

GitHub 仓库根目录应该直接包含：

```text
client/
server/
lib/
data/
tests/
docs/
package.json
pnpm-lock.yaml
```

而不是：

```text
modernite-codex-handoff/source/client/
```

也不应该只看到一个 ZIP 文件。
