/**
 * Ainee's conversation engine: GPT-4o with her system prompt.
 * Call generateReply with conversation history and optional lead context.
 */
import OpenAI from "openai";
import { AINEE_SYSTEM_PROMPT } from "./system-prompt";

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Missing OPENAI_API_KEY in environment");
  return new OpenAI({ apiKey: key });
}

export type MessageRole = "user" | "assistant" | "system";

export interface ConversationMessage {
  role: MessageRole;
  content: string;
}

export interface LeadContext {
  firstName?: string;
  lastName?: string;
  currentStage?: string;
  lastReplyAt?: string;
  /** Any note from rep or pre-check to inform tone (e.g. "lead said they're busy until next week") */
  note?: string;
}

/**
 * Build the context block we inject into the system or first user message so Ainee knows who she is talking to.
 */
function buildContextBlock(ctx: LeadContext): string {
  const parts: string[] = [];
  if (ctx.firstName) parts.push(`Lead's first name: ${ctx.firstName}`);
  if (ctx.lastName) parts.push(`Last name: ${ctx.lastName}`);
  if (ctx.currentStage) parts.push(`Current pipeline stage: ${ctx.currentStage}`);
  if (ctx.lastReplyAt) parts.push(`Last reply from lead: ${ctx.lastReplyAt}`);
  if (ctx.note) parts.push(`Note for this conversation: ${ctx.note}`);
  if (parts.length === 0) return "";
  return `[Context for this lead: ${parts.join(". ")}]\n\n`;
}

/**
 * Generate Ainee's next reply given conversation history and optional lead context.
 * Uses GPT-4o. Messages should be in chronological order; "user" = lead, "assistant" = Ainee.
 * learnedRules: optional block of "when lead says X, say Y" from your corrections (trains her up).
 */
export async function generateReply(
  messages: ConversationMessage[],
  leadContext: LeadContext = {},
  learnedRules?: string
): Promise<string> {
  const contextBlock = buildContextBlock(leadContext);
  let systemContent = contextBlock
    ? AINEE_SYSTEM_PROMPT + "\n\n" + contextBlock
    : AINEE_SYSTEM_PROMPT;
  if (learnedRules?.trim()) {
    systemContent += "\n\nLEARNED RULES (use these when they apply):\n" + learnedRules.trim();
  }

  const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemContent },
    ...messages
      .filter((m): m is ConversationMessage => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
  ];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  const completion = await getOpenAI().chat.completions.create(
    {
      model: "gpt-4o",
      messages: openaiMessages,
      max_tokens: 500,
      temperature: 0.7,
    },
    { signal: controller.signal }
  );
  clearTimeout(timeoutId);

  const reply = completion.choices[0]?.message?.content?.trim();
  if (!reply) {
    throw new Error("Empty reply from OpenAI");
  }
  return reply;
}
