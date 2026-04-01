import { Router } from 'express';

const router = Router();

router.post('/feishu/send-report', async (req, res) => {
  const { content, feishuWebhookUrl } = req.body;
  const webhookUrl = feishuWebhookUrl || process.env.FEISHU_WEBHOOK_URL;

  if (!webhookUrl) {
    return res.status(500).json({ error: '飞书 Webhook 未配置。请在系统设置中填入 Webhook URL。' });
  }

  if (!content) {
    return res.status(400).json({ error: '内容不能为空' });
  }

  const TRUNCATE_LIMIT = 28000;
  let finalContent = content;
  if (finalContent.length > TRUNCATE_LIMIT) {
    finalContent = finalContent.substring(0, TRUNCATE_LIMIT) + '\n\n... (由于长度确认，已截断剩余内容)';
  }

  try {
    let title = 'AI 交易研报';
    let template = 'blue';

    if (req.body.type === 'daily') {
      title = '📅 市场晨间内参';
      template = 'orange';
    } else if (req.body.type === 'discussion') {
      title = '🚀 联席专家研报总结';
      template = 'indigo';
    } else if (req.body.type === 'chat') {
      title = '🧠 深度追问解答';
      template = 'turquoise';
    } else if (req.body.type === 'stock') {
      title = '🔍 个股速览报告';
      template = 'green';
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'interactive',
        card: {
          header: {
            title: { tag: 'plain_text', content: title },
            template: template,
          },
          elements: [
            { tag: 'div', text: { tag: 'lark_md', content: finalContent } },
            { tag: 'hr' },
            {
              tag: 'note',
              elements: [
                { tag: 'plain_text', content: `由 TradingAgents AI 专家组生成 • ${new Date().toLocaleString()}` },
              ],
            },
          ],
        },
      }),
    });

    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(data.msg || 'Feishu API 返回错误');
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Feishu Webhook Error:', error);
    res.status(500).json({ error: '无法发送报告至飞书，请检查 Webhook URL 是否正确。' });
  }
});

export default router;
