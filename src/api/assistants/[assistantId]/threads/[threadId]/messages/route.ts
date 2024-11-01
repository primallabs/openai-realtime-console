import { openai } from "../../../../../openai";
import { RequestParams, RequestBody } from "../../../../../types/request";

export const runtime = "nodejs";

export async function POST(request: Request, { params: {assistantId, threadId } }: RequestParams): Promise<Response> {
  
  if (!threadId) {
    throw new Error("threadId is required");
  }

  if (!assistantId) {
    throw new Error("assistantId is required");
  }

  const { content }: RequestBody = await request.json();

  await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: content,
  });

  const stream = openai.beta.threads.runs.stream(threadId, {
    assistant_id: assistantId,
  });

  return new Response(stream.toReadableStream());
}
