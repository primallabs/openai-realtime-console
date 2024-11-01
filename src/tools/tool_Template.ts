import OpenAI from "openai";
const openai = new OpenAI();

var ToolSchema = {
    name: 'function_name',
    description:
      'Description of the function',
    parameters: {
      type: 'object',
      properties: {
        name_of_number_type_parameter: {
          type: 'number | string',
          description: 'Description of the parameter',
        },
      },
      required: ['lat', 'lng', 'location'],
    },
  };

var ToolFunction =
  async ({ }: { [key: string]: any }) => {
    /// Exmaple of a function calling an endpoint
    const result = await fetch('https://api.example.com/data');
    const json = await result.json();
    return json;

    /// Example of a function calling the assistant api from @openAi
    const openai = require('openai');

  }