# Cloudflare Message Forwarding Worker

一个轻量的 Cloudflare Worker，用统一 HTTP 接口转发消息到不同平台。

当前支持：
- Telegram Bot
- 通用 Webhook
- 企业微信机器人（WeCom）

## 功能概览

- 支持 `POST(JSON)` 与 `GET(query)` 两种调用方式
- 按 `type` 分发到不同渠道
- 标题和正文统一模板拼接
- 错误统一返回 JSON

## 文件结构

- `_worker.js`：Worker 主逻辑

## 快速开始

### 1. 部署 Worker

你可以使用 Cloudflare Dashboard 或 Wrangler 部署该文件。

如果使用 Wrangler（示例）：

```bash
npm install -g wrangler
wrangler login
wrangler init cloudflare-message-forwarding
```

将本项目的 `_worker.js` 内容替换到入口文件（或直接将其作为 Worker 脚本部署）。

### 2. 配置环境变量（可选但推荐）

按需配置：

- `TG_BOT_TOKEN`：Telegram 机器人 token
- `TG_CHAT_ID`：Telegram 默认 chat_id
- `WECOM_WEBHOOK_URL`：企业微信机器人 webhook 地址

说明：
- webhook 类型通常直接在请求体 `extra.url` 传入。
- 企业微信 webhook 仅从环境变量 `WECOM_WEBHOOK_URL` 读取。

### 3. 调用统一接口

支持 `POST` 与 `GET` 请求：

- `POST`：请求体为 JSON
- `GET`：通过 query 参数传参

通用字段：

- `type`：消息类型（必填）
- `content`：消息正文（必填）
- `title`：消息标题（选填）
- `extra`：各平台扩展参数（选填）

GET 扩展参数（便捷写法）：

- `url`：等价于 `extra.url`
- `chat_id`：等价于 `extra.chat_id`
- `msgtype`：等价于 `extra.msgtype`
- `extra`：JSON 字符串，作为 `extra` 对象（可与上述参数混用）

## 请求示例

### Telegram

```json
{
  "type": "telegram",
  "title": "告警",
  "content": "服务异常，请及时处理",
  "extra": {
    "chat_id": "123456789"
  }
}
```

说明：
- `chat_id` 可不传，不传时使用 `TG_CHAT_ID`。

GET 示例：

```text
GET /?type=telegram&title=告警&content=服务异常&chat_id=123456789
```

### 通用 Webhook

```json
{
  "type": "webhook",
  "title": "通知",
  "content": "发布成功",
  "extra": {
    "url": "https://example.com/webhook"
  }
}
```

GET 示例：

```text
GET /?type=webhook&title=通知&content=发布成功&url=https%3A%2F%2Fexample.com%2Fwebhook
```

### 企业微信机器人（WeCom）

```json
{
  "type": "wecom",
  "title": "告警",
  "content": "CPU 使用率过高",
  "extra": {
    "msgtype": "text"
  }
}
```

GET 示例：

```text
GET /?type=wecom&title=告警&content=CPU使用率过高&msgtype=text
```

兼容别名：
- `type` 也可以使用 `wechat_work`

企业微信扩展参数：
- `extra.msgtype`：`text` 或 `markdown`，默认 `text`
- 机器人地址固定使用环境变量 `WECOM_WEBHOOK_URL`

## 返回格式

### 成功

```json
{
  "success": true,
  "result": "..."
}
```

### 失败

```json
{
  "success": false,
  "error": "错误信息"
}
```

常见状态码：
- `400`：参数错误、JSON 非法、类型不支持
- `405`：请求方法不是 POST/GET
- `500`：下游平台调用失败

## 标题模板规则

- 有 `title` 时，发送内容格式：`*title*\ncontent`
- 无 `title` 时，仅发送 `content`

## 文本转义与兼容

- 会自动把字面量转义字符转换为真实字符：`\\n`、`\\r\\n`、`\\r`、`\\t`
- 该规则对 `POST` 和 `GET` 都生效

## 注意事项

- Telegram 当前使用 `parse_mode: Markdown`，标题中的特殊字符可能需要转义。
- 企业微信若开启了“加签”安全设置，当前版本未自动计算签名，请在 webhook 侧或代码中扩展签名逻辑。
- 请勿将敏感 token 写入代码仓库，优先使用 Worker 环境变量。

## 后续可扩展方向

- 企业微信加签支持（timestamp + sign）
- 钉钉 / 飞书机器人接入
- 请求签名校验（保护你的 Worker 接口）
- 重试与告警分级策略
