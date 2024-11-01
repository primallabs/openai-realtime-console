import { openai } from "../api/openai";

const SETH_ID: string = process.env.SETH_POC_ASSISTANT_ID || '';
const sethProxy = new ConversationProxy(SETH_ID);

export const ToolSchema = {
  name: 'get_RevenueForecast',
  description: 'Fetches revenue forecast data for the specified period.',
  parameters: {
    type: 'object',
    properties: {
      period: {
        type: 'string',
        description: 'The period for which to fetch the revenue forecast (e.g., "next quarter", "next year", "between month X and month Y").',
      },
    },
    required: ['period'],
  },
};

import ConversationProxy from "../api/conversation-proxy";

export const ToolFunction = async ({ period }: { period: string }) => {
  try {
    if(!sethProxy.isInputActive)
      return { error: "Seth is busy." };

    var prompt = "I would like to know the revenue forecast for period: " + period + ".";
    
    // TODO Make this event driven
    return {
      status: 200,
      body: await sethProxy.sendMessage(prompt).then(async (proxy) => await proxy.waitForResponse().then(() => proxy.getResponseContent()))
    };
  } catch (error) {
    console.error("Error fetching revenue forecast:", error);
    throw new Error("Failed to fetch revenue forecast.");
  }
};