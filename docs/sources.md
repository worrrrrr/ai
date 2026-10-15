# แหล่งข้อมูลภายนอก + วิธีดึงมาตรวจ

ใช้เมื่อต้องแตะ API/เฟรมเวิร์ก — **อย่า**คัดลอกเนื้อหาเอกสารมาไว้ในคัมภีร์ ให้แนบลิงก์แล้วดึงตอนต้องใช้
อัปเดต: 2026-10-14

กติกาการดึง: แหล่งเดียวกันมีหลายรูปแบบ (HTML / `llms.txt` / `.md`) ซึ่งให้ **เนื้อหาเดียวกัน**
ให้ดึงฝั่ง **เครื่องอ่าน** (`llms.txt`/`.md`) ก่อน ถ้าไม่มีจึงดึง HTML แล้วจัดให้เป็น markdown
ก่อนเปรียบเทียบ/สรุป — อย่าเทียบ HTML กับ md ตรง ๆ

| บริการ             | ใช้ทำอะไร                             | ตัวแปร                                                   | ลิงก์คนอ่าน                                                 | ลิงก์เครื่องอ่าน                                            |
| ------------------ | ------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| Supabase           | Auth + ตาราง `chats`/`messages` (RLS) | `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | https://supabase.com/docs/guides/auth/server-side/sveltekit | https://supabase.com/llms.txt                               |
| Exa                | ค้นหาเว็บ (ทางหลักของ tool `search`)  | `EXA_API_KEY` (secret)                                   | https://docs.exa.ai/reference/search                        | https://exa.ai/docs/llms.txt                                |
| Open-Meteo         | อากาศจริง (geocoding + forecast)      | ไม่ต้องมี key                                            | https://open-meteo.com/en/docs                              | — (ไม่มี llms.txt)                                          |
| DuckDuckGo IA      | คำตอบตรงของ `search` (สำรอง)          | ไม่ต้องมี key                                            | https://api.duckduckgo.com/                                 | —                                                           |
| Wikipedia API      | ค้นหาเชิงสารานุกรม (สำรอง)            | ไม่ต้องมี key                                            | https://www.mediawiki.org/wiki/API:Search                   | https://www.mediawiki.org/w/api.php?action=help&format=json |
| Ollama             | โมเดลแชท + decision model (Tev1)      | ต้องมี Ollama local/cloud                                | https://github.com/nordwestt/ai-sdk-ollama                  | — (อ่าน README จาก repo)                                    |
| SvelteKit / Svelte | เฟรมเวิร์ก + runes                    | —                                                        | https://svelte.dev/docs/kit                                 | https://svelte.dev/llms.txt                                 |
| Cloudflare Workers | runtime + adapter                     | —                                                        | https://developers.cloudflare.com/workers/                  | https://developers.cloudflare.com/llms.txt                  |
| Vitest             | test runner                           | —                                                        | https://vitest.dev/                                         | https://vitest.dev/llms.txt                                 |

## ตรวจว่าลิงก์ยังใช้ได้

```bash
curl -s -o /dev/null -w "%{http_code}\n" -L <url>   # ต้องได้ 200
```

ผลล่าสุด 2026-10-14: svelte `200` · svelte/llms-full `200` · cloudflare `200` · exa `200` ·
vitest `200` · supabase `200` · open-meteo `/llms.txt` `404` (ใช้หน้าปกติ) · tailwind `/llms.txt` `404`
