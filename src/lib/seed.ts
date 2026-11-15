import { db, schema } from "@/db/client";
import { loadModels } from "@/lib/ai/registry";
import { getPipelineConfig } from "./settings";

/**
 * Idempotent bootstrap. Creates only structural rows and explicit,
 * owner-stated preferences — never observations (no fake metrics).
 */
export async function seed() {
  await getPipelineConfig();
  const email = process.env.TEMPO_ADMIN_EMAIL ?? "owner@localhost";
  const [user] = await db.insert(schema.users).values({ email, displayName: "Kana", timezone: "Asia/Almaty", locale: "ru" })
    .onConflictDoUpdate({ target: schema.users.email, set: { email } }).returning();
  await db.insert(schema.preferences).values({
    userId: user.id,
    preferredTopics: ["ai", "technology", "software", "infrastructure", "geopolitics", "regulation", "economics", "research"],
    geographicInterests: ["kazakhstan", "central-asia", "Kazakhstan", "Central Asia", "Astana"],
    readingLanguage: "ru",
    editorialDepth: "standard",
  }).onConflictDoNothing();

  for (const [id, p] of Object.entries(loadModels().providers)) {
    await db.insert(schema.modelProviders).values({ id, kind: p.kind, baseUrl: p.base_url ?? null, apiKeyEnv: p.api_key_env ?? null }).onConflictDoNothing();
  }

  const integ: { id: string; category: string; env: string[]; detail: string }[] = [
    { id: "google_calendar", category: "calendar", env: ["GOOGLE_CALENDAR_ICS_URL"], detail: "Нужна приватная ссылка ICS (только чтение)." },
    { id: "github", category: "projects", env: ["GITHUB_TOKEN"], detail: "Активность репозиториев превращается в записи о проектах. Нужен токен GitHub." },
    { id: "manual_projects", category: "projects", env: [], detail: "Записи о проектах, которые вы вносите вручную." },
    { id: "market_data", category: "finance", env: ["MARKET_DATA_PROVIDER"], detail: "Курсы, индексы, сырьё. Поставщик данных не выбран." },
    { id: "telegram", category: "publishing", env: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHANNEL_ID"], detail: "Публикация через бота в канал, где он администратор. Нужны токен бота и канал." },
    { id: "linkedin", category: "publishing", env: ["LINKEDIN_ACCESS_TOKEN"], detail: "Публикация требует одобренного приложения LinkedIn; статистику постов личного профиля API не отдаёт — её вносят вручную." },
    { id: "x", category: "publishing", env: ["X_BEARER_TOKEN"], detail: "Публикация требует платного тарифа X API с правом записи." },
  ];
  for (const i of integ) {
    const connected = i.env.length > 0 && i.env.every((e) => !!process.env[e]);
    const state = i.id === "manual_projects" ? "connected" : connected ? "connected" : i.id === "linkedin" ? "export_only" : "disconnected";
    await db.insert(schema.integrations).values({ id: i.id, category: i.category, state, detail: i.detail })
      .onConflictDoUpdate({ target: schema.integrations.id, set: { state, detail: i.detail, updatedAt: new Date() } });
  }
  return user;
}
