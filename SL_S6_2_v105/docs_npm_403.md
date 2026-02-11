# npm 403（CONNECT tunnel failed）排查与处理

当出现如下错误时：

- `npm ERR! 403 Forbidden - GET https://registry.npmjs.org/...`
- `curl: (56) CONNECT tunnel failed, response 403`

通常代表：环境只能走代理出网，但代理策略禁止访问 npm registry。

## 一键诊断

```bash
npm run doctor:npm
```

该命令会：
1. 检查“当前 registry + 当前代理”可达性。
2. 检查 npm 官方源在代理下是否被拦截。
3. 检查去掉代理后是否可直连。

## 解决方案

### 1) 使用内网 npm 镜像（推荐）

```bash
NPM_REGISTRY_URL=https://<internal-registry>/
npm config set registry "$NPM_REGISTRY_URL" --location project
npm install
```

### 2) 放行代理策略

请网络管理员放行：
- `registry.npmjs.org:443`

### 3) CI 注入 registry 与 token

在 CI 中通过环境变量注入私有 registry 与 token，不要硬编码在仓库里。
