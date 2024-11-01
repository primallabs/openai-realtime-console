import { openai } from "../../../../../openai";
import { RequestParams, RequestBody } from "../../../../../types/request";

export async function POST(request: Request, { params: { threadId } }: RequestParams): Promise<Response> {
  if (!threadId) {
    throw new Error("threadId is required");
  }
  
  const { toolCallOutputs, runId }: RequestBody = await request.json();

  const stream = openai.beta.threads.runs.submitToolOutputsStream(
    threadId,
    runId,
    { tool_outputs: toolCallOutputs.tool_outputs }
  );

  return new Response(stream.toReadableStream());
}
