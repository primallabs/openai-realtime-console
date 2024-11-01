import { ToolCallOutputs } from './tools';

export interface RequestBody {
  toolCallOutputs: ToolCallOutputs;
  runId: string;
  content: string;
  role: string
}

export interface RequestParams {
  params: {
    threadId?: string;
    assistantId?: string;
  };
}