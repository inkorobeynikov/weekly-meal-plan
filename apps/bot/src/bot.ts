import { Bot, session, GrammyError, HttpError } from "grammy";
import { initialSession, type BotContext } from "./session.js";
import { handleStart } from "./commands/start.js";
import { handlePlan } from "./commands/plan.js";
import { handleShopping } from "./commands/shopping.js";
import { handleHelp } from "./commands/help.js";
import { handleReset } from "./commands/reset.js";
import { messageHandler } from "./handlers/message.handler.js";
import { callbackHandler } from "./handlers/callback.handler.js";

export function createBot(token: string): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);

  bot.use(session({ initial: initialSession }));

  bot.command("start", handleStart);
  bot.command("plan", handlePlan);
  bot.command("shopping", handleShopping);
  bot.command("help", handleHelp);
  bot.command("reset", handleReset);

  bot.on("callback_query:data", callbackHandler);
  bot.on("message:text", messageHandler);

  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`[bot] error for update ${ctx.update.update_id}:`, err.error);
    const e = err.error;
    if (e instanceof GrammyError) {
      console.error("Telegram API error:", e.description);
    } else if (e instanceof HttpError) {
      console.error("Network error:", e);
    }
    ctx
      .reply("Coś poszło nie tak. Spróbuj jeszcze raz za chwilę.")
      .catch(() => {});
  });

  return bot;
}

let cachedBot: Bot<BotContext> | null = null;

export function getBot(): Bot<BotContext> {
  if (cachedBot) return cachedBot;
  const token = process.env.BOT_TOKEN;
  if (!token) {
    throw new Error("BOT_TOKEN is not set");
  }
  cachedBot = createBot(token);
  return cachedBot;
}
