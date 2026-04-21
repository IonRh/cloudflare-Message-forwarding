export default {
  async fetch(request, env) {
    if (request.method !== "POST" && request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    let data;
    if (request.method === "POST") {
      try {
        data = await request.json();
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }
    } else {
      const url = new URL(request.url);
      const type = url.searchParams.get("type");
      const title = url.searchParams.get("title") || undefined;
      const content = url.searchParams.get("content");
      const extraParam = url.searchParams.get("extra");
      let extra = {};

      if (extraParam) {
        try {
          extra = JSON.parse(extraParam);
        } catch {
          return new Response("Invalid extra JSON in query", { status: 400 });
        }
      }

      // Support common shortcut query params for each channel.
      const webhookUrl = url.searchParams.get("url");
      const chatId = url.searchParams.get("chat_id");
      const msgtype = url.searchParams.get("msgtype");

      if (webhookUrl && !extra.url) {
        extra.url = webhookUrl;
      }
      if (chatId && !extra.chat_id) {
        extra.chat_id = chatId;
      }
      if (msgtype && !extra.msgtype) {
        extra.msgtype = msgtype;
      }

      data = { type, title, content, extra };
    }

    const { type, title, content, extra = {} } = data;

    if (!type || !content) {
      return new Response("Missing params", { status: 400 });
    }

    try {
      let result;

      switch (type) {
        case "telegram":
          result = await sendTelegram(env, title, content, extra);
          break;

        case "webhook":
          result = await sendWebhook(extra.url, title, content);
          break;

        case "wecom":
        case "wechat_work":
          result = await sendWecom(env, title, content, extra);
          break;

        default:
          return new Response("Unsupported type", { status: 400 });
      }

      return new Response(JSON.stringify({
        success: true,
        result
      }), { headers: { "Content-Type": "application/json" } });

    } catch (err) {
      return new Response(JSON.stringify({
        success: false,
        error: err.message
      }), { status: 500 });
    }
  }
};

// ====== 平台实现 ======

async function sendTelegram(env, title, content, extra) {
  const token = env.TG_BOT_TOKEN;
  const chat_id = extra.chat_id || env.TG_CHAT_ID;

  const text = formatText(title, content);

  const res = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id,
        text,
        parse_mode: "Markdown"
      })
    }
  );

  return await res.json();
}

async function sendWebhook(url, title, content) {
  if (!url) {
    throw new Error("Missing webhook url");
  }

  const payload = {
    text: formatText(title, content)
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return await res.text();
}

async function sendWecom(env, title, content, extra) {
  const webhookUrl = env.WECOM_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("Missing env WECOM_WEBHOOK_URL");
  }

  const msgtype = extra.msgtype === "markdown" ? "markdown" : "text";
  const text = formatText(title, content);

  const payload = msgtype === "markdown"
    ? {
      msgtype: "markdown",
      markdown: { content: text }
    }
    : {
      msgtype: "text",
      text: { content: text }
    };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const result = await res.json();
  if (result.errcode !== 0) {
    throw new Error(result.errmsg || "WeCom send failed");
  }

  return result;
}

// ====== 模板统一 ======

function formatText(title, content) {
  if (title) {
    return `*${title}*\n${content}`;
  }
  return content;
}